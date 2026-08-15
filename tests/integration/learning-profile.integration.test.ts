import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EvaluationResult, RegraDeRecompensa } from "@/activities";
import { carregarAcervo } from "@/content/loader";
import { criarSubmeterTentativa } from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { criarImportarConteudo, refDeAtividade } from "@/modules/content";
import { criarEscritorPrismaDeConteudo } from "@/modules/content/infrastructure/prisma-content-writer";
import {
  criarAtualizarPerfilAPartirDeTentativa,
  criarResponderRecomendacao,
} from "@/modules/learning-profile";
import { criarRepositorioPrismaDePerfilDeAprendizagem } from "@/modules/learning-profile/infrastructure/prisma-learning-profile-repository";
import { criarBarramento } from "@/server/event-bus";
import { criarDespachanteDoOutbox } from "@/server/outbox";
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";
import { systemClock, type EventHandler } from "@/shared/kernel";

/**
 * Motor de Aprendizagem Adaptativa, contra Postgres.
 *
 * `dimension.test.ts` prova a matemática do recompute com dublês. Este prova
 * o que dublê nenhum alcança: que a pipeline real (resposta → outbox →
 * despachante) recomputa a dimensão certa a partir de `Attempt` de verdade,
 * e que reprocessar a mesma mensagem do outbox não conta a mesma tentativa
 * duas vezes — a mesma propriedade de idempotência-por-recomputação já
 * provada para conquistas.
 *
 * Nenhuma atividade do acervo real declara característica ainda (isso é
 * trabalho da Fase 2). Este teste marca uma atividade importada com
 * `visualSupportLevel: "alto"` diretamente no banco — o mesmo que o
 * importador de conteúdo fará quando a Fase 2 autorar a primeira variante.
 */

const db = new PrismaClient();

const perfil = criarRepositorioPrismaDePerfilDeAprendizagem(db);

const MANIPULADORES: readonly EventHandler[] = [
  criarAtualizarPerfilAPartirDeTentativa({ repositorio: perfil, clock: systemClock }),
] as readonly EventHandler[];

const unidadeDeTrabalho = criarUnidadeDeTrabalho(db);
const barramento = criarBarramento(MANIPULADORES);
const despachante = criarDespachanteDoOutbox(db, MANIPULADORES);

const submeter = criarSubmeterTentativa({
  repositorio: criarRepositorioPrismaDeAvaliacao(db),
  unidadeDeTrabalho,
  barramento,
  clock: systemClock,
  dormir: async () => {},
});

function resultado(scoreRatio: number): EvaluationResult {
  return scoreRatio === 1
    ? { outcome: "CORRECT", scoreRatio: 1, feedback: { tom: "CELEBRA", mensagem: "Isso!" } }
    : {
        outcome: "INCORRECT",
        scoreRatio,
        feedback: { tom: "ORIENTA", mensagem: "Quase!", ensino: "Tente de novo." },
      };
}

function premio() {
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

const RECOMPENSA: RegraDeRecompensa = {
  porDesfecho: { CORRECT: premio(), PARTIAL: premio(), INCORRECT: premio() },
  multiplicadorPorDica: [1],
  decaimentoPorRepeticao: [1],
  aplicarFatorDeDificuldade: false,
};

let refDaAtividadeComSuporteVisual = "";
let activityIdComSuporteVisual = "";
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
}

async function limparJogadas(): Promise<void> {
  await db.recommendation.deleteMany();
  await db.learningProfileEvent.deleteMany();
  await db.learningProfileDimension.deleteMany();
  await db.learningProfile.deleteMany();
  await db.attempt.deleteMany();
  await db.outboxMessage.deleteMany();
  await db.learningEvent.deleteMany();
}

beforeAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany();
  await db.learner.deleteMany();
  await db.account.deleteMany({ where: { email: "perfil-aprendizagem@teste.local" } });
  await limparConteudo();

  const { acervo, problemas } = await carregarAcervo();
  expect(problemas).toEqual([]);

  const importar = criarImportarConteudo({ escritor: criarEscritorPrismaDeConteudo(db) });
  expect((await importar({ acervo })).ok).toBe(true);

  const carregada = acervo.missoes[0];
  expect(carregada).toBeDefined();
  const primeiraFase = carregada!.missao.fases[0]!;
  const primeiraAtividade = primeiraFase.atividades[0]!;
  refDaAtividadeComSuporteVisual = refDeAtividade(carregada!, primeiraFase.slug, primeiraAtividade.slug);

  const linha = await db.activity.findUniqueOrThrow({
    where: { sourceRef: refDaAtividadeComSuporteVisual },
  });
  activityIdComSuporteVisual = linha.id;

  // Simula o que a Fase 2 vai fazer de verdade: declarar a característica no
  // conteúdo, mirrorizada pelo importador. Aqui, direto no banco.
  await db.activity.update({
    where: { id: activityIdComSuporteVisual },
    data: { visualSupportLevel: "alto" },
  });

  const conta = await db.account.create({
    data: { email: "perfil-aprendizagem@teste.local", name: "Responsável de Teste" },
  });
  accountId = conta.id;

  const crianca = await db.learner.create({
    data: {
      displayName: "Teste",
      birthYear: 2019,
      ageBand: "SPROUT",
      avatarConfig: { schemaVersion: 1 },
      settings: { create: {} },
      guardians: { create: { accountId: conta.id, relation: "mãe", isPrimary: true } },
    },
  });
  learnerId = crianca.id;
});

beforeEach(async () => {
  await limparJogadas();
  // `pictogramsEnabled` é o campo que os testes de recomendação observam —
  // sempre volta ao padrão (desligado) entre um teste e outro.
  await db.learnerSettings.update({ where: { learnerId }, data: { pictogramsEnabled: false } });
});

afterAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany({ where: { accountId } });
  await db.learner.deleteMany({ where: { id: learnerId } });
  await db.account.deleteMany({ where: { id: accountId } });
  await limparConteudo();
  await db.$disconnect();
});

async function responder(sufixo: string, indice: number, scoreRatio: number): Promise<void> {
  const submissao = await submeter({
    learnerId,
    refDaAtividade: refDaAtividadeComSuporteVisual,
    resultado: resultado(scoreRatio),
    probabilidadeDeChute: 0.25,
    regraDeRecompensa: RECOMPENSA,
    resposta: { escolha: 1 },
    dicasUsadas: 0,
    duracaoMs: 1500,
    presentationTag: null,
    questRunId: null,
    idempotencyKey: `perfil-${sufixo}-${indice}`,
    avaliadaNoCliente: true,
    traceId: "trace-perfil",
  });
  if (!submissao.ok) throw new Error("não registrou a tentativa");
}

describe("pipeline real: tentativa avaliada → outbox → perfil de aprendizagem", () => {
  it("recomputa suporteVisual a partir das tentativas na atividade que o declara", async () => {
    await responder("pipeline-1", 0, 1);
    await responder("pipeline-1", 1, 1);

    // Antes do despachante rodar, o outbox tem a mensagem, mas o perfil
    // ainda não existe — mesma lógica de `outbox`, não `inline`.
    expect(await db.learningProfile.count({ where: { learnerId } })).toBe(0);

    const relatorio = await despachante.despachar();
    expect(relatorio.falhadas).toBe(0);

    const { dimensions } = await perfil.lerPerfil(learnerId, null);
    const suporteVisual = dimensions.get("suporteVisual");
    expect(suporteVisual?.value).toBeCloseTo(1);
    expect(suporteVisual?.observationsCount).toBe(2);
  });

  it("uma atividade sem característica declarada não gera nenhuma dimensão", async () => {
    // A própria atividade usada nos outros testes, mas SEM a marcação —
    // simula o resto do acervo hoje.
    await db.activity.update({
      where: { id: activityIdComSuporteVisual },
      data: { visualSupportLevel: null },
    });

    await responder("sem-caracteristica", 0, 1);
    const relatorio = await despachante.despachar();
    expect(relatorio.falhadas).toBe(0);

    expect(await db.learningProfile.count({ where: { learnerId } })).toBe(0);

    await db.activity.update({
      where: { id: activityIdComSuporteVisual },
      data: { visualSupportLevel: "alto" },
    });
  });

  it("despachar duas vezes a mesma mensagem não conta a tentativa duas vezes", async () => {
    await responder("duas-vezes", 0, 1);
    await despachante.despachar();

    const { dimensions: primeira } = await perfil.lerPerfil(learnerId, null);
    const antes = primeira.get("suporteVisual");
    expect(antes?.observationsCount).toBe(1);

    // Mensagem já processada — despachar de novo não pega a mesma, mas o
    // teste abaixo cobre o caso de duas execuções concorrentes processando a
    // mesma mensagem (o cenário real que faz o outbox ser at-least-once).
    const relatorio = await despachante.despachar();
    expect(relatorio.processadas).toBe(0);

    const { dimensions: segunda } = await perfil.lerPerfil(learnerId, null);
    expect(segunda.get("suporteVisual")?.observationsCount).toBe(1);
  });
});

describe("recompute é idempotente por construção", () => {
  it("chamar o handler duas vezes com o mesmo estado de Attempt recomputa o mesmo valor", async () => {
    await responder("recompute-1", 0, 1);
    await responder("recompute-1", 1, 0);

    const manipulador = criarAtualizarPerfilAPartirDeTentativa({
      repositorio: perfil,
      clock: systemClock,
    });

    const evento = {
      name: "assessment.attempt_evaluated" as const,
      occurredAt: new Date(),
      traceId: "trace-recompute",
      payload: {
        learnerId,
        activityId: activityIdComSuporteVisual,
        objectiveId: "irrelevante",
        skillId: "irrelevante",
        questRunId: null,
        outcome: "CORRECT" as const,
        scoreRatio: 1,
        primeiraVez: false,
        dicasUsadas: 0,
        duracaoMs: 1000,
        presentationTag: null,
        premio: null,
        dominio: null,
        idempotencyKey: "chave-simulada",
      },
    };

    await db.$transaction((tx) => manipulador.tratar(evento, tx as never));
    const { dimensions: primeira } = await perfil.lerPerfil(learnerId, null);

    await db.$transaction((tx) => manipulador.tratar(evento, tx as never));
    const { dimensions: segunda } = await perfil.lerPerfil(learnerId, null);

    expect(segunda.get("suporteVisual")).toEqual(primeira.get("suporteVisual"));
  });
});

describe("Fase 3b — recomendação de acessibilidade", () => {
  it("cruzar o limiar de evidência gera uma sugestão, e reprocessar não duplica", async () => {
    // n=8 dá confiança 8/(8+8) = 0.5 — exatamente o limiar de ação.
    for (let i = 0; i < 8; i += 1) {
      await responder("recomendacao-cria", i, 1);
    }

    const primeiroDespacho = await despachante.despachar();
    expect(primeiroDespacho.falhadas).toBe(0);

    const pendentes = await db.recommendation.findMany({
      where: { learnerId, kind: "ACCESSIBILITY_SUGGESTION", consumedAt: null },
    });
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0]?.reason.length).toBeGreaterThan(0);
    expect(pendentes[0]?.payload).toMatchObject({
      dimensionKey: "suporteVisual",
      settingField: "pictogramsEnabled",
      suggestedValue: true,
    });

    // Mais uma tentativa qualificada: outro evento no outbox, mesma
    // dimensão já com sugestão pendente — não deveria criar uma segunda.
    await responder("recomendacao-cria", 8, 1);
    await despachante.despachar();

    const aindaPendentes = await db.recommendation.findMany({
      where: { learnerId, kind: "ACCESSIBILITY_SUGGESTION", consumedAt: null },
    });
    expect(aindaPendentes).toHaveLength(1);
    expect(aindaPendentes[0]?.id).toBe(pendentes[0]?.id);
  });

  it("não sugere o que já está ligado", async () => {
    await db.learnerSettings.update({
      where: { learnerId },
      data: { pictogramsEnabled: true },
    });

    for (let i = 0; i < 8; i += 1) {
      await responder("recomendacao-ja-ligado", i, 1);
    }
    await despachante.despachar();

    const pendentes = await db.recommendation.findMany({
      where: { learnerId, kind: "ACCESSIBILITY_SUGGESTION", consumedAt: null },
    });
    expect(pendentes).toHaveLength(0);
  });

  it("responder aceitando devolve a configuração a aplicar e marca consumida; responder de novo falha", async () => {
    for (let i = 0; i < 8; i += 1) {
      await responder("recomendacao-responder", i, 1);
    }
    await despachante.despachar();

    const [recomendacao] = await db.recommendation.findMany({
      where: { learnerId, kind: "ACCESSIBILITY_SUGGESTION", consumedAt: null },
    });
    expect(recomendacao).toBeDefined();

    const responderRecomendacao = criarResponderRecomendacao({ repositorio: perfil, unidadeDeTrabalho });

    const aceite = await responderRecomendacao({
      learnerId,
      recommendationId: recomendacao!.id,
      aceitar: true,
    });
    expect(aceite.ok).toBe(true);
    if (aceite.ok) {
      expect(aceite.value.aceita).toBe(true);
      expect(aceite.value.configuracao).toEqual({
        settingField: "pictogramsEnabled",
        suggestedValue: true,
      });
    }

    const linha = await db.recommendation.findUniqueOrThrow({ where: { id: recomendacao!.id } });
    expect(linha.consumedAt).not.toBeNull();

    // Responder de novo — já consumida — falha, não processa duas vezes.
    const segunda = await responderRecomendacao({
      learnerId,
      recommendationId: recomendacao!.id,
      aceitar: true,
    });
    expect(segunda.ok).toBe(false);
  });
});
