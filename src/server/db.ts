import { PrismaClient } from "@prisma/client";

import { isProduction } from "@/config/env";

/**
 * Instância única do PrismaClient sobre a string *pooled* (docs/10 §4).
 *
 * Em desenvolvimento o Fast Refresh reavalia este módulo a cada alteração. Sem
 * o cache no escopo global, cada recarga abriria um novo pool e o Postgres
 * fecharia a porta em "too many connections" depois de alguns minutos de
 * trabalho. Em produção o módulo é avaliado uma vez e o global não é usado.
 */

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ["error"] : ["error", "warn"],
  });

if (!isProduction) {
  globalForPrisma.prisma = db;
}
