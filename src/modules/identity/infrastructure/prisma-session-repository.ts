import type { PrismaClient } from "@prisma/client";

import type {
  NovaSessao,
  SessaoAtiva,
  SessionRepository,
} from "../application/ports";

export class PrismaSessionRepository implements SessionRepository {
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  async create(dados: NovaSessao): Promise<SessaoAtiva> {
    const linha = await this.#db.session.create({
      data: {
        accountId: dados.accountId,
        tokenHash: dados.tokenHash,
        ipHash: dados.ipHash,
        userAgent: dados.userAgent,
        expiresAt: dados.expiresAt,
      },
      select: {
        id: true,
        accountId: true,
        activeLearnerId: true,
        expiresAt: true,
      },
    });
    return linha;
  }

  /**
   * "Viva" é decidido na consulta, não em memória: trazer a linha e checar
   * depois abriria espaço para alguém esquecer a checagem em um caminho novo.
   */
  async findLiveByTokenHash(
    tokenHash: string,
    agora: Date,
  ): Promise<SessaoAtiva | null> {
    return this.#db.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: agora },
      },
      select: {
        id: true,
        accountId: true,
        activeLearnerId: true,
        expiresAt: true,
      },
    });
  }

  async revoke(sessionId: string, quando: Date): Promise<void> {
    await this.#db.session.update({
      where: { id: sessionId },
      data: { revokedAt: quando, activeLearnerId: null },
    });
  }

  /** Usado na troca de senha (docs/09 §5): senha nova derruba tudo que estava aberto. */
  async revokeAllForAccount(accountId: string, quando: Date): Promise<void> {
    await this.#db.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: quando, activeLearnerId: null },
    });
  }

  async setActiveLearner(sessionId: string, learnerId: string | null): Promise<void> {
    await this.#db.session.update({
      where: { id: sessionId },
      data: { activeLearnerId: learnerId },
    });
  }
}
