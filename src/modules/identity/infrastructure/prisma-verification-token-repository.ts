import type { PrismaClient } from "@prisma/client";

import type {
  TokenDeVerificacao,
  VerificationTokenRepository,
} from "../application/ports";

export class PrismaVerificationTokenRepository
  implements VerificationTokenRepository
{
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  /**
   * Emitir apaga os tokens anteriores da mesma conta, na mesma transação.
   *
   * Sem isso, pedir "reenviar e-mail" três vezes deixaria três links válidos
   * circulando em três caixas de entrada — e o mais antigo continuaria valendo
   * por 24h depois que o responsável já usou o mais novo.
   */
  async issue(token: TokenDeVerificacao): Promise<void> {
    await this.#db.$transaction([
      this.#db.verificationToken.deleteMany({
        where: { identifier: token.identifier },
      }),
      this.#db.verificationToken.create({
        data: {
          identifier: token.identifier,
          tokenHash: token.tokenHash,
          expiresAt: token.expiresAt,
        },
      }),
    ]);
  }

  async find(tokenHash: string): Promise<TokenDeVerificacao | null> {
    return this.#db.verificationToken.findUnique({
      where: { tokenHash },
      select: { identifier: true, tokenHash: true, expiresAt: true },
    });
  }

  /** Uso único: consumir é apagar. */
  async consume(tokenHash: string): Promise<void> {
    await this.#db.verificationToken.deleteMany({ where: { tokenHash } });
  }
}
