import type { Result } from "@/shared/kernel";

import type { Account, AgeBand, Email } from "../domain";

/**
 * Portas do módulo de identidade.
 *
 * A camada de aplicação declara o que precisa; `infrastructure/` decide como.
 * Isto é o que permite testar todo caso de uso abaixo sem banco, sem rede e
 * sem relógio real — e é verificado em CI (docs/01 §1).
 */

// ── Conta ────────────────────────────────────────────────────────────────────

export interface NovaConta {
  readonly email: Email;
  readonly nome: string;
  readonly passwordHash: string;
  readonly locale: string;
}

export interface AccountRepository {
  findByEmail(email: Email): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  /** Devolve o hash guardado, ou null quando a conta é só OAuth. */
  findPasswordHash(accountId: string): Promise<string | null>;
  findParentPinHash(accountId: string): Promise<string | null>;
  create(dados: NovaConta): Promise<Account>;
  markEmailVerified(accountId: string, quando: Date): Promise<void>;
  updateParentPin(accountId: string, pinHash: string): Promise<void>;
  registerLogin(accountId: string, quando: Date): Promise<void>;
}

// ── Sessão adulta e sub-sessão de criança ────────────────────────────────────

export interface SessaoAtiva {
  readonly id: string;
  readonly accountId: string;
  readonly activeLearnerId: string | null;
  readonly expiresAt: Date;
}

export interface NovaSessao {
  readonly accountId: string;
  readonly tokenHash: string;
  readonly ipHash: string | null;
  readonly userAgent: string | null;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  create(dados: NovaSessao): Promise<SessaoAtiva>;
  /** Só devolve sessão viva: não expirada e não revogada. */
  findLiveByTokenHash(tokenHash: string, agora: Date): Promise<SessaoAtiva | null>;
  revoke(sessionId: string, quando: Date): Promise<void>;
  revokeAllForAccount(accountId: string, quando: Date): Promise<void>;
  setActiveLearner(sessionId: string, learnerId: string | null): Promise<void>;
}

// ── Token de verificação de e-mail ───────────────────────────────────────────

export interface TokenDeVerificacao {
  readonly identifier: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface VerificationTokenRepository {
  /** Emitir um token novo invalida os anteriores do mesmo identificador. */
  issue(token: TokenDeVerificacao): Promise<void>;
  find(tokenHash: string): Promise<TokenDeVerificacao | null>;
  /** Consumo é uso único: o token some ao ser aceito. */
  consume(tokenHash: string): Promise<void>;
}

// ── Criança ──────────────────────────────────────────────────────────────────

export interface NovoLearner {
  readonly guardianAccountId: string;
  readonly displayName: string;
  readonly birthYear: number;
  readonly ageBand: AgeBand;
  readonly locale: string;
  readonly relation: string;
}

export interface PerfilDeCrianca {
  readonly id: string;
  readonly displayName: string;
  readonly ageBand: AgeBand;
  readonly birthYear: number;
}

export interface LearnerRepository {
  /** Cria criança, ajustes de acessibilidade e vínculo de guarda numa transação. */
  create(dados: NovoLearner): Promise<PerfilDeCrianca>;
  listByGuardian(accountId: string): Promise<readonly PerfilDeCrianca[]>;
  /** Null quando a criança não existe OU não é desta família — a política não vaza a diferença. */
  findForGuardian(
    accountId: string,
    learnerId: string,
  ): Promise<PerfilDeCrianca | null>;
  countByGuardian(accountId: string): Promise<number>;
}

// ── Serviços de apoio ────────────────────────────────────────────────────────

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
  /**
   * Consome o mesmo custo de CPU de uma verificação real, sem hash para comparar.
   * Usado quando o e-mail não existe: sem isso, o tempo de resposta denuncia
   * quais contas existem (docs/09 §5 — enumeração de contas).
   */
  fakeVerify(): Promise<void>;
}

export interface EmailDeVerificacao {
  readonly para: Email;
  readonly nome: string;
  readonly url: string;
  readonly expiraEm: Date;
}

export interface IdentityMailer {
  enviarVerificacao(dados: EmailDeVerificacao): Promise<Result<void>>;
  /**
   * Enviado quando alguém tenta criar conta com um e-mail que já existe.
   *
   * É o que nos permite responder exatamente a mesma coisa nos dois casos, sem
   * deixar o dono da conta no escuro: a tela diz "enviamos um e-mail", e o
   * e-mail que chega explica que a conta já existia e oferece o caminho de
   * entrar ou recuperar a senha.
   */
  enviarAvisoDeContaExistente(dados: {
    readonly para: Email;
    readonly nome: string;
    readonly urlEntrar: string;
  }): Promise<Result<void>>;
}

export interface RateLimiter {
  /**
   * Consome uma unidade da janela. `ok: false` com RATE_LIMITED quando estoura.
   * A chave já chega pronta e sem PII (e-mail entra como hash).
   */
  consume(chave: string, limite: number, janelaMs: number): Promise<Result<void>>;
}

/** Trilha imutável de docs/09 §7. Escrever auditoria nunca derruba a ação. */
export interface AuditTrail {
  record(entrada: {
    readonly actorAccountId: string | null;
    readonly action: string;
    readonly entity: string;
    readonly entityId: string;
    readonly metadata?: Record<string, unknown>;
  }): Promise<void>;
}
