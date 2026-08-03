import { Prisma, type PrismaClient } from "@prisma/client";

import type { AuditTrail } from "../application/ports";

export class PrismaAuditTrail implements AuditTrail {
  readonly #db: PrismaClient;

  constructor(db: PrismaClient) {
    this.#db = db;
  }

  /**
   * Auditoria nunca derruba a ação que a originou.
   *
   * Se o insert falhar, o responsável não pode perder o login por causa disso.
   * Registramos no log de erro e seguimos: perder uma linha de auditoria é
   * ruim; recusar autenticação porque a auditoria piscou é pior.
   *
   * A trilha é *append-only* por contrato (docs/09 §7) — não existe update nem
   * delete neste repositório, de propósito.
   */
  async record(entrada: {
    readonly actorAccountId: string | null;
    readonly action: string;
    readonly entity: string;
    readonly entityId: string;
    readonly metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.#db.auditLog.create({
        data: {
          actorType: entrada.actorAccountId ? "ACCOUNT" : "SYSTEM",
          actorId: entrada.actorAccountId,
          action: entrada.action,
          targetType: entrada.entity,
          targetId: entrada.entityId,
          // `Record<string, unknown>` não é atribuível a InputJsonValue: o
          // Prisma exige um valor comprovadamente serializável. Serializar e
          // reler é o que prova isso — e derruba `undefined` de brinde.
          diff: entrada.metadata
            ? (JSON.parse(JSON.stringify(entrada.metadata)) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    } catch (causa) {
      console.error("[auditoria] falha ao registrar", {
        action: entrada.action,
        causa,
      });
    }
  }
}
