import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EvaluationResult, RegraDeRecompensa } from "@/activities";
import { seletorPorProximidade } from "@/activities";
import { carregarAcervo } from "@/content/loader";
import { criarSubmeterTentativa } from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { criarImportarConteudo, refDeAtividade, refDeMissao } from "@/modules/content";
import { criarEscritorPrismaDeConteudo } from "@/modules/content/infrastructure/prisma-content-writer";
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
import {
  CUSTO_DE_FOLEGO,
  criarAbrirJogada,
  criarAvancoDaCorrida,
  criarConcluirJogada,
  criarMontarMapa,
} from "@/modules/quest";
import { criarLeituraPrismaDoMapa } from "@/modules/quest/infrastructure/prisma-map-reader";
import { criarRepositorioPrismaDeMissoes } from "@/modules/quest/infrastructure/prisma-quest-repository";
import { criarRepositorioPrismaDeSlots } from "@/modules/quest/infrastructure/prisma-slot-repository";
import { criarBarramento } from "@/server/event-bus";
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";
import { FOLEGO } from "@/modules/progression";
import { systemClock, type EventHandler } from "@/shared/kernel";

/**
 * O ciclo da missão, contra Postgres.
 *
 * É aqui que a promessa central de `QuestRun` é verificada — **fechar o app não
 * pode custar progresso** — junto com as três que andam com ela: começar cobra
 * Fôlego, retomar não cobra, e concluir rende uma vez só.
 *
 * A montagem abaixo é a mesma do composition root de propósito. Um teste que
 * monta os manipuladores de outro jeito prova o teste, não o sistema.
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

const ACERTOU: EvaluationResult = {
  outcome: "CORRECT",
  scoreRatio: 1,
  feedback: { tom: "CELEBRA", mensagem: "Isso!" },
};

const RECOMPENSA: RegraDeRecompensa = {
  porDesfecho: {
    CORRECT: {
      xp: 10,
      moedas: 2,
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

let refDaMissao = "";
let refsDasAtividades: string[] = [];
let tipoDaMissao = "";
let learnerId = "";
let accountId = "";

async function limparJogadas(): Promise<void> {
  await db.attempt.deleteMany();
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
}

beforeAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany();
  await db.learner.deleteMany();
  await db.account.deleteMany({ where: { email: "missao@teste.local" } });
  await limparConteudo();

  const { acervo } = await carregarAcervo();
  const importar = criarImportarConteudo({ escritor: criarEscritorPrismaDeConteudo(db) });
  expect((await importar({ acervo })).ok).toBe(true);

  const carregada = acervo.missoes[0];
  expect(carregada).toBeDefined();

  refDaMissao = refDeMissao(carregada!);
  tipoDaMissao = carregada!.missao.tipo;
  refsDasAtividades = carregada!.missao.fases.flatMap((fase) =>
    fase.atividades.map((a) => refDeAtividade(carregada!, fase.slug, a.slug)),
  );
  expect(refsDasAtividades.length).toBeGreaterThan(1);

  const conta = await db.account.create({
    data: { email: "missao@teste.local", name: "Responsável de Teste" },
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

/** Responde uma atividade dentro da jogada. */
async function responder(questRunId: string, ref: string, chave: string) {
  return submeter({
    learnerId,
    refDaAtividade: ref,
    resultado: ACERTOU,
    probabilidadeDeChute: 0.25,
    regraDeRecompensa: RECOMPENSA,
    resposta: { escolha: 1 },
    dicasUsadas: 0,
    duracaoMs: 3000,
    questRunId,
    idempotencyKey: chave,
    avaliadaNoCliente: true,
    traceId: "trace-missao",
  });
}

const abrirMissao = () => abrir({ learnerId, refDaMissao, traceId: "trace-missao" });

describe("o ciclo de uma missão", () => {
  it("abrir cria a jogada e cobra o Fôlego do tipo da missão", async () => {
    const aberta = await abrirMissao();

    expect(aberta.ok).toBe(true);
    if (!aberta.ok) return;

    expect(aberta.value.retomada).toBe(false);
    expect(aberta.value.retomarNoIndice).toBe(0);
    expect(aberta.value.custoDeFolego).toBe(
      CUSTO_DE_FOLEGO[tipoDaMissao as keyof typeof CUSTO_DE_FOLEGO],
    );

    const estado = await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } });
    expect(estado.energy).toBe(FOLEGO.maximo - aberta.value.custoDeFolego);
  });

  it("retomar devolve a mesma jogada e NÃO cobra de novo", async () => {
    const primeira = await abrirMissao();
    expect(primeira.ok).toBe(true);
    if (!primeira.ok) return;

    const folegoDepoisDaPrimeira = (
      await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } })
    ).energy;

    const segunda = await abrirMissao();
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;

    // Mesma corrida, custo zero. Cobrar de quem volta ensinaria a criança a
    // não fechar o app — o oposto do que `QuestRun` existe para permitir.
    expect(segunda.value.questRunId).toBe(primeira.value.questRunId);
    expect(segunda.value.retomada).toBe(true);
    expect(segunda.value.custoDeFolego).toBe(0);

    const depois = await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } });
    expect(depois.energy).toBe(folegoDepoisDaPrimeira);
    expect(await db.questRun.count()).toBe(1);
  });

  it("retomar volta exatamente onde ela parou", async () => {
    const aberta = await abrirMissao();
    if (!aberta.ok) return;

    await responder(aberta.value.questRunId, refsDasAtividades[0]!, "chave-retomada-1");

    const retomada = await abrirMissao();
    expect(retomada.ok).toBe(true);
    if (!retomada.ok) return;

    // A posição vem das tentativas gravadas, não de estado do cliente — que é
    // exatamente o que não sobrevive a fechar o app.
    expect(retomada.value.retomarNoIndice).toBe(1);
    expect(retomada.value.atividadesRestantes).toBe(refsDasAtividades.length - 1);
  });

  it("a corrida acompanha as respostas: pontuação e fase", async () => {
    const aberta = await abrirMissao();
    if (!aberta.ok) return;

    await responder(aberta.value.questRunId, refsDasAtividades[0]!, "chave-avanco-1");

    const corrida = await db.questRun.findUniqueOrThrow({
      where: { id: aberta.value.questRunId },
    });

    expect(corrida.score).toBeGreaterThan(0);
    expect(corrida.status).toBe("IN_PROGRESS");
  });

  it("concluir antes de responder tudo é recusado", async () => {
    const aberta = await abrirMissao();
    if (!aberta.ok) return;

    await responder(aberta.value.questRunId, refsDasAtividades[0]!, "chave-incompleta");

    const resultado = await concluir({
      learnerId,
      questRunId: aberta.value.questRunId,
      refDaMissao,
      traceId: "trace-missao",
    });

    /*
     * Sem esta recusa, um toque forjado concederia `Quest.rewardXp` sem
     * responder nada — e a economia inteira perderia o sentido.
     */
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("quest.not_finished");

    const corrida = await db.questRun.findUniqueOrThrow({
      where: { id: aberta.value.questRunId },
    });
    expect(corrida.rewardsGrantedAt).toBeNull();
  });

  it("responder tudo e concluir credita Luz, moeda e a Trilha de Luz", async () => {
    const aberta = await abrirMissao();
    if (!aberta.ok) return;

    for (const [indice, ref] of refsDasAtividades.entries()) {
      await responder(aberta.value.questRunId, ref, `chave-completa-${indice}`);
    }

    const antes = await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } });

    const resultado = await concluir({
      learnerId,
      questRunId: aberta.value.questRunId,
      refDaMissao,
      traceId: "trace-missao",
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value.concedidaAgora).toBe(true);

    const depois = await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } });

    expect(depois.totalXp).toBe(antes.totalXp + resultado.value.premio.xp);
    // A Trilha anda **aqui**, e não a cada resposta (docs/08 §6).
    expect(antes.streakDays).toBe(0);
    expect(depois.streakDays).toBe(1);

    const corrida = await db.questRun.findUniqueOrThrow({
      where: { id: aberta.value.questRunId },
    });
    expect(corrida.status).toBe("COMPLETED");
    expect(corrida.rewardsGrantedAt).not.toBeNull();

    const lancamentos = await db.ledgerEntry.findMany({
      where: { learnerId, reason: "QUEST_REWARD" },
    });
    expect(lancamentos.length).toBe(resultado.value.premio.moedas > 0 ? 1 : 0);
  });

  it("concluir duas vezes credita uma vez só", async () => {
    const aberta = await abrirMissao();
    if (!aberta.ok) return;

    for (const [indice, ref] of refsDasAtividades.entries()) {
      await responder(aberta.value.questRunId, ref, `chave-dupla-${indice}`);
    }

    const pedido = {
      learnerId,
      questRunId: aberta.value.questRunId,
      refDaMissao,
      traceId: "trace-missao",
    };

    const primeira = await concluir(pedido);
    const luzDepoisDaPrimeira = (
      await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } })
    ).totalXp;

    const segunda = await concluir(pedido);

    expect(primeira.ok && primeira.value.concedidaAgora).toBe(true);
    expect(segunda.ok && segunda.value.concedidaAgora).toBe(false);

    // `rewardsGrantedAt` é a marca; a segunda chamada não publica evento nenhum.
    const depois = await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } });
    expect(depois.totalXp).toBe(luzDepoisDaPrimeira);
    expect(await db.ledgerEntry.count({ where: { reason: "QUEST_REWARD" } })).toBeLessThanOrEqual(2);
  });

  it("a jogada de outra criança não pode ser fechada", async () => {
    const aberta = await abrirMissao();
    if (!aberta.ok) return;

    const resultado = await concluir({
      learnerId: "lrn_de_outra_crianca",
      questRunId: aberta.value.questRunId,
      refDaMissao,
      traceId: "trace-missao",
    });

    // Sem esta checagem, um id qualquer faria a recompensa cair na conta errada.
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("quest.run_not_found");
  });

  it("sem Fôlego, a missão abre assim mesmo", async () => {
    /*
     * A regra ética de docs/08 §4, no caminho real. Energia zerada corta o
     * cosmético e a moeda; jamais impede jogar.
     */
    await db.learnerProgress.create({
      data: { learnerId, energy: 0, energyUpdatedAt: new Date() },
    });

    const aberta = await abrirMissao();

    expect(aberta.ok).toBe(true);
    const estado = await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } });
    // Piso em zero: saldo negativo de Fôlego não existe no produto.
    expect(estado.energy).toBe(0);
  });

  it("missão trancada é recusada no servidor, não só escondida no mapa", async () => {
    /*
     * O cadeado precisa valer aqui. Sem esta guarda bastaria montar a
     * requisição na mão para pular a progressão inteira — e encarar o Colosso
     * sem ter aprendido o que ele cobra.
     */
    await db.quest.updateMany({
      where: { sourceRef: refDaMissao },
      data: { unlockRule: { level: { gte: 99 } } },
    });

    const resultado = await abrirMissao();

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("quest.locked");
    expect(await db.questRun.count()).toBe(0);

    await db.quest.updateMany({ where: { sourceRef: refDaMissao }, data: { unlockRule: {} } });
  });

  it("uma jogada já aberta não é interrompida por uma regra nova", async () => {
    const aberta = await abrirMissao();
    expect(aberta.ok).toBe(true);

    // A regra muda depois que ela já começou.
    await db.quest.updateMany({
      where: { sourceRef: refDaMissao },
      data: { unlockRule: { level: { gte: 99 } } },
    });

    const retomada = await abrirMissao();

    // Quem começou antes da regra mudar não pode ficar preso no meio.
    expect(retomada.ok).toBe(true);
    if (retomada.ok) expect(retomada.value.retomada).toBe(true);

    await db.quest.updateMany({ where: { sourceRef: refDaMissao }, data: { unlockRule: {} } });
  });

  it("o mapa diz o que falta, não só que está trancada", async () => {
    await db.quest.updateMany({
      where: { sourceRef: refDaMissao },
      data: { unlockRule: { level: { gte: 12 } } },
    });

    const mundos = await criarMontarMapa({ leitura })(learnerId);
    const missao = mundos
      .flatMap((m) => m.capitulos)
      .flatMap((c) => c.missoes)
      .find((m) => m.ref === refDaMissao);

    expect(missao).toBeDefined();
    expect(missao!.jogabilidade.jogavel).toBe(false);
    // docs/08 §3: o mapa mostra o caminho, nunca só um cadeado.
    expect(missao!.jogabilidade.pendencias).toEqual([
      { tipo: "NIVEL", exigido: 12, atual: 1 },
    ]);

    await db.quest.updateMany({ where: { sourceRef: refDaMissao }, data: { unlockRule: {} } });
  });

  it("o mapa marca a missão em andamento e a concluída", async () => {
    const aberta = await abrirMissao();
    if (!aberta.ok) return;

    const emAndamento = (await criarMontarMapa({ leitura })(learnerId))
      .flatMap((m) => m.capitulos)
      .flatMap((c) => c.missoes)
      .find((m) => m.ref === refDaMissao);
    expect(emAndamento?.emAndamento).toBe(true);
    expect(emAndamento?.concluida).toBe(false);

    for (const [indice, ref] of refsDasAtividades.entries()) {
      await responder(aberta.value.questRunId, ref, `chave-mapa-${indice}`);
    }
    await concluir({
      learnerId,
      questRunId: aberta.value.questRunId,
      refDaMissao,
      traceId: "trace-missao",
    });

    const depois = (await criarMontarMapa({ leitura })(learnerId))
      .flatMap((m) => m.capitulos)
      .flatMap((c) => c.missoes)
      .find((m) => m.ref === refDaMissao);

    expect(depois?.concluida).toBe(true);
    expect(depois?.emAndamento).toBe(false);
    // Concluída não tranca: rejogar para praticar é livre (docs/08 §3).
    expect(depois?.jogabilidade.jogavel).toBe(true);
  });

  it("missão fora do banco é recusada com instrução acionável", async () => {
    const resultado = await abrir({
      learnerId,
      refDaMissao: "academia/inexistente/SPROUT/n1/m1/missao-fantasma",
      traceId: "trace-missao",
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("quest.not_published");
  });
});
