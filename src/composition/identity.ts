import { clientEnv } from "@/config/env";
import { db } from "@/server/db";
import { createMailer } from "@/server/mailer";
import { systemClock } from "@/shared/kernel";

import type { IdentityDeps } from "@/modules/identity/application/deps";
import { Argon2Hasher } from "@/modules/identity/infrastructure/argon2-hasher";
import { TransactionalIdentityMailer } from "@/modules/identity/infrastructure/identity-mailer";
import { InMemoryRateLimiter } from "@/modules/identity/infrastructure/memory-rate-limiter";
import { PrismaAccountRepository } from "@/modules/identity/infrastructure/prisma-account-repository";
import { PrismaAuditTrail } from "@/modules/identity/infrastructure/prisma-audit-trail";
import { PrismaLearnerRepository } from "@/modules/identity/infrastructure/prisma-learner-repository";
import { PrismaSessionRepository } from "@/modules/identity/infrastructure/prisma-session-repository";
import { PrismaVerificationTokenRepository } from "@/modules/identity/infrastructure/prisma-verification-token-repository";

/**
 * Composition root do módulo de identidade — o único lugar do sistema que sabe
 * *quais* implementações existem por trás das portas.
 *
 * É por existir este arquivo que os casos de uso podem ser testados com dublês
 * em memória: nenhum deles jamais nomeia Prisma, Argon2 ou Resend.
 *
 * Construído uma vez por instância, não por requisição. Isso importa para o
 * rate limiter: um limitador novo a cada requisição não limitaria nada.
 */
let cache: IdentityDeps | undefined;

export function identityDeps(): IdentityDeps {
  cache ??= {
    accounts: new PrismaAccountRepository(db),
    sessions: new PrismaSessionRepository(db),
    verificationTokens: new PrismaVerificationTokenRepository(db),
    learners: new PrismaLearnerRepository(db),
    hasher: new Argon2Hasher(),
    mailer: new TransactionalIdentityMailer(createMailer()),
    rateLimiter: new InMemoryRateLimiter(systemClock),
    audit: new PrismaAuditTrail(db),
    clock: systemClock,
    appUrl: clientEnv.NEXT_PUBLIC_APP_URL,
  };
  return cache;
}
