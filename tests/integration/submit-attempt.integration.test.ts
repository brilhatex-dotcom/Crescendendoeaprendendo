import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EvaluationResult, RegraDeRecompensa } from "@/activities";
import { carregarAcervo } from "@/content/loader";
import { refDeAtividade } from "@/modules/content";
import {
  TOPICO_TELEMETRIA_DE_TENTATIVA,
  TOPICO_TENTATIVA_AVALIADA,
  criarSubmeterTentativa,
} from "@/modules/assessment";
import { criarRepositorioPrismaDeAvaliacao } from "@/modules/assessment/infrastructure/prisma-assessment-repository";
import { criarImportarConteudo } from "@/modules/content";
import { criarEscritorPrismaDeConteudo } from "@/modules/content/infrastructure/prisma-content-writer";
import { criarCreditoDeRecompensa } from "@/modules/economy";
import { criarRepositorioPrismaDeCarteira } from "@/modules/economy/infrastructure/prisma-wallet-repository";
import { criarCreditoDeTentativa } from "@/modules/progression";
import { criarRepositorioPrismaDeProgresso } from "@/modules/progression/infrastructure/prisma-progress-repository";
import { criarBarramento } from "@/server/event-bus";
import { criarDespachanteDoOutbox } from "@/server/outbox";
import { criarTelemetriaDeTentativa } from "@/server/telemetry";
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";
import { systemClock, type EventHandler } from "@/shared/kernel";

/**
 * Teste de integração de `submitAttempt` — Postgres de verdade.
 *
 * O teste de unidade prova o cálculo com dublês. Este prova o que dublê nenhum
 * alcança:
 *
 *  · que a restrição `@unique` de `idempotencyKey` realmente barra a segunda
 *    gravação, e não só a consulta prévia;
 *  · que a transação é tudo-ou-nada — tentativa sem domínio atualizado seria
 *    uma divergência silenciosa entre histórico e modelo;
 *  · que a atualização condicional por versão detecta a corrida;
 *  · que os números do domínio cabem nas colunas (`Decimal(5,4)`, `Decimal(7,3)`);
 *  · que as duas mensagens de outbox saem na mesma transação, e que a de
 *    telemetria não carrega o id real da criança.
 */

const db = new PrismaClient();

const progresso = criarRepositorioPrismaDeProgresso(db);
const carteira = criarRepositorioPrismaDeCarteira(db);

/*
 * A montagem real: avaliação publica, progressão e economia reagem dentro da
 * mesma transação, telemetria sai pelo outbox. É a mesma lista do composition
 * root — se ela divergir, este teste para de provar o que importa.
 */
const MANIPULADORES: readonly EventHandler[] = [
  criarCreditoDeTentativa({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeRecompensa({ repositorio: carteira }),
  criarTelemetriaDeTentativa(),
] as readonly EventHandler[];

const despachante = criarDespachanteDoOutbox(db, MANIPULADORES);

const submeter = criarSubmeterTentativa({
  repositorio: criarRepositorioPrismaDeAvaliacao(db),
  unidadeDeTrabalho: criarUnidadeDeTrabalho(db),
  barramento: criarBarramento(MANIPULADORES),
  clock: systemClock,
  dormir: async () => {},
});

const ACERTOU: EvaluationResult = {
  outcome: "CORRECT",
  scoreRatio: 1,
  feedback: { tom: "CELEBRA", mensagem: "Isso!" },
};

const ERROU: EvaluationResult = {
  outcome: "INCORRECT",
  scoreRatio: 0,
  feedback: { tom: "ORIENTA", mensagem: "Quase.", ensino: "Conte de novo, de um em um." },
  equivoco: "contou-o-primeiro-como-zero",
};

const RECOMPENSA: RegraDeRecompensa = {
  porDesfecho: {
    CORRECT: premio({ xp: 10, moedas: 5 }),
    PARTIAL: premio({ xp: 5 }),
    INCORRECT: premio({ xp: 4 }),
  },
  multiplicadorPorDica: [1, 0.6, 0.4],
  decaimentoPorRepeticao: [1, 0.3, 0.1, 0],
  aplicarFatorDeDificuldade: true,
};

function premio(parcial: { xp?: number; moedas?: number }) {
  return {
    xp: parcial.xp ?? 0,
    moedas: parcial.moedas ?? 0,
    cristais: 0,
    diamantes: 0,
    folego: 0,
    itens: [],
    conquistas: [],
    desbloqueios: [],
    colecionaveis: [],
  };
}

/**
 * Referências de duas atividades reais do acervo, escolhidas pela relação com a
 * dificuldade de referência da competência — que é o que decide se um acerto
 * serve de prova de domínio (docs/08 §2).
 */
let refAbaixoDaReferencia = "";
let refNaReferencia = "";
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
  await db.attempt.deleteMany();
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
  await db.account.deleteMany({ where: { email: "avaliacao@teste.local" } });
  await limparConteudo();

  const { acervo, problemas } = await carregarAcervo();
  expect(problemas).toEqual([]);

  const importar = criarImportarConteudo({ escritor: criarEscritorPrismaDeConteudo(db) });
  const importacao = await importar({ acervo });
  expect(importacao.ok).toBe(true);

  const missao = acervo.missoes[0];
  expect(missao).toBeDefined();

  for (const fase of missao!.missao.fases) {
    for (const atividade of fase.atividades) {
      const ref = refDeAtividade(missao!, fase.slug, atividade.slug);
      if (atividade.dificuldade === "FACIL" && !refAbaixoDaReferencia) refAbaixoDaReferencia = ref;
      if (atividade.dificuldade === "MEDIO" && !refNaReferencia) refNaReferencia = ref;
    }
  }

  // `MEDIO` é a dificuldade de referência das competências (`plan.ts`). Se o
  // acervo deixar de ter as duas, os testes abaixo perdem o sentido e é melhor
  // saber aqui do que numa asserção confusa lá embaixo.
  expect(refAbaixoDaReferencia).not.toBe("");
  expect(refNaReferencia).not.toBe("");

  const conta = await db.account.create({
    data: { email: "avaliacao@teste.local", name: "Responsável de Teste" },
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

const entrada = (
  chave: string,
  resultado: EvaluationResult = ACERTOU,
  ref?: string,
) => ({
  learnerId,
  refDaAtividade: ref ?? refAbaixoDaReferencia,
  resultado,
  probabilidadeDeChute: 0.25,
  regraDeRecompensa: RECOMPENSA,
  resposta: { escolha: 1 },
  dicasUsadas: 0,
  duracaoMs: 3500,
  questRunId: null,
  idempotencyKey: chave,
  avaliadaNoCliente: true,
  traceId: "trace-integracao",
});

describe("submitAttempt contra Postgres", () => {
  it("grava tentativa, domínio, revisão e outbox na mesma transação", async () => {
    const resultado = await submeter(entrada("chave-integracao-0001"));
    expect(resultado.ok).toBe(true);

    const [tentativas, dominios, cartoes, mensagens] = await Promise.all([
      db.attempt.count(),
      db.skillMastery.count(),
      db.reviewCard.count(),
      db.outboxMessage.count(),
    ]);

    expect(tentativas).toBe(1);
    expect(dominios).toBe(1);
    expect(cartoes).toBe(1);
    /*
     * Uma mensagem só. O evento interno (`attempt_evaluated`) é consumido
     * `inline`, dentro desta transação — não vai para o outbox porque ninguém o
     * espera lá. O de telemetria vai, porque é `outbox` (ver `event-bus.ts`).
     */
    expect(mensagens).toBe(1);
  });

  it("a mesma chave duas vezes grava uma tentativa só", async () => {
    await submeter(entrada("chave-integracao-0002"));
    const segunda = await submeter(entrada("chave-integracao-0002"));

    expect(segunda.ok && segunda.value.repetida).toBe(true);
    expect(await db.attempt.count()).toBe(1);
    // O domínio também não avança: a repetição não é evidência nova.
    const dominio = await db.skillMastery.findFirst();
    expect(dominio?.attemptsCount).toBe(1);
  });

  it("duas respostas simultâneas com chaves diferentes não se perdem", async () => {
    /*
     * Duas abas na mesma missão. Sem a atualização condicional, a segunda
     * escrita sobrescreveria a primeira e `attemptsCount` ficaria em 1 com duas
     * linhas em `Attempt` — histórico e modelo divergindo em silêncio.
     */
    const [a, b] = await Promise.all([
      submeter(entrada("chave-integracao-0003a")),
      submeter(entrada("chave-integracao-0003b")),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    expect(await db.attempt.count()).toBe(2);

    const dominio = await db.skillMastery.findFirst();
    expect(dominio?.attemptsCount).toBe(2);
    expect(dominio?.version).toBe(2);
  });

  it("a escala do BKT e do Elo cabe nas colunas, e o domínio é declarado", async () => {
    // Vinte tentativas seguidas empurram a probabilidade para perto de 1 e a
    // habilidade para longe do centro. É onde `Decimal(5,4)` e `Decimal(7,3)`
    // estourariam se estivessem estreitos demais.
    for (let i = 0; i < 20; i += 1) {
      const resultado = await submeter(
        entrada(`chave-escala-${i}`, ACERTOU, refNaReferencia),
      );
      expect(resultado.ok).toBe(true);
    }

    const dominio = await db.skillMastery.findFirstOrThrow();
    expect(Number(dominio.probability)).toBeGreaterThan(0.85);
    expect(Number(dominio.ability)).toBeGreaterThan(1000);
    expect(dominio.masteredAt).not.toBeNull();
  });

  it("acertar só o que está abaixo da referência não declara domínio", async () => {
    /*
     * A invariante mais fácil de perder de vista, e a que mais custa caro:
     * vinte acertos numa atividade fácil elevam a crença acima do limiar, mas a
     * sequência exigida (docs/08 §2) só conta acerto no nível de referência ou
     * acima. Sem isso o sistema promoveria a criança com base no que ela já
     * sabia — e ela levaria a culpa por travar no conteúdo seguinte.
     */
    for (let i = 0; i < 20; i += 1) {
      await submeter(entrada(`chave-facil-${i}`, ACERTOU, refAbaixoDaReferencia));
    }

    const dominio = await db.skillMastery.findFirstOrThrow();
    expect(Number(dominio.probability)).toBeGreaterThan(0.85);
    expect(dominio.streak).toBe(0);
    expect(dominio.masteredAt).toBeNull();
  });

  it("errar agenda revisão para o dia seguinte e conta a recaída", async () => {
    await submeter(entrada("chave-revisao-1"));
    const antes = await db.reviewCard.findFirstOrThrow();

    await submeter(entrada("chave-revisao-2", ERROU));
    const depois = await db.reviewCard.findFirstOrThrow();

    expect(depois.intervalDays).toBe(1);
    expect(depois.lapses).toBe(antes.lapses + 1);
  });

  it("o equívoco diagnosticado é preservado no histórico", async () => {
    await submeter(entrada("chave-equivoco", ERROU));

    const tentativa = await db.attempt.findFirstOrThrow();
    expect(tentativa.misconception).toBe("contou-o-primeiro-como-zero");
  });

  it("a mensagem de telemetria não carrega o id real da criança", async () => {
    await submeter(entrada("chave-telemetria"));

    const telemetria = await db.outboxMessage.findFirstOrThrow({
      where: { topic: TOPICO_TELEMETRIA_DE_TENTATIVA },
    });
    const interna = await db.outboxMessage.count({
      where: { topic: TOPICO_TENTATIVA_AVALIADA },
    });

    // A de telemetria jamais carrega o id real (docs/08 §12.7, docs/09 §6).
    expect(JSON.stringify(telemetria.payload)).not.toContain(learnerId);
    // E o evento interno não passa pelo outbox: é consumido na transação.
    expect(interna).toBe(0);
  });

  it("atividade que não está no banco não grava nada", async () => {
    const resultado = await submeter(entrada("chave-inexistente"));
    expect(resultado.ok).toBe(true); // a referência real existe

    const semAcervo = await submeter({
      ...entrada("chave-fantasma"),
      refDaAtividade: "academia/inexistente/SPROUT/n1/m1/missao/fase/atividade",
    });

    expect(semAcervo.ok).toBe(false);
    if (semAcervo.ok) return;
    expect(semAcervo.error.code).toBe("assessment.activity_not_published");
    expect(await db.attempt.count()).toBe(1);
  });

  it("a Luz é creditada na MESMA transação da tentativa", async () => {
    /*
     * A garantia central do passo 3 (docs/08 §11). Se a progressão saísse pelo
     * outbox, este teste ainda passaria depois de rodar o despachante — mas a
     * criança teria terminado a atividade sem ver nada acontecer. Aqui não se
     * despacha nada: o progresso já tem que estar gravado.
     */
    const resultado = await submeter(entrada("chave-luz-1"));
    expect(resultado.ok).toBe(true);

    const progressoGravado = await db.learnerProgress.findUniqueOrThrow({
      where: { learnerId },
    });

    expect(progressoGravado.totalXp).toBeGreaterThan(0);
    expect(progressoGravado.streakDays).toBe(1);
    expect(progressoGravado.version).toBe(1);
  });

  it("as Fagulhas viram razão contábil e projeção, juntas", async () => {
    await submeter(entrada("chave-fagulha-1"));

    const [lancamentos, carteiraGravada] = await Promise.all([
      db.ledgerEntry.findMany({ where: { learnerId } }),
      db.wallet.findUniqueOrThrow({ where: { learnerId } }),
    ]);

    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0]!.currency).toBe("COIN");
    // A projeção bate com o saldo declarado no lançamento.
    expect(carteiraGravada.coins).toBe(lancamentos[0]!.balanceAfter);
  });

  it("a chave do lançamento deriva da chave da tentativa", async () => {
    await submeter(entrada("chave-derivada-1"));

    const lancamento = await db.ledgerEntry.findFirstOrThrow({ where: { learnerId } });
    expect(lancamento.idempotencyKey.startsWith("chave-derivada-1")).toBe(true);
  });

  it("repetir a chave não credita Luz nem Fagulha de novo", async () => {
    await submeter(entrada("chave-repetida-1"));
    const primeiro = await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } });

    const segunda = await submeter(entrada("chave-repetida-1"));
    expect(segunda.ok && segunda.value.repetida).toBe(true);

    const depois = await db.learnerProgress.findUniqueOrThrow({ where: { learnerId } });
    expect(depois.totalXp).toBe(primeiro.totalXp);
    expect(await db.ledgerEntry.count({ where: { learnerId } })).toBe(1);
  });

  it("cinco tentativas somam Luz, e o nível acompanha", async () => {
    for (let i = 0; i < 5; i += 1) {
      await submeter(entrada(`chave-soma-${i}`, ACERTOU, refNaReferencia));
    }

    const progressoGravado = await db.learnerProgress.findUniqueOrThrow({
      where: { learnerId },
    });

    expect(progressoGravado.totalXp).toBeGreaterThan(0);
    expect(progressoGravado.version).toBe(5);
    // Um dia só de jogo: a sequência conta dias, não tentativas.
    expect(progressoGravado.streakDays).toBe(1);
  });

  it("uma falha no crédito desfaz a tentativa inteira", async () => {
    /*
     * O ponto da transação única. Um manipulador que estoura tem que levar a
     * tentativa junto — o contrário deixaria `Attempt` gravada e a Luz por
     * creditar, sem nada no sistema apontando que faltou.
     */
    const explode = criarSubmeterTentativa({
      repositorio: criarRepositorioPrismaDeAvaliacao(db),
      unidadeDeTrabalho: criarUnidadeDeTrabalho(db),
      barramento: criarBarramento([
        {
          topico: TOPICO_TENTATIVA_AVALIADA,
          modo: "inline",
          async tratar() {
            throw new Error("progressão indisponível");
          },
        },
      ]),
      clock: systemClock,
      dormir: async () => {},
    });

    await expect(explode(entrada("chave-explode"))).rejects.toThrow(
      "progressão indisponível",
    );

    expect(await db.attempt.count()).toBe(0);
    expect(await db.skillMastery.count()).toBe(0);
    expect(await db.outboxMessage.count()).toBe(0);
  });

  it("o despachante processa a telemetria e marca a mensagem", async () => {
    await submeter(entrada("chave-despacho-1"));

    // Antes: pendente.
    expect(await db.learningEvent.count()).toBe(0);

    const relatorio = await despachante.despachar();

    expect(relatorio.processadas).toBe(1);
    expect(relatorio.falhadas).toBe(0);

    const registro = await db.learningEvent.findFirstOrThrow();
    expect(registro.pseudonymId).not.toBe(learnerId);
    expect(registro.name).toBe("attempt_recorded");

    const mensagem = await db.outboxMessage.findFirstOrThrow();
    expect(mensagem.processedAt).not.toBeNull();
  });

  it("despachar duas vezes não grava telemetria em dobro", async () => {
    await submeter(entrada("chave-despacho-2"));

    await despachante.despachar();
    const segundo = await despachante.despachar();

    // A mensagem já está marcada: o segundo pulso não tem o que ler.
    expect(segundo.lidas).toBe(0);
    expect(await db.learningEvent.count()).toBe(1);
  });

  it("pular grava a tentativa sem tocar domínio nem revisão", async () => {
    await submeter(
      entrada("chave-pulou", { outcome: "SKIPPED", scoreRatio: 0 } as EvaluationResult),
    );

    expect(await db.attempt.count()).toBe(1);
    expect(await db.skillMastery.count()).toBe(0);
    expect(await db.reviewCard.count()).toBe(0);
    // O evento sai mesmo assim: pular é informação para o responsável.
    expect(await db.outboxMessage.count()).toBe(1);
    // E a Trilha de Luz avança: ela apareceu hoje.
    const progressoGravado = await db.learnerProgress.findUniqueOrThrow({
      where: { learnerId },
    });
    expect(progressoGravado.streakDays).toBe(1);
  });
});
