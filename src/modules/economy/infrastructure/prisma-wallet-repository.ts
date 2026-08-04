import { Prisma, type PrismaClient } from "@prisma/client";

import { clienteDaTransacao } from "@/server/unit-of-work";
import type { Transacao } from "@/shared/kernel";

import { carteiraInicial, type EstadoDaCarteira } from "../domain/ledger";
import {
  CarteiraMudouNoMeio,
  type ConsultaDeCarteira,
  type RepositorioDeCarteira,
} from "../application/ports";

/**
 * `Wallet` + `LedgerEntry` no Prisma.
 *
 * A ordem das escritas não é arbitrária: **razão primeiro, projeção depois**. O
 * índice único de `LedgerEntry.idempotencyKey` é o que decide se este crédito já
 * aconteceu, e ele precisa decidir *antes* de qualquer saldo ser tocado.
 */

const CHAVE_DUPLICADA = "P2002";

export function criarRepositorioPrismaDeCarteira(
  db: PrismaClient,
): RepositorioDeCarteira & ConsultaDeCarteira {
  return {
    async carregar(learnerId, transacao: Transacao) {
      const linha = await clienteDaTransacao(transacao).wallet.findUnique({
        where: { learnerId },
      });
      return linha ? paraDominio(linha) : null;
    },

    async buscar(learnerId) {
      const linha = await db.wallet.findUnique({ where: { learnerId } });
      // Carteira ausente é carteira zerada, não erro: a criança simplesmente
      // ainda não ganhou nada.
      return linha ? paraDominio(linha) : carteiraInicial();
    },

    async aplicar(learnerId, versaoEsperada, carteira, lancamentos, transacao: Transacao) {
      const tx = clienteDaTransacao(transacao);

      try {
        await tx.ledgerEntry.createMany({
          data: lancamentos.map((lancamento) => ({
            learnerId,
            currency: lancamento.moeda,
            amount: lancamento.quantidade,
            balanceAfter: lancamento.saldoDepois,
            reason: lancamento.motivo,
            refType: lancamento.refType,
            refId: lancamento.refId,
            idempotencyKey: lancamento.idempotencyKey,
          })),
        });
      } catch (causa) {
        if (
          causa instanceof Prisma.PrismaClientKnownRequestError &&
          causa.code === CHAVE_DUPLICADA
        ) {
          /*
           * Estes lançamentos já existem: o crédito aconteceu antes. Não é
           * erro e não é corrida — é a idempotência fazendo o trabalho dela.
           * Sair sem tocar o saldo é a resposta certa.
           */
          return false;
        }
        throw causa;
      }

      if (versaoEsperada === null) {
        try {
          await tx.wallet.create({ data: { learnerId, ...paraBancoDados(carteira) } });
        } catch (causa) {
          if (
            causa instanceof Prisma.PrismaClientKnownRequestError &&
            causa.code === CHAVE_DUPLICADA
          ) {
            throw new CarteiraMudouNoMeio();
          }
          throw causa;
        }
      } else {
        const { count } = await tx.wallet.updateMany({
          where: { learnerId, version: versaoEsperada },
          data: paraBancoDados(carteira),
        });
        if (count === 0) throw new CarteiraMudouNoMeio();
      }

      return true;
    },
  };
}

type LinhaDeCarteira = {
  coins: number;
  crystals: number;
  diamonds: number;
  version: number;
};

const paraDominio = (linha: LinhaDeCarteira): EstadoDaCarteira => ({
  fagulhas: linha.coins,
  prismas: linha.crystals,
  estrelas: linha.diamonds,
  versao: linha.version,
});

const paraBancoDados = (carteira: EstadoDaCarteira) => ({
  coins: carteira.fagulhas,
  crystals: carteira.prismas,
  diamonds: carteira.estrelas,
  version: carteira.versao,
});
