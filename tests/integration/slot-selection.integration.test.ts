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
 * SELEÇÃO ADAPTATIVA DE SLOT (docs/08 §7) — Postgres de verdade.
 *
 * O acervo de demonstração não declara slot nenhum (docs/13, `HANDOFF.md`
 * §4), então este teste monta a própria árvore de conteúdo em vez de usar
 * `carregarAcervo()` — é a única forma de exercitar `StageActivity.activityId
 * = null` hoje. O que ele prova é a promessa da Etapa 3 passo 3: um slot
 * declarado no banco se transforma numa atividade de verdade, sem trocar de
 * figura entre uma abertura e a retomada seguinte.
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

let learnerId = "";
let accountId = "";

async function limparJogadas(): Promise<void> {
  await db.attempt.deleteMany();
  await db.questRunSlot.deleteMany();
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

/** Monta uma missão de uma fase, com uma atividade fixa e um slot dinâmico. */
async function criarMissaoComSlot(sufixo: string) {
  const academy = await db.academy.create({
    data: {
      slug: `academia-slot-${sufixo}`,
      name: "Academia de Teste",
      islandName: "Ilha de Teste",
      guardian: "TESTE",
      theme: {},
      order: 900,
    },
  });
  const subject = await db.subject.create({
    data: { academyId: academy.id, code: `TST${sufixo}`, name: "Disciplina de Teste", order: 1 },
  });
  const strand = await db.strand.create({
    data: { subjectId: subject.id, code: "T1", name: "Eixo de Teste", order: 1 },
  });
  const skill = await db.skill.create({
    data: {
      strandId: strand.id,
      name: `Competência de teste ${sufixo}`,
      description: "Competência criada só para este teste.",
      minAgeBand: "SPROUT",
      maxAgeBand: "SPROUT",
      difficultyRef: 1000,
      order: 1,
    },
  });
  const objective = await db.objective.create({
    data: { skillId: skill.id, name: `Objetivo de teste ${sufixo}`, order: 1 },
  });

  const atividadeBase = {
    objectiveId: objective.id,
    type: "MULTIPLE_CHOICE" as const,
    config: {},
    estimatedSec: 30,
    minAgeBand: "SPROUT" as const,
    maxAgeBand: "SPROUT" as const,
    status: "PUBLISHED" as const,
    locale: "pt-BR",
  };

  // `submitAttempt` busca a atividade pelo `sourceRef` (a chave que o resto do
  // sistema usa para falar de conteúdo), não pelo id — sem ele, `responder`
  // não encontraria a atividade escolhida pelo slot.
  const fixa = await db.activity.create({
    data: { ...atividadeBase, difficulty: 1000, sourceRef: `teste/slot/${sufixo}/fixa` },
  });
  const perto = await db.activity.create({
    data: { ...atividadeBase, difficulty: 1060, sourceRef: `teste/slot/${sufixo}/perto` },
  });
  const longe = await db.activity.create({
    data: { ...atividadeBase, difficulty: 1800, sourceRef: `teste/slot/${sufixo}/longe` },
  });

  const world = await db.world.create({
    data: {
      academyId: academy.id,
      slug: `mundo-slot-${sufixo}`,
      name: "Mundo de Teste",
      mapLayout: { schemaVersion: 1, nos: [], arestas: [] },
      order: 1,
    },
  });
  const chapter = await db.chapter.create({
    data: { worldId: world.id, name: "Capítulo de Teste", story: {}, order: 1 },
  });
  const quest = await db.quest.create({
    data: {
      chapterId: chapter.id,
      kind: "STORY",
      name: "Missão com slot",
      narrative: {},
      rewardXp: 10,
      rewardCoins: 0,
      requiredSkills: [],
      unlockRule: {},
      order: 1,
      sourceRef: `teste/slot/${sufixo}`,
    },
  });
  const stage = await db.stage.create({ data: { questId: quest.id, order: 0, rule: {} } });

  await db.stageActivity.create({
    data: { stageId: stage.id, order: 0, activityId: fixa.id },
  });
  await db.stageActivity.create({
    data: {
      stageId: stage.id,
      order: 1,
      activityId: null,
      slotRule: { objectiveId: objective.id, difficultyDelta: 0 },
    },
  });

  return {
    refDaMissao: `teste/slot/${sufixo}`,
    objectiveId: objective.id,
    fixaId: fixa.id,
    pertoId: perto.id,
    longeId: longe.id,
    stageId: stage.id,
  };
}

beforeAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany();
  await db.learner.deleteMany();
  await db.account.deleteMany({ where: { email: "slot@teste.local" } });
  await limparConteudo();

  const conta = await db.account.create({
    data: { email: "slot@teste.local", name: "Responsável de Teste" },
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
    questRunId,
    idempotencyKey: chave,
    avaliadaNoCliente: true,
    traceId: "trace-slot",
  });
}

describe("slot dinâmico numa missão", () => {
  it("resolve para a candidata mais próxima do alvo e grava a escolha", async () => {
    const { refDaMissao, stageId, pertoId, longeId } = await criarMissaoComSlot("resolve");

    const aberta = await abrir({ learnerId, refDaMissao, traceId: "t" });
    expect(aberta.ok).toBe(true);
    if (!aberta.ok) return;

    // A fixa mais o slot resolvido: duas atividades para responder.
    expect(aberta.value.atividadesRestantes).toBe(2);

    const linha = await db.questRunSlot.findUniqueOrThrow({
      where: { questRunId_stageId_order: { questRunId: aberta.value.questRunId, stageId, order: 1 } },
    });

    // Sem `SkillMastery`, a habilidade cai no centro da escala (1000) e o alvo
    // em 1060 — a candidata de dificuldade 1060 fica mais perto que a de 1800.
    expect(linha.activityId).toBe(pertoId);
    expect(linha.activityId).not.toBe(longeId);
  });

  it("retomar não troca a atividade que o slot já escolheu", async () => {
    const { refDaMissao, stageId } = await criarMissaoComSlot("retomar");

    const primeira = await abrir({ learnerId, refDaMissao, traceId: "t" });
    if (!primeira.ok) return;

    const antes = await db.questRunSlot.findUniqueOrThrow({
      where: {
        questRunId_stageId_order: { questRunId: primeira.value.questRunId, stageId, order: 1 },
      },
    });

    const segunda = await abrir({ learnerId, refDaMissao, traceId: "t" });
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.value.questRunId).toBe(primeira.value.questRunId);

    const depois = await db.questRunSlot.findUniqueOrThrow({
      where: {
        questRunId_stageId_order: { questRunId: primeira.value.questRunId, stageId, order: 1 },
      },
    });

    expect(depois.activityId).toBe(antes.activityId);
    expect(await db.questRunSlot.count()).toBe(1);
  });

  it("responder a fixa e o slot resolvido conclui a missão", async () => {
    const { refDaMissao, stageId, fixaId } = await criarMissaoComSlot("concluir");

    const aberta = await abrir({ learnerId, refDaMissao, traceId: "t" });
    if (!aberta.ok) return;

    const slot = await db.questRunSlot.findUniqueOrThrow({
      where: { questRunId_stageId_order: { questRunId: aberta.value.questRunId, stageId, order: 1 } },
    });

    await responder(aberta.value.questRunId, fixaId, "chave-fixa");
    await responder(aberta.value.questRunId, slot.activityId, "chave-slot");

    const resultado = await concluir({
      learnerId,
      questRunId: aberta.value.questRunId,
      refDaMissao,
      traceId: "t",
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.concedidaAgora).toBe(true);
  });

  it("não escolhe atividade que a criança viu nas últimas 48h", async () => {
    const { refDaMissao, stageId, pertoId, longeId } = await criarMissaoComSlot("recente");

    // A criança respondeu a candidata "perto" há pouco, em qualquer missão —
    // um `Attempt` avulso, sem `questRunId`, basta para contar como vista.
    await db.attempt.create({
      data: {
        learnerId,
        activityId: pertoId,
        answer: {},
        outcome: "CORRECT",
        scoreRatio: 1,
        durationMs: 1000,
        idempotencyKey: "vista-ha-1-hora",
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    const aberta = await abrir({ learnerId, refDaMissao, traceId: "t" });
    if (!aberta.ok) return;

    const slot = await db.questRunSlot.findUniqueOrThrow({
      where: { questRunId_stageId_order: { questRunId: aberta.value.questRunId, stageId, order: 1 } },
    });

    // "perto" seria a escolha natural pela proximidade — a exclusão de 48h
    // (docs/08 §7.2) empurra a seleção para "longe", a única alternativa.
    expect(slot.activityId).toBe(longeId);
  });
});
