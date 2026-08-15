import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EvaluationResult, RegraDeRecompensa } from "@/activities";
import { seletorPorProximidade } from "@/activities";
import { criarSubmeterTentativa } from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import {
  criarCreditoDeMissao as criarCreditoDeMissaoNaCarteira,
  criarCreditoDeRecompensa,
} from "@/modules/economy";
import { criarRepositorioPrismaDeCarteira } from "@/modules/economy/infrastructure/prisma-wallet-repository";
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
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";
import { systemClock, type EventHandler } from "@/shared/kernel";

/**
 * FILA DE REVISÃO (docs/08 §7) — Postgres de verdade.
 *
 * A missão "sistema/fila-de-revisao" vem de uma migration de dados
 * (`fila_de_revisao_fixture`), não de `content/` — é a única do acervo com
 * slot do modo `revisao`. `garantirFixtureDeRevisao` recria a linha por
 * upsert antes de cada suíte: outros arquivos de integração apagam a tabela
 * `Quest` inteira no próprio `beforeAll`/`afterAll` (rebuild do acervo a
 * partir de `content/`), e essa fixture não é reimportável — se não for
 * refeita aqui, o teste depende da ordem de execução dos outros arquivos.
 *
 * O que este teste **não** prova: que a criança consegue *jogar* esta missão
 * no navegador. `content-bridge.ts` monta a sessão a partir de `content/` no
 * disco, e esta missão não está lá — ver `docs/HANDOFF.md §4`. O que prova:
 * que o motor lê a fila vencida, escolhe atividade de verdade, grava a
 * escolha e fecha o ciclo do SM-2 quando a criança responde.
 */

const db = new PrismaClient();

const progresso = criarRepositorioPrismaDeProgresso(db);
const carteira = criarRepositorioPrismaDeCarteira(db);
const missoes = criarRepositorioPrismaDeMissoes();
const slots = criarRepositorioPrismaDeSlots();
const leitura = criarLeituraPrismaDoMapa(db);

const MANIPULADORES: readonly EventHandler[] = [
  criarCobrancaDeFolego({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeTentativa({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeRecompensa({ repositorio: carteira }),
  criarAvancoDaCorrida({
    repositorio: missoes,
    slots,
    seletor: seletorPorProximidade,
    clock: systemClock,
  }),
  criarCreditoDeMissaoNaLuz({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeMissaoNaCarteira({ repositorio: carteira }),
] as readonly EventHandler[];

const unidadeDeTrabalho = criarUnidadeDeTrabalho(db);
const barramento = criarBarramento(MANIPULADORES);

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

const REF_DA_FILA = "sistema/fila-de-revisao";

const ACERTOU: EvaluationResult = {
  outcome: "CORRECT",
  scoreRatio: 1,
  feedback: { tom: "CELEBRA", mensagem: "Isso!" },
};

const RECOMPENSA: RegraDeRecompensa = {
  porDesfecho: {
    CORRECT: {
      xp: 5,
      moedas: 0,
      cristais: 0,
      diamantes: 0,
      folego: 0,
      itens: [],
      conquistas: [],
      desbloqueios: [],
      colecionaveis: [],
    },
    PARTIAL: vazio(),
    INCORRECT: vazio(),
  },
  multiplicadorPorDica: [1],
  decaimentoPorRepeticao: [1],
  aplicarFatorDeDificuldade: true,
};

function vazio() {
  return {
    xp: 0,
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

async function garantirFixtureDeRevisao(): Promise<void> {
  await db.academy.upsert({
    where: { id: "sys_academia_revisao" },
    update: {},
    create: {
      id: "sys_academia_revisao",
      slug: "sistema",
      name: "Sistema",
      islandName: "Farol",
      guardian: "SISTEMA",
      theme: {},
      order: 9999,
      minLevel: 1,
    },
  });
  await db.world.upsert({
    where: { id: "sys_mundo_revisao" },
    update: {},
    create: {
      id: "sys_mundo_revisao",
      academyId: "sys_academia_revisao",
      slug: "fila-de-revisao",
      name: "Fila de Revisão",
      mapLayout: { schemaVersion: 1, nos: [], arestas: [] },
      minLevel: 1,
      order: 0,
    },
  });
  await db.chapter.upsert({
    where: { id: "sys_capitulo_revisao" },
    update: {},
    create: { id: "sys_capitulo_revisao", worldId: "sys_mundo_revisao", name: "Revisão", story: {}, order: 0 },
  });
  await db.quest.upsert({
    where: { id: "sys_missao_revisao" },
    update: {},
    create: {
      id: "sys_missao_revisao",
      chapterId: "sys_capitulo_revisao",
      kind: "REVIEW",
      name: "Fila de Revisão",
      narrative: {
        introducao: "Hora de olhar de novo para o que você já aprendeu.",
        conclusao: "Isso ficou guardado.",
      },
      rewardXp: 20,
      rewardCoins: 5,
      rewardCrystals: 0,
      requiredSkills: [],
      unlockRule: {},
      order: 0,
      sourceRef: REF_DA_FILA,
    },
  });
  await db.stage.upsert({
    where: { id: "sys_fase_revisao" },
    update: {},
    create: { id: "sys_fase_revisao", questId: "sys_missao_revisao", order: 0, rule: {} },
  });
  for (let posicao = 0; posicao < 5; posicao += 1) {
    await db.stageActivity.upsert({
      where: { stageId_order: { stageId: "sys_fase_revisao", order: posicao } },
      update: {},
      create: { stageId: "sys_fase_revisao", order: posicao, activityId: null, slotRule: { modo: "revisao" } },
    });
  }
}

/** Uma competência de teste com candidatas publicadas, pronta para entrar vencida na fila. */
async function criarCompetenciaComCandidatas(sufixo: string) {
  const academy = await db.academy.create({
    data: {
      slug: `academia-revisao-${sufixo}`,
      name: "Academia de Teste",
      islandName: "Ilha de Teste",
      guardian: "TESTE",
      theme: {},
      order: 900,
    },
  });
  const subject = await db.subject.create({
    data: { academyId: academy.id, code: `TSTREV${sufixo}`, name: "Disciplina de Teste", order: 1 },
  });
  const strand = await db.strand.create({
    data: { subjectId: subject.id, code: "T1", name: "Eixo de Teste", order: 1 },
  });
  const skill = await db.skill.create({
    data: {
      strandId: strand.id,
      name: `Competência de revisão ${sufixo}`,
      description: "Competência criada só para este teste.",
      minAgeBand: "SPROUT",
      maxAgeBand: "SPROUT",
      difficultyRef: 1000,
      order: 1,
    },
  });
  const objective = await db.objective.create({
    data: { skillId: skill.id, name: `Objetivo de revisão ${sufixo}`, order: 1 },
  });

  const base = {
    objectiveId: objective.id,
    type: "MULTIPLE_CHOICE" as const,
    config: {},
    estimatedSec: 30,
    minAgeBand: "SPROUT" as const,
    maxAgeBand: "SPROUT" as const,
    status: "PUBLISHED" as const,
    locale: "pt-BR",
  };

  const perto = await db.activity.create({
    data: { ...base, difficulty: 1060, sourceRef: `teste/revisao/${sufixo}/perto` },
  });
  const longe = await db.activity.create({
    data: { ...base, difficulty: 1800, sourceRef: `teste/revisao/${sufixo}/longe` },
  });

  return { skillId: skill.id, pertoId: perto.id, longeId: longe.id };
}

async function venceuHa(horas: number, skillId: string, learnerId: string): Promise<void> {
  await db.reviewCard.upsert({
    where: { learnerId_skillId: { learnerId, skillId } },
    update: { dueAt: new Date(Date.now() - horas * 60 * 60 * 1000) },
    create: {
      learnerId,
      skillId,
      dueAt: new Date(Date.now() - horas * 60 * 60 * 1000),
    },
  });
}

let learnerId = "";
let accountId = "";

async function limparJogadas(): Promise<void> {
  await db.attempt.deleteMany();
  // `QuestRunSlot` cai em cascata com `QuestRun` (schema.prisma).
  await db.questRun.deleteMany();
  await db.skillMastery.deleteMany();
  await db.reviewCard.deleteMany();
  await db.outboxMessage.deleteMany();
  await db.learningEvent.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.wallet.deleteMany();
  await db.unlock.deleteMany();
  await db.learnerProgress.deleteMany();
}

/** Limpa só as competências de teste — nunca a fixture de sistema. */
async function limparCompetenciasDeTeste(): Promise<void> {
  await db.activity.deleteMany({ where: { sourceRef: { startsWith: "teste/revisao/" } } });
  await db.objective.deleteMany({ where: { name: { startsWith: "Objetivo de revisão" } } });
  await db.skill.deleteMany({ where: { name: { startsWith: "Competência de revisão" } } });
  await db.strand.deleteMany({ where: { code: "T1", subject: { code: { startsWith: "TSTREV" } } } });
  await db.subject.deleteMany({ where: { code: { startsWith: "TSTREV" } } });
  await db.academy.deleteMany({ where: { slug: { startsWith: "academia-revisao-" } } });
}

beforeAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany();
  await db.learner.deleteMany();
  await db.account.deleteMany({ where: { email: "revisao@teste.local" } });
  await limparCompetenciasDeTeste();
  await garantirFixtureDeRevisao();

  const conta = await db.account.create({
    data: { email: "revisao@teste.local", name: "Responsável de Teste" },
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
  await limparCompetenciasDeTeste();
  await db.$disconnect();
});

async function responder(questRunId: string, activityId: string, chave: string) {
  const atividade = await db.activity.findUniqueOrThrow({ where: { id: activityId } });
  return submeter({
    learnerId,
    refDaAtividade: atividade.sourceRef!,
    resultado: ACERTOU,
    probabilidadeDeChute: 0.25,
    regraDeRecompensa: RECOMPENSA,
    resposta: { escolha: 1 },
    dicasUsadas: 0,
    duracaoMs: 3000,
    presentationTag: null,
    questRunId,
    idempotencyKey: chave,
    avaliadaNoCliente: true,
    traceId: "trace-revisao",
  });
}

describe("fila de revisão", () => {
  it("preenche um slot com a competência vencida e conclui ao responder", async () => {
    const { skillId, pertoId } = await criarCompetenciaComCandidatas("basico");
    await venceuHa(1, skillId, learnerId);

    const aberta = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    expect(aberta.ok).toBe(true);
    if (!aberta.ok) return;

    expect(aberta.value.atividadesRestantes).toBe(1);

    const slotsResolvidos = await db.questRunSlot.findMany({
      where: { questRunId: aberta.value.questRunId },
    });
    expect(slotsResolvidos).toHaveLength(1);
    expect(slotsResolvidos[0]?.activityId).toBe(pertoId);

    await responder(aberta.value.questRunId, pertoId, "chave-revisao-basico");

    const resultado = await concluir({
      learnerId,
      questRunId: aberta.value.questRunId,
      refDaMissao: REF_DA_FILA,
      traceId: "t",
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.concedidaAgora).toBe(true);
  });

  it("a competência mais vencida ocupa o primeiro slot", async () => {
    const a = await criarCompetenciaComCandidatas("mais-vencida");
    const b = await criarCompetenciaComCandidatas("menos-vencida");
    await venceuHa(48, a.skillId, learnerId);
    await venceuHa(1, b.skillId, learnerId);

    const aberta = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    if (!aberta.ok) return;

    const linhas = await db.questRunSlot.findMany({
      where: { questRunId: aberta.value.questRunId },
      orderBy: { order: "asc" },
    });

    expect(linhas.map((l) => l.activityId)).toEqual([a.pertoId, b.pertoId]);
  });

  it("retomar não muda a atividade já escolhida, mesmo com um cartão mais vencido chegando depois", async () => {
    const primeira = await criarCompetenciaComCandidatas("retomar-1");
    await venceuHa(1, primeira.skillId, learnerId);

    const aberta = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    if (!aberta.ok) return;

    const antes = await db.questRunSlot.findFirst({
      where: { questRunId: aberta.value.questRunId, order: 0 },
    });
    expect(antes?.activityId).toBe(primeira.pertoId);

    // Uma competência muito mais vencida aparece depois da primeira abertura.
    const segunda = await criarCompetenciaComCandidatas("retomar-2");
    await venceuHa(240, segunda.skillId, learnerId);

    const retomada = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    expect(retomada.ok).toBe(true);
    if (!retomada.ok) return;
    expect(retomada.value.questRunId).toBe(aberta.value.questRunId);

    const depois = await db.questRunSlot.findFirst({
      where: { questRunId: aberta.value.questRunId, order: 0 },
    });
    // O slot 0 já tinha dono; a competência nova, mesmo mais vencida, só pode
    // ocupar um dos quatro slots que ainda estavam livres.
    expect(depois?.activityId).toBe(primeira.pertoId);

    const segundoSlot = await db.questRunSlot.findFirst({
      where: { questRunId: aberta.value.questRunId, order: 1 },
    });
    expect(segundoSlot?.activityId).toBe(segunda.pertoId);
  });

  it("não exclui atividade vista nas últimas 48h — revisar é voltar ao que já foi visto", async () => {
    const { skillId, pertoId } = await criarCompetenciaComCandidatas("vista-recente");
    await venceuHa(1, skillId, learnerId);

    // A própria atividade que a fila escolheria foi respondida há uma hora,
    // fora de qualquer missão.
    await db.attempt.create({
      data: {
        learnerId,
        activityId: pertoId,
        answer: {},
        outcome: "CORRECT",
        scoreRatio: 1,
        durationMs: 1000,
        idempotencyKey: "revisao-vista-ha-1-hora",
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    const aberta = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    if (!aberta.ok) return;

    const slot = await db.questRunSlot.findFirst({
      where: { questRunId: aberta.value.questRunId, order: 0 },
    });

    // Em modo objetivo isto excluiria a candidata (docs/08 §7.2); em modo
    // revisão, a exclusão de 48h não vale — é o próprio ponto da revisão.
    expect(slot?.activityId).toBe(pertoId);
  });

  it("sem nada vencido, a fila abre sem nenhuma atividade", async () => {
    const aberta = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    expect(aberta.ok).toBe(true);
    if (!aberta.ok) return;

    expect(aberta.value.atividadesRestantes).toBe(0);
    expect(await db.questRunSlot.count({ where: { questRunId: aberta.value.questRunId } })).toBe(0);
  });
});
