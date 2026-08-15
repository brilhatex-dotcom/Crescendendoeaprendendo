import type { Prisma, PrismaClient } from "@prisma/client";

import { clienteDaTransacao } from "@/server/unit-of-work";

import type {
  DimensaoPersistida,
  RecomendacaoPersistida,
  RepositorioDePerfilDeAprendizagem,
} from "../application/ports";

const KIND_SUGESTAO_DE_ACESSIBILIDADE = "ACCESSIBILITY_SUGGESTION";

interface PayloadDaSugestao {
  readonly dimensionKey?: string;
  readonly settingField?: string;
}

function comoRecomendacaoPersistida(linha: {
  readonly id: string;
  readonly payload: unknown;
  readonly reason: string;
  readonly score: Prisma.Decimal;
  readonly createdAt: Date;
}): RecomendacaoPersistida | null {
  const payload = linha.payload as PayloadDaSugestao | null;
  if (!payload?.dimensionKey || !payload.settingField) return null;

  return {
    id: linha.id,
    dimensionKey: payload.dimensionKey,
    settingField: payload.settingField,
    reason: linha.reason,
    score: Number(linha.score),
    createdAt: linha.createdAt,
  };
}

/**
 * Filtro Prisma equivalente a cada regra de `domain/dimension-rules.ts`.
 *
 * Duplicado de propósito, não importado do domínio: o domínio não pode
 * depender de `Prisma.ActivityWhereInput` (motor-e-puro do lado do
 * conteúdo). Ver `prisma-learning-profile-repository.test.ts` — garante que
 * as duas chaveações nunca saem de sincronia.
 */
export const FILTRO_POR_DIMENSAO: Readonly<Record<string, Prisma.ActivityWhereInput>> = {
  suporteVisual: { visualSupportLevel: { in: ["medio", "alto"] } },
  instrucaoPassoAPasso: { stepCount: { gte: 3 } },
  independenciaDeLeitura: { requiresReading: false },
};

/** Quantas tentativas recentes entram no recompute de uma dimensão. */
const LIMITE_DE_OBSERVACOES = 200;

export function criarRepositorioPrismaDePerfilDeAprendizagem(
  db: PrismaClient,
): RepositorioDePerfilDeAprendizagem {
  return {
    async buscarCaracteristicas(activityId, tx) {
      const client = clienteDaTransacao(tx);
      const atividade = await client.activity.findUnique({
        where: { id: activityId },
        select: { requiresReading: true, visualSupportLevel: true, stepCount: true },
      });
      if (!atividade) return null;

      // Nenhuma característica declarada — nada a aprender com esta atividade.
      if (
        atividade.requiresReading === null &&
        atividade.visualSupportLevel === null &&
        atividade.stepCount === null
      ) {
        return null;
      }

      return atividade;
    },

    async buscarScoresRelevantes(learnerId, dimensionKey, tx) {
      const filtro = FILTRO_POR_DIMENSAO[dimensionKey];
      if (!filtro) return [];

      const client = clienteDaTransacao(tx);
      const linhas = await client.attempt.findMany({
        where: {
          learnerId,
          outcome: { in: ["CORRECT", "PARTIAL", "INCORRECT"] },
          activity: filtro,
        },
        orderBy: { createdAt: "desc" },
        take: LIMITE_DE_OBSERVACOES,
        select: { scoreRatio: true },
      });

      return linhas.map((l) => Number(l.scoreRatio));
    },

    async obterOuCriarPerfil(learnerId, academyId, tx) {
      const client = clienteDaTransacao(tx);

      const existente = await client.learningProfile.findFirst({
        where: { learnerId, academyId },
        select: { id: true },
      });
      if (existente) return existente.id;

      const criado = await client.learningProfile.create({
        data: { learnerId, academyId },
        select: { id: true },
      });
      return criado.id;
    },

    async obterDimensao(profileId, dimensionKey, tx) {
      const client = clienteDaTransacao(tx);
      const linha = await client.learningProfileDimension.findUnique({
        where: { profileId_key: { profileId, key: dimensionKey } },
      });
      if (!linha) return null;
      return {
        value: Number(linha.value),
        confidence: Number(linha.confidence),
        observationsCount: linha.observationsCount,
      };
    },

    async salvarDimensao(profileId, dimensionKey, novo, anterior, tx) {
      const client = clienteDaTransacao(tx);
      const agora = new Date();

      await client.learningProfileDimension.upsert({
        where: { profileId_key: { profileId, key: dimensionKey } },
        create: {
          profileId,
          key: dimensionKey,
          value: novo.value,
          confidence: novo.confidence,
          observationsCount: novo.observationsCount,
          lastObservedAt: agora,
        },
        update: {
          value: novo.value,
          confidence: novo.confidence,
          observationsCount: novo.observationsCount,
          lastObservedAt: agora,
        },
      });

      await client.learningProfileEvent.create({
        data: {
          profileId,
          dimensionKey,
          previousValue: anterior?.value ?? null,
          newValue: novo.value,
          previousConfidence: anterior?.confidence ?? null,
          newConfidence: novo.confidence,
          trigger: "SYSTEM_INFERENCE",
        },
      });
    },

    async lerPerfil(learnerId, academyId) {
      const perfil = await db.learningProfile.findFirst({
        where: { learnerId, academyId },
        include: { dimensions: true },
      });

      const dimensions = new Map<
        string,
        DimensaoPersistida & { lastObservedAt: Date | null }
      >();
      for (const d of perfil?.dimensions ?? []) {
        dimensions.set(d.key, {
          value: Number(d.value),
          confidence: Number(d.confidence),
          observationsCount: d.observationsCount,
          lastObservedAt: d.lastObservedAt,
        });
      }

      return { dimensions };
    },

    async valorAtualDaConfiguracao(learnerId, settingField, tx) {
      const client = clienteDaTransacao(tx);
      const configuracoes = await client.learnerSettings.findUnique({ where: { learnerId } });
      if (!configuracoes) return null;

      // `settingField` vem de `SugestaoDeAcessibilidade.settingField`
      // (`domain/accessibility-recommendation.ts`) — sempre um dos poucos
      // nomes de coluna booleana ali declarados, nunca entrada de usuário.
      const valor = (configuracoes as unknown as Record<string, unknown>)[settingField];
      return typeof valor === "boolean" ? valor : null;
    },

    async existeRecomendacaoPendente(learnerId, dimensionKey, tx) {
      const client = clienteDaTransacao(tx);
      const existente = await client.recommendation.findFirst({
        where: {
          learnerId,
          kind: KIND_SUGESTAO_DE_ACESSIBILIDADE,
          consumedAt: null,
          payload: { path: ["dimensionKey"], equals: dimensionKey },
        },
        select: { id: true },
      });
      return existente !== null;
    },

    async criarRecomendacaoDeAcessibilidade(learnerId, sugestao, score, tx) {
      const client = clienteDaTransacao(tx);
      await client.recommendation.create({
        data: {
          learnerId,
          kind: KIND_SUGESTAO_DE_ACESSIBILIDADE,
          reason: sugestao.reason,
          score,
          payload: {
            dimensionKey: sugestao.dimensionKey,
            settingField: sugestao.settingField,
            suggestedValue: true,
          },
        },
      });
    },

    async listarRecomendacoesPendentes(learnerId) {
      const linhas = await db.recommendation.findMany({
        where: { learnerId, kind: KIND_SUGESTAO_DE_ACESSIBILIDADE, consumedAt: null },
        orderBy: { score: "desc" },
      });
      return linhas.flatMap((linha) => comoRecomendacaoPersistida(linha) ?? []);
    },

    async consumirRecomendacao(recommendationId, learnerId, tx) {
      const client = clienteDaTransacao(tx);

      // `updateMany` porque a condição "ainda pendente" precisa entrar no
      // `where` — é isso que faz um segundo clique (duplo toque, reload)
      // não processar a mesma recomendação duas vezes.
      const resultado = await client.recommendation.updateMany({
        where: { id: recommendationId, learnerId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (resultado.count === 0) return null;

      const linha = await client.recommendation.findUnique({ where: { id: recommendationId } });
      return linha ? comoRecomendacaoPersistida(linha) : null;
    },
  };
}
