import { Prisma, type PrismaClient } from "@prisma/client";

import type { Transacao, UnidadeDeTrabalho } from "@/shared/kernel";

/**
 * A unidade de trabalho sobre Prisma.
 *
 * Este arquivo é o **único** ponto do sistema que sabe que uma `Transacao` é,
 * por dentro, um `Prisma.TransactionClient`. Os dois `as unknown as` abaixo são
 * a fronteira inteira: fora daqui, ninguém consegue confundir um cliente de
 * banco com um handle de transação, nem o contrário.
 *
 * Confinar a conversão num par de funções é o que permite ao resto do sistema
 * passar a transação adiante sem que uma única camada de aplicação precise
 * importar Prisma — verificado por dependency-cruiser.
 */

/**
 * `READ COMMITTED` com atualização condicional nas linhas quentes, como manda
 * docs/08 §11. `Serializable` cobraria retry em toda escrita concorrente; a
 * coluna `version` resolve o único conflito real por um preço muito menor.
 *
 * O tempo limite é generoso porque a transação atravessa três módulos —
 * avaliação, progressão e economia — e ainda grava o outbox. Curto demais, a
 * resposta da criança falharia sob carga justamente quando ela mais joga.
 */
const OPCOES = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  timeout: 15_000,
  maxWait: 5_000,
} as const;

export function criarUnidadeDeTrabalho(db: PrismaClient): UnidadeDeTrabalho {
  return {
    executar(trabalho) {
      return db.$transaction(
        (tx) => trabalho(tx as unknown as Transacao),
        OPCOES,
      );
    },
  };
}

/**
 * Desembrulha o handle para uso na infraestrutura.
 *
 * Só pode ser chamada de dentro de `src/modules/*​/infrastructure` e de
 * `src/server` — em qualquer outro lugar seria a camada errada conhecendo o
 * banco, e a regra de fronteira acusa.
 */
export const clienteDaTransacao = (tx: Transacao): Prisma.TransactionClient =>
  tx as unknown as Prisma.TransactionClient;
