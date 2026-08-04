import { Prisma, type PrismaClient } from "@prisma/client";

import { clienteDaTransacao } from "@/server/unit-of-work";
import type { Transacao } from "@/shared/kernel";

import type { EstadoDeProgresso } from "../domain/progress";
import { comoEstaAgora } from "../domain/progress";
import type { Tier } from "../domain/level";
import {
  ProgressoMudouNoMeio,
  type ConsultaDeProgresso,
  type RepositorioDeProgresso,
} from "../application/ports";

/**
 * `LearnerProgress` no Prisma.
 *
 * A tabela guarda a Trilha de Luz em três colunas soltas (`streakDays`,
 * `streakRecord`, `streakShields`, `lastActiveDate`); o domínio a vê como um
 * objeto só. A tradução mora aqui — é exatamente o tipo de detalhe de
 * armazenamento que não deve vazar para a regra.
 */

const CHAVE_DUPLICADA = "P2002";

/** Fuso padrão quando o responsável não declarou nenhum. */
const FUSO_PADRAO = "America/Sao_Paulo";

export function criarRepositorioPrismaDeProgresso(
  db: PrismaClient,
): RepositorioDeProgresso & ConsultaDeProgresso {
  return {
    async carregar(learnerId, transacao: Transacao) {
      const linha = await clienteDaTransacao(transacao).learnerProgress.findUnique({
        where: { learnerId },
      });
      return linha ? paraDominio(linha) : null;
    },

    async buscar(learnerId) {
      const linha = await db.learnerProgress.findUnique({ where: { learnerId } });
      // Regenerado na leitura: a tela mostra o Fôlego de agora, não o da última
      // gravação. É a mesma função que a escrita usa (docs/08 §4).
      return linha ? comoEstaAgora(paraDominio(linha), new Date()) : null;
    },

    async criar(learnerId, estado, transacao: Transacao) {
      try {
        await clienteDaTransacao(transacao).learnerProgress.create({
          data: { learnerId, ...paraBancoDados(estado) },
        });
      } catch (causa) {
        if (
          causa instanceof Prisma.PrismaClientKnownRequestError &&
          causa.code === CHAVE_DUPLICADA
        ) {
          // Outra requisição criou a linha primeiro. Recomeçar é a resposta:
          // sobrescrever descartaria a Luz que ela acabou de creditar.
          throw new ProgressoMudouNoMeio();
        }
        throw causa;
      }
    },

    async atualizar(learnerId, versaoEsperada, estado, transacao: Transacao) {
      const { count } = await clienteDaTransacao(transacao).learnerProgress.updateMany({
        where: { learnerId, version: versaoEsperada },
        data: paraBancoDados(estado),
      });
      if (count === 0) throw new ProgressoMudouNoMeio();
    },

    async registrarDesbloqueios(learnerId, refIds, transacao: Transacao) {
      await clienteDaTransacao(transacao).unlock.createMany({
        data: refIds.map((refId) => ({ learnerId, kind: "REWARD", refId })),
        // A chave única `(learnerId, kind, refId)` é o que torna a operação
        // idempotente: reconceder o mesmo item não cria linha nova nem falha.
        skipDuplicates: true,
      });
    },

    async fusoDoResponsavel() {
      /*
       * A Trilha de Luz conta dias no calendário de quem joga (docs/08 §6).
       * Não existe campo de fuso em `Account` ainda, então o padrão é o do
       * país — e fica num lugar só, para virar leitura quando o campo existir.
       * Errar o fuso aqui custa caro: uma criança que joga às 22h teria o dia
       * contado como o seguinte e perderia a sequência sem entender por quê.
       */
      return FUSO_PADRAO;
    },
  };
}

type LinhaDeProgresso = {
  totalXp: number;
  level: number;
  tier: string;
  energy: number;
  energyUpdatedAt: Date;
  streakDays: number;
  streakRecord: number;
  streakShields: number;
  lastActiveDate: Date | null;
  version: number;
};

function paraDominio(linha: LinhaDeProgresso): EstadoDeProgresso {
  return {
    luzTotal: linha.totalXp,
    nivel: linha.level,
    tier: linha.tier as Tier,
    folego: linha.energy,
    folegoAtualizadoEm: linha.energyUpdatedAt,
    trilha: {
      dias: linha.streakDays,
      recorde: linha.streakRecord,
      lanternas: linha.streakShields,
      // A coluna é `@db.Date`: o instante não carrega hora, e o domínio
      // trabalha com data civil em texto.
      ultimoDia: linha.lastActiveDate?.toISOString().slice(0, 10) ?? null,
    },
    versao: linha.version,
  };
}

function paraBancoDados(estado: EstadoDeProgresso) {
  return {
    totalXp: estado.luzTotal,
    level: estado.nivel,
    tier: estado.tier,
    energy: estado.folego,
    energyUpdatedAt: estado.folegoAtualizadoEm,
    streakDays: estado.trilha.dias,
    streakRecord: estado.trilha.recorde,
    streakShields: estado.trilha.lanternas,
    lastActiveDate: estado.trilha.ultimoDia
      ? new Date(`${estado.trilha.ultimoDia}T00:00:00Z`)
      : null,
    version: estado.versao,
  };
}
