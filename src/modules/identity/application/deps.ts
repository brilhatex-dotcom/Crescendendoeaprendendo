import type { Clock } from "@/shared/kernel";

import type {
  AccountRepository,
  AuditTrail,
  IdentityMailer,
  LearnerRepository,
  PasswordHasher,
  RateLimiter,
  SessionRepository,
  VerificationTokenRepository,
} from "./ports";

/**
 * Tudo que os casos de uso deste módulo precisam do mundo externo.
 *
 * Passar o pacote inteiro em vez de injetar porta por porta mantém a assinatura
 * dos casos de uso estável quando uma dependência nova aparece — e deixa óbvio,
 * ao ler, qual é a superfície de contato do módulo com a infraestrutura.
 */
export interface IdentityDeps {
  readonly accounts: AccountRepository;
  readonly sessions: SessionRepository;
  readonly verificationTokens: VerificationTokenRepository;
  readonly learners: LearnerRepository;
  readonly hasher: PasswordHasher;
  readonly mailer: IdentityMailer;
  readonly rateLimiter: RateLimiter;
  readonly audit: AuditTrail;
  readonly clock: Clock;
  /** Base pública da aplicação, para montar o link de verificação. */
  readonly appUrl: string;
}

/**
 * Contexto de quem está pedindo. Vem do wrapper `createAction`, nunca do corpo
 * da requisição — dado de ator enviado pelo cliente é dado de ator forjável.
 */
export interface RequestContext {
  readonly traceId: string;
  readonly ipHash: string | null;
  readonly userAgent: string | null;
}
