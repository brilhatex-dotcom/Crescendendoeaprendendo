import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EvaluationResult, RegraDeRecompensa } from "@/activities";
import { seletorPorProximidade } from "@/activities";
import { criarAvaliacaoPorMissao, criarAvaliacaoPorTentativa } from "@/modules/achievement";
import { criarRepositorioPrismaDeConquistas } from "@/modules/achievement/infrastructure/prisma-achievement-repository";
import { carregarAcervo } from "@/content/loader";
import { criarSubmeterTentativa } from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { criarImportarConteudo, refDeAtividade, refDeMissao } from "@/modules/content";
import { criarEscritorPrismaDeConteudo } from "@/modules/content/infrastructure/prisma-content-writer";
import {
  criarCobrancaDeFolego,
  criarCreditoDeMissao as criarCreditoDeMissaoNaLuz,
  criarCreditoDeTentativa,
} from "@/modules/progression";
import { criarRepositorioPrismaDeProgresso } from "@/modules/progression/infrastructure/prisma-progress-repository";
import { criarAbrirJogada, criarAvancoDaCorrida, criarConcluirJogada } from "@/modules/quest";
import { criarLeituraPrismaDoMapa } from "@/modules/quest/infrastructure/prisma-map-reader";
import { criarRepositorioPrismaDeMissoes } from "@/modules/quest/infrastructure/prisma-quest-repository";
import { criarRepositorioPrismaDeSlots } from "@/modules/quest/infrastructure/prisma-slot-repository";
import { criarBarramento } from "@/server/event-bus";
import { criarDespachanteDoOutbox } from "@/server/outbox";
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";
import { systemClock, type EventHandler, type Transacao } from "@/shared/kernel";

/**
 * Conquistas, contra Postgres.
 *
 * Os testes de unidade provam `montarQuadro`, `progressoDoCriterio` e o
 * schema do critério com dublês. Este prova o que dublê nenhum alcança:
 *
 *  · que a pipeline real (resposta/missão → outbox → despachante) avança
 *    progresso e desbloqueia de verdade;
 *  · que `avancarProgresso` é **idempotente por recomputação** — chamado
 *    duas vezes com o mesmo estado, não muda nada na segunda vez. É esta
 *    propriedade, não uma checagem de "já processei este evento", que
 *    protege contra o outbox ser *at-least-once* (duas execuções
 *    concorrentes do despachante podem processar a mesma mensagem).
 */

const db = new PrismaClient();

const progresso = criarRepositorioPrismaDeProgresso(db);
const conquistas = criarRepositorioPrismaDeConquistas(db);
const missoes = criarRepositorioPrismaDeMissoes();
const slots = criarRepositorioPrismaDeSlots();
const leitura = criarLeituraPrismaDoMapa(db);

const MANIPULADORES: readonly EventHandler[] = [
  criarCobrancaDeFolego({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeTentativa({ repositorio: progresso, clock: systemClock }),
  criarAvaliacaoPorTentativa({ repositorio: conquistas, clock: systemClock }),
  criarAvancoDaCorrida({ repositorio: missoes, slots, seletor: seletorPorProximidade, clock: systemClock }),
  criarCreditoDeMissaoNaLuz({ repositorio: progresso, clock: systemClock }),
  criarAvaliacaoPorMissao({ repositorio: conquistas, clock: systemClock }),
] as readonly EventHandler[];

const unidadeDeTrabalho = criarUnidadeDeTrabalho(db);
const barramento = criarBarramento(MANIPULADORES);
const despachante = criarDespachanteDoOutbox(db, MANIPULADORES);

const deps = {
  repositorio: missoes,
  leitura,
  slots,
  seletor: seletorPorProximidade,
  unidadeDeTrabalho,
  barramento,
  clock: systemClock,
};

const abrir = criarAbrirJogada(deps);
const concluir = criarConcluirJogada(deps);

const submeter = criarSubmeterTentativa({
  repositorio: criarRepositorioPrismaDeAvaliacao(db),
  unidadeDeTrabalho,
  barramento,
  clock: systemClock,
  dormir: async () => {},
});

const ACERTOU: EvaluationResult = {
  outcome: "CORRECT",
  scoreRatio: 1,
  feedback: { tom: "CELEBRA", mensagem: "Isso!" },
};

function premio() {
  return {
    xp: 10,
    moedas: 0,
    cristais: 0,
    diamantes: 0,
    folego: 0,
    itens: [],
    conquistas: [],
    desbloqueios: [],
    colecionaveis: [],
  };
}

const RECOMPENSA: RegraDeRecompensa = {
  porDesfecho: { CORRECT: premio(), PARTIAL: premio(), INCORRECT: premio() },
  multiplicadorPorDica: [1],
  decaimentoPorRepeticao: [1],
  aplicarFatorDeDificuldade: false,
};

let refDaMissao = "";
let refsDasAtividades: string[] = [];
let skillId = "";
let learnerId = "";
let accountId = "";

async function limparConteudo(): Promise<void> {
  await db.stageActivity.deleteMany();
  await db.stage.deleteMany();
  await db.quest.deleteMany();
  await db.chapter.deleteMany();
  await db.world.deleteMany();
  await db.activity.deleteMany();
  await db.objective.deleteMany();
  await db.skillPrerequisite.deleteMany();
  await db.skill.deleteMany();
  await db.strand.deleteMany();
  await db.subject.deleteMany();
  await db.academy.deleteMany();
  await db.achievement.deleteMany();
}

async function limparJogadas(): Promise<void> {
  await db.learnerAchievement.deleteMany();
  await db.attempt.deleteMany();
  await db.questRun.deleteMany();
  await db.skillMastery.deleteMany();
  await db.reviewCard.deleteMany();
  await db.outboxMessage.deleteMany();
  await db.learningEvent.deleteMany();
  await db.unlock.deleteMany();
  await db.learnerProgress.deleteMany();
}

beforeAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany();
  await db.learner.deleteMany();
  await db.account.deleteMany({ where: { email: "conquistas@teste.local" } });
  await limparConteudo();

  const { acervo, problemas } = await carregarAcervo();
  expect(problemas).toEqual([]);

  const importar = criarImportarConteudo({ escritor: criarEscritorPrismaDeConteudo(db) });
  expect((await importar({ acervo })).ok).toBe(true);

  const carregada = acervo.missoes[0];
  expect(carregada).toBeDefined();

  refDaMissao = refDeMissao(carregada!);
  refsDasAtividades = carregada!.missao.fases.flatMap((fase) =>
    fase.atividades.map((a) => refDeAtividade(carregada!, fase.slug, a.slug)),
  );
  expect(refsDasAtividades.length).toBeGreaterThan(0);

  const skill = await db.skill.findFirstOrThrow();
  skillId = skill.id;

  const conta = await db.account.create({
    data: { email: "conquistas@teste.local", name: "Responsável de Teste" },
  });
  accountId = conta.id;

  const crianca = await db.learner.create({
    data: {
      displayName: "Teste",
      birthYear: 2019,
      ageBand: "SPROUT",
      avatarConfig: { schemaVersion: 1 },
      guardians: { create: { accountId: conta.id, relation: "mãe", isPrimary: true } },
    },
  });
  learnerId = crianca.id;
});

beforeEach(limparJogadas);

afterAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany({ where: { accountId } });
  await db.learner.deleteMany({ where: { id: learnerId } });
  await db.account.deleteMany({ where: { id: accountId } });
  await limparConteudo();
  await db.$disconnect();
});

async function concluirUmaMissao(sufixo: string): Promise<void> {
  const aberta = await abrir({ learnerId, refDaMissao, traceId: "trace-conquistas" });
  if (!aberta.ok) throw new Error("não abriu a jogada");

  for (const [indice, ref] of refsDasAtividades.entries()) {
    await submeter({
      learnerId,
      refDaAtividade: ref,
      resultado: ACERTOU,
      probabilidadeDeChute: 0.25,
      regraDeRecompensa: RECOMPENSA,
      resposta: { escolha: 1 },
      dicasUsadas: 0,
      duracaoMs: 1500,
      questRunId: aberta.value.questRunId,
      idempotencyKey: `chave-${sufixo}-${indice}`,
      avaliadaNoCliente: true,
      traceId: "trace-conquistas",
    });
  }

  const concluida = await concluir({
    learnerId,
    questRunId: aberta.value.questRunId,
    refDaMissao,
    traceId: "trace-conquistas",
  });
  if (!concluida.ok) throw new Error("não concluiu a jogada");
}

describe("pipeline real: missão concluída → outbox → conquista", () => {
  it("concluir a primeira missão desbloqueia 'primeira-missao-concluida' pelo despachante", async () => {
    await concluirUmaMissao("pipeline-1");

    // Antes do despachante rodar, o outbox tem a mensagem, mas a conquista
    // ainda não avançou — é o próprio ponto de ser `outbox`, não `inline`.
    expect(await db.learnerAchievement.count({ where: { learnerId } })).toBe(0);

    const relatorio = await despachante.despachar();
    expect(relatorio.falhadas).toBe(0);

    const linha = await db.learnerAchievement.findFirst({
      where: { learnerId, achievement: { code: "primeira-missao-concluida" } },
    });
    expect(linha?.unlockedAt).not.toBeNull();
    expect(Number(linha?.progress)).toBe(1);
  });

  it("despachar duas vezes não desbloqueia de novo nem falha", async () => {
    await concluirUmaMissao("pipeline-2");
    await despachante.despachar();
    const primeira = await db.learnerAchievement.findFirst({
      where: { learnerId, achievement: { code: "primeira-missao-concluida" } },
    });

    // Mensagem já processada — despachar de novo não pega a mesma mensagem
    // (processedAt não é mais nulo), mas o teste abaixo cobre o caminho em
    // que duas execuções concorrentes processariam a mesma mensagem.
    const relatorio = await despachante.despachar();
    expect(relatorio.processadas).toBe(0);

    const segunda = await db.learnerAchievement.findFirst({
      where: { learnerId, achievement: { code: "primeira-missao-concluida" } },
    });
    expect(segunda?.unlockedAt).toEqual(primeira?.unlockedAt);
  });
});

describe("RepositorioDeConquistas.avancarProgresso — idempotência por recomputação", () => {
  it("recomputa a partir de QuestRun.status, não acumula por chamada", async () => {
    // Duas corridas concluídas de verdade, fora do barramento — só o dado
    // que o critério lê.
    await db.questRun.createMany({
      data: [
        { learnerId, questId: (await db.quest.findFirstOrThrow()).id, status: "COMPLETED", startedAt: new Date() },
        {
          learnerId,
          questId: (await db.quest.findFirstOrThrow()).id,
          status: "COMPLETED",
          startedAt: new Date(Date.now() + 1000),
        },
      ],
    });

    const agora = new Date("2026-08-14T12:00:00Z");
    const desbloqueadas = await db.$transaction((tx) =>
      conquistas.avancarProgresso(learnerId, "missoesConcluidas", agora, tx as unknown as Transacao),
    );

    // 2 missões: cruza "primeira-missao-concluida" (mín. 1), não cruza as de 5/10.
    expect(desbloqueadas.map((d) => d.code)).toEqual(["primeira-missao-concluida"]);

    const linha = await db.learnerAchievement.findFirst({
      where: { learnerId, achievement: { code: "cinco-missoes-concluidas" } },
    });
    expect(Number(linha?.progress)).toBe(0.4); // 2/5
    expect(linha?.unlockedAt).toBeNull();
  });

  it("chamar de novo com o mesmo estado não desbloqueia nada a mais nem muda o progresso", async () => {
    const quest = await db.quest.findFirstOrThrow();
    await db.questRun.create({
      data: { learnerId, questId: quest.id, status: "COMPLETED", startedAt: new Date() },
    });

    const agora = new Date("2026-08-14T12:00:00Z");
    const primeira = await db.$transaction((tx) =>
      conquistas.avancarProgresso(learnerId, "missoesConcluidas", agora, tx as unknown as Transacao),
    );
    expect(primeira.map((d) => d.code)).toEqual(["primeira-missao-concluida"]);

    // Simula duas execuções concorrentes do despachante processando a mesma
    // mensagem — exatamente o cenário que faz o outbox ser *at-least-once*.
    const segunda = await db.$transaction((tx) =>
      conquistas.avancarProgresso(learnerId, "missoesConcluidas", agora, tx as unknown as Transacao),
    );
    expect(segunda).toEqual([]); // nada cruza o limiar de novo

    const linha = await db.learnerAchievement.findFirst({
      where: { learnerId, achievement: { code: "primeira-missao-concluida" } },
    });
    expect(Number(linha?.progress)).toBe(1);
    expect(linha?.unlockedAt).toEqual(agora);
  });

  it("recomputa competenciasDominadas a partir de SkillMastery.masteredAt", async () => {
    await db.skillMastery.create({
      data: {
        learnerId,
        skillId,
        probability: 0.9,
        ability: 1.2,
        masteredAt: new Date(),
      },
    });

    const desbloqueadas = await db.$transaction((tx) =>
      conquistas.avancarProgresso(
        learnerId,
        "competenciasDominadas",
        new Date(),
        tx as unknown as Transacao,
      ),
    );

    expect(desbloqueadas.map((d) => d.code)).toEqual(["primeiro-farol"]);
  });

  it("critério irreconhecível não trava o avanço das demais conquistas", async () => {
    await db.achievement.update({
      where: { code: "dez-missoes-concluidas" },
      data: { criteria: { tipo: "algoInventado", minimo: 3 } },
    });

    await db.questRun.create({
      data: { learnerId, questId: (await db.quest.findFirstOrThrow()).id, status: "COMPLETED", startedAt: new Date() },
    });

    const desbloqueadas = await db.$transaction((tx) =>
      conquistas.avancarProgresso(learnerId, "missoesConcluidas", new Date(), tx as unknown as Transacao),
    );
    expect(desbloqueadas.map((d) => d.code)).toEqual(["primeira-missao-concluida"]);

    // A conquista com critério quebrado continua sem progresso — não trava,
    // mas também não avança sozinha.
    const linha = await db.learnerAchievement.findFirst({
      where: { learnerId, achievement: { code: "dez-missoes-concluidas" } },
    });
    expect(linha).toBeNull();

    await db.achievement.update({
      where: { code: "dez-missoes-concluidas" },
      data: { criteria: { tipo: "missoesConcluidas", minimo: 10 } },
    });
  });
});

describe("RepositorioDeConquistas.quadro", () => {
  it("junta catálogo e progresso da criança", async () => {
    await db.questRun.create({
      data: { learnerId, questId: (await db.quest.findFirstOrThrow()).id, status: "COMPLETED", startedAt: new Date() },
    });
    await db.$transaction((tx) =>
      conquistas.avancarProgresso(learnerId, "missoesConcluidas", new Date(), tx as unknown as Transacao),
    );

    const { catalogo, progresso: progressoPorCode } = await conquistas.quadro(learnerId);

    expect(catalogo.length).toBeGreaterThanOrEqual(6);
    expect(progressoPorCode.get("primeira-missao-concluida")?.desbloqueadaEm).not.toBeNull();
    // Toda conquista do mesmo tipo de critério ganha progresso, não só a que
    // está prestes a fechar — é o que faz a barra de "3 de 10" fazer sentido
    // mesmo longe do fim.
    expect(progressoPorCode.get("dez-missoes-concluidas")?.progresso).toBe(0.1);
    expect(progressoPorCode.get("dez-missoes-concluidas")?.desbloqueadaEm).toBeNull();
  });
});
