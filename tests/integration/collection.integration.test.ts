import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EvaluationResult, RegraDeRecompensa } from "@/activities";
import { seletorPorProximidade } from "@/activities";
import { carregarAcervo } from "@/content/loader";
import { criarSubmeterTentativa } from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { criarConcessaoPorMissao, criarConcessaoPorTentativa } from "@/modules/collection";
import { criarRepositorioPrismaDeColecionaveis } from "@/modules/collection/infrastructure/prisma-collection-repository";
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
import { criarAbrirJogada, criarAvancoDaCorrida, criarConcluirJogada } from "@/modules/quest";
import { criarLeituraPrismaDoMapa } from "@/modules/quest/infrastructure/prisma-map-reader";
import { criarRepositorioPrismaDeMissoes } from "@/modules/quest/infrastructure/prisma-quest-repository";
import { criarRepositorioPrismaDeSlots } from "@/modules/quest/infrastructure/prisma-slot-repository";
import { criarBarramento } from "@/server/event-bus";
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";
import { systemClock, type EventHandler } from "@/shared/kernel";

/**
 * Concessão de figurinhas, contra Postgres.
 *
 * O teste de unidade prova `montarGaleria` e `codigosUnicos` com dublês. Este
 * prova o que dublê nenhum alcança: que `LearnerCollectible` é gravado na
 * MESMA transação da tentativa e da conclusão da missão (`grant-collectibles.ts`
 * é `inline`, nunca `outbox`), e que repetir o evento não duplica a linha —
 * a chave primária composta é quem garante isso, não uma checagem em código.
 *
 * A montagem dos manipuladores é a mesma do composition root de propósito
 * (ver `src/composition/assessment.ts`). Um teste que monta diferente prova
 * o teste, não o sistema.
 */

const db = new PrismaClient();

const progresso = criarRepositorioPrismaDeProgresso(db);
const carteira = criarRepositorioPrismaDeCarteira(db);
const colecao = criarRepositorioPrismaDeColecionaveis(db);
const missoes = criarRepositorioPrismaDeMissoes();
const slots = criarRepositorioPrismaDeSlots();
const leitura = criarLeituraPrismaDoMapa(db);

const MANIPULADORES: readonly EventHandler[] = [
  criarCobrancaDeFolego({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeTentativa({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeRecompensa({ repositorio: carteira }),
  criarConcessaoPorTentativa({ repositorio: colecao }),
  criarAvancoDaCorrida({
    repositorio: missoes,
    slots,
    seletor: seletorPorProximidade,
    clock: systemClock,
  }),
  criarCreditoDeMissaoNaLuz({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeMissaoNaCarteira({ repositorio: carteira }),
  criarConcessaoPorMissao({ repositorio: colecao }),
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

function premio(colecionaveis: string[] = []) {
  return {
    xp: 10,
    moedas: 0,
    cristais: 0,
    diamantes: 0,
    folego: 0,
    itens: [],
    conquistas: [],
    desbloqueios: [],
    colecionaveis,
  };
}

const RECOMPENSA_COM_FIGURINHA: RegraDeRecompensa = {
  porDesfecho: {
    CORRECT: premio(["concha-da-orla"]),
    PARTIAL: premio(),
    INCORRECT: premio(),
  },
  multiplicadorPorDica: [1],
  decaimentoPorRepeticao: [1],
  aplicarFatorDeDificuldade: false,
};

const RECOMPENSA_COM_CODIGO_INEXISTENTE: RegraDeRecompensa = {
  porDesfecho: {
    CORRECT: premio(["nao-existe-no-catalogo"]),
    PARTIAL: premio(),
    INCORRECT: premio(),
  },
  multiplicadorPorDica: [1],
  decaimentoPorRepeticao: [1],
  aplicarFatorDeDificuldade: false,
};

const RECOMPENSA_SEM_FIGURINHA: RegraDeRecompensa = {
  porDesfecho: { CORRECT: premio(), PARTIAL: premio(), INCORRECT: premio() },
  multiplicadorPorDica: [1],
  decaimentoPorRepeticao: [1],
  aplicarFatorDeDificuldade: false,
};

let refDaMissao = "";
let refsDasAtividades: string[] = [];
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
  await db.collectible.deleteMany();
}

async function limparJogadas(): Promise<void> {
  await db.learnerCollectible.deleteMany();
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

beforeAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany();
  await db.learner.deleteMany();
  await db.account.deleteMany({ where: { email: "colecao@teste.local" } });
  await limparConteudo();

  const { acervo, problemas } = await carregarAcervo();
  expect(problemas).toEqual([]);

  const importar = criarImportarConteudo({ escritor: criarEscritorPrismaDeConteudo(db) });
  expect((await importar({ acervo })).ok).toBe(true);

  // A primeira missão do acervo real declara "concha-da-orla" em
  // `recompensaDaMissao` (missao-01-a-contagem-da-orla.json) — é ela que prova
  // o caminho de `quest.completed` sem precisar inventar conteúdo no teste.
  const carregada = acervo.missoes[0];
  expect(carregada).toBeDefined();

  refDaMissao = refDeMissao(carregada!);
  refsDasAtividades = carregada!.missao.fases.flatMap((fase) =>
    fase.atividades.map((a) => refDeAtividade(carregada!, fase.slug, a.slug)),
  );
  expect(refsDasAtividades.length).toBeGreaterThan(0);

  const conta = await db.account.create({
    data: { email: "colecao@teste.local", name: "Responsável de Teste" },
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

const responder = (
  chave: string,
  regraDeRecompensa: RegraDeRecompensa = RECOMPENSA_SEM_FIGURINHA,
  questRunId: string | null = null,
) =>
  submeter({
    learnerId,
    refDaAtividade: refsDasAtividades[0]!,
    resultado: ACERTOU,
    probabilidadeDeChute: 0.25,
    regraDeRecompensa,
    resposta: { escolha: 1 },
    dicasUsadas: 0,
    duracaoMs: 1500,
    questRunId,
    idempotencyKey: chave,
    avaliadaNoCliente: true,
    traceId: "trace-colecao",
  });

describe("concessão de figurinha por tentativa", () => {
  it("credita a figurinha na mesma transação da resposta", async () => {
    const resultado = await responder("chave-figurinha-1", RECOMPENSA_COM_FIGURINHA);
    expect(resultado.ok).toBe(true);

    const ganha = await db.learnerCollectible.findFirst({
      where: { learnerId },
      include: { collectible: true },
    });
    expect(ganha?.collectible.code).toBe("concha-da-orla");
  });

  it("responder de novo com a mesma chave não duplica a linha", async () => {
    await responder("chave-figurinha-2", RECOMPENSA_COM_FIGURINHA);
    await responder("chave-figurinha-2", RECOMPENSA_COM_FIGURINHA);

    expect(await db.learnerCollectible.count({ where: { learnerId } })).toBe(1);
  });

  it("prêmio sem colecionável não grava nada", async () => {
    await responder("chave-sem-figurinha", RECOMPENSA_SEM_FIGURINHA);
    expect(await db.learnerCollectible.count({ where: { learnerId } })).toBe(0);
  });

  it("código que não existe no catálogo não grava nada nem falha a resposta", async () => {
    const resultado = await responder("chave-codigo-fantasma", RECOMPENSA_COM_CODIGO_INEXISTENTE);
    expect(resultado.ok).toBe(true);
    expect(await db.learnerCollectible.count({ where: { learnerId } })).toBe(0);
  });
});

describe("concessão de figurinha ao concluir a missão", () => {
  it("credita a figurinha declarada em Quest.rewardCollectibles", async () => {
    const aberta = await abrir({ learnerId, refDaMissao, traceId: "trace-colecao" });
    expect(aberta.ok).toBe(true);
    if (!aberta.ok) return;

    for (const [indice, ref] of refsDasAtividades.entries()) {
      await submeter({
        learnerId,
        refDaAtividade: ref,
        resultado: ACERTOU,
        probabilidadeDeChute: 0.25,
        regraDeRecompensa: RECOMPENSA_SEM_FIGURINHA,
        resposta: { escolha: 1 },
        dicasUsadas: 0,
        duracaoMs: 1500,
        questRunId: aberta.value.questRunId,
        idempotencyKey: `chave-missao-${indice}`,
        avaliadaNoCliente: true,
        traceId: "trace-colecao",
      });
    }

    const resultado = await concluir({
      learnerId,
      questRunId: aberta.value.questRunId,
      refDaMissao,
      traceId: "trace-colecao",
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.value.concedidaAgora).toBe(true);

    const ganha = await db.learnerCollectible.findFirst({
      where: { learnerId },
      include: { collectible: true },
    });
    expect(ganha?.collectible.code).toBe("concha-da-orla");
  });

  it("concluir a mesma corrida duas vezes não duplica a figurinha", async () => {
    const aberta = await abrir({ learnerId, refDaMissao, traceId: "trace-colecao" });
    if (!aberta.ok) return;

    for (const [indice, ref] of refsDasAtividades.entries()) {
      await submeter({
        learnerId,
        refDaAtividade: ref,
        resultado: ACERTOU,
        probabilidadeDeChute: 0.25,
        regraDeRecompensa: RECOMPENSA_SEM_FIGURINHA,
        resposta: { escolha: 1 },
        dicasUsadas: 0,
        duracaoMs: 1500,
        questRunId: aberta.value.questRunId,
        idempotencyKey: `chave-dupla-${indice}`,
        avaliadaNoCliente: true,
        traceId: "trace-colecao",
      });
    }

    const pedido = {
      learnerId,
      questRunId: aberta.value.questRunId,
      refDaMissao,
      traceId: "trace-colecao",
    };

    await concluir(pedido);
    await concluir(pedido);

    expect(await db.learnerCollectible.count({ where: { learnerId } })).toBe(1);
  });
});
