import { beforeEach, describe, expect, it } from "vitest";

import { FixedClock, isErr, ok, unwrap, type Result } from "@/shared/kernel";
import { hashToken } from "@/shared/security/tokens";

import { Account, Email, type AccountStatus } from "../domain";
import type { IdentityDeps, RequestContext } from "./deps";
import type {
  AccountRepository,
  AuditTrail,
  EmailDeVerificacao,
  IdentityMailer,
  LearnerRepository,
  NovaConta,
  NovaSessao,
  NovoLearner,
  PasswordHasher,
  PerfilDeCrianca,
  RateLimiter,
  SessaoAtiva,
  SessionRepository,
  TokenDeVerificacao,
  VerificationTokenRepository,
} from "./ports";
import { LIMITES } from "./policy";
import { criarPerfilDeCrianca, definirPinDoResponsavel, listarFamilia } from "./use-cases/manage-family";
import {
  encerrarSessaoDeCrianca,
  iniciarSessaoDeCrianca,
} from "./use-cases/learner-session";
import { registrarResponsavel } from "./use-cases/register-guardian";
import { resolverSessao } from "./use-cases/resolve-session";
import { entrar, sair } from "./use-cases/sign-in";
import { reenviarVerificacao, verificarEmail } from "./use-cases/verify-email";

// ═══════════════════════════════════════════════════════════════════════════
//  Dublês em memória
//
//  Existem para provar que os casos de uso não dependem de banco, rede nem
//  relógio: se algum passasse a depender, ele deixaria de compilar aqui.
// ═══════════════════════════════════════════════════════════════════════════

interface LinhaDeConta {
  id: string;
  email: string;
  nome: string;
  passwordHash: string | null;
  parentPinHash: string | null;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  locale: string;
  lastLoginAt: Date | null;
}

class ContasFake implements AccountRepository {
  readonly linhas = new Map<string, LinhaDeConta>();
  #sequencia = 0;

  semear(linha: Partial<LinhaDeConta> & { email: string }): LinhaDeConta {
    this.#sequencia += 1;
    // Cuidado com `??` nos campos anuláveis: `null` aqui é um valor com
    // significado ("sem senha", "e-mail não verificado"), não uma ausência de
    // opção. Usar `??` os trocaria silenciosamente pelo padrão.
    const completa: LinhaDeConta = {
      id: linha.id ?? `acc_${this.#sequencia}`,
      email: linha.email,
      nome: linha.nome ?? "Mariana",
      passwordHash:
        linha.passwordHash === undefined ? "hash:senha-correta-mesmo" : linha.passwordHash,
      parentPinHash: linha.parentPinHash === undefined ? null : linha.parentPinHash,
      status: linha.status ?? "ACTIVE",
      emailVerifiedAt:
        linha.emailVerifiedAt === undefined
          ? new Date("2026-01-01T00:00:00.000Z")
          : linha.emailVerifiedAt,
      locale: linha.locale ?? "pt-BR",
      lastLoginAt: null,
    };
    this.linhas.set(completa.id, completa);
    return completa;
  }

  #paraEntidade(linha: LinhaDeConta): Account {
    return Account.rehydrate({
      id: linha.id,
      email: unwrap(Email.create(linha.email)),
      name: linha.nome,
      locale: linha.locale,
      hasPassword: linha.passwordHash !== null,
      hasParentPin: linha.parentPinHash !== null,
      status: linha.status,
      emailVerifiedAt: linha.emailVerifiedAt,
    });
  }

  async findByEmail(email: Email): Promise<Account | null> {
    for (const linha of this.linhas.values()) {
      if (linha.email === email.value) return this.#paraEntidade(linha);
    }
    return null;
  }

  async findById(id: string): Promise<Account | null> {
    const linha = this.linhas.get(id);
    return linha ? this.#paraEntidade(linha) : null;
  }

  async findPasswordHash(accountId: string): Promise<string | null> {
    return this.linhas.get(accountId)?.passwordHash ?? null;
  }

  async findParentPinHash(accountId: string): Promise<string | null> {
    return this.linhas.get(accountId)?.parentPinHash ?? null;
  }

  async create(dados: NovaConta): Promise<Account> {
    const linha = this.semear({
      email: dados.email.value,
      nome: dados.nome,
      passwordHash: dados.passwordHash,
      locale: dados.locale,
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
    });
    return this.#paraEntidade(linha);
  }

  async markEmailVerified(accountId: string, quando: Date): Promise<void> {
    const linha = this.linhas.get(accountId);
    if (!linha) return;
    linha.emailVerifiedAt = quando;
    linha.status = "ACTIVE";
  }

  async updateParentPin(accountId: string, pinHash: string): Promise<void> {
    const linha = this.linhas.get(accountId);
    if (linha) linha.parentPinHash = pinHash;
  }

  async registerLogin(accountId: string, quando: Date): Promise<void> {
    const linha = this.linhas.get(accountId);
    if (linha) linha.lastLoginAt = quando;
  }
}

class SessoesFake implements SessionRepository {
  readonly linhas = new Map<string, SessaoAtiva & { tokenHash: string; revokedAt: Date | null }>();
  #sequencia = 0;

  async create(dados: NovaSessao): Promise<SessaoAtiva> {
    this.#sequencia += 1;
    const sessao = {
      id: `ses_${this.#sequencia}`,
      accountId: dados.accountId,
      activeLearnerId: null,
      expiresAt: dados.expiresAt,
      tokenHash: dados.tokenHash,
      revokedAt: null,
    };
    this.linhas.set(sessao.id, sessao);
    return sessao;
  }

  async findLiveByTokenHash(tokenHash: string, agora: Date): Promise<SessaoAtiva | null> {
    for (const linha of this.linhas.values()) {
      if (
        linha.tokenHash === tokenHash &&
        linha.revokedAt === null &&
        linha.expiresAt.getTime() > agora.getTime()
      ) {
        return linha;
      }
    }
    return null;
  }

  async revoke(sessionId: string, quando: Date): Promise<void> {
    const linha = this.linhas.get(sessionId);
    if (linha) linha.revokedAt = quando;
  }

  async revokeAllForAccount(accountId: string, quando: Date): Promise<void> {
    for (const linha of this.linhas.values()) {
      if (linha.accountId === accountId) linha.revokedAt = quando;
    }
  }

  async setActiveLearner(sessionId: string, learnerId: string | null): Promise<void> {
    const linha = this.linhas.get(sessionId);
    if (linha) {
      this.linhas.set(sessionId, { ...linha, activeLearnerId: learnerId });
    }
  }
}

class TokensFake implements VerificationTokenRepository {
  readonly linhas: TokenDeVerificacao[] = [];

  async issue(token: TokenDeVerificacao): Promise<void> {
    // Espelha o repositório real: emitir invalida os anteriores da mesma conta.
    for (let i = this.linhas.length - 1; i >= 0; i -= 1) {
      if (this.linhas[i]?.identifier === token.identifier) this.linhas.splice(i, 1);
    }
    this.linhas.push(token);
  }

  async find(tokenHash: string): Promise<TokenDeVerificacao | null> {
    return this.linhas.find((linha) => linha.tokenHash === tokenHash) ?? null;
  }

  async consume(tokenHash: string): Promise<void> {
    const indice = this.linhas.findIndex((linha) => linha.tokenHash === tokenHash);
    if (indice >= 0) this.linhas.splice(indice, 1);
  }
}

class CriancasFake implements LearnerRepository {
  readonly linhas: (PerfilDeCrianca & { guardianAccountId: string })[] = [];
  #sequencia = 0;

  async create(dados: NovoLearner): Promise<PerfilDeCrianca> {
    this.#sequencia += 1;
    const perfil = {
      id: `lea_${this.#sequencia}`,
      displayName: dados.displayName,
      ageBand: dados.ageBand,
      birthYear: dados.birthYear,
      guardianAccountId: dados.guardianAccountId,
    };
    this.linhas.push(perfil);
    return perfil;
  }

  async listByGuardian(accountId: string): Promise<readonly PerfilDeCrianca[]> {
    return this.linhas.filter((linha) => linha.guardianAccountId === accountId);
  }

  async findForGuardian(
    accountId: string,
    learnerId: string,
  ): Promise<PerfilDeCrianca | null> {
    return (
      this.linhas.find(
        (linha) => linha.id === learnerId && linha.guardianAccountId === accountId,
      ) ?? null
    );
  }

  async countByGuardian(accountId: string): Promise<number> {
    return (await this.listByGuardian(accountId)).length;
  }
}

/** Hasher determinístico e barato. Argon2 de verdade é testado na infraestrutura. */
class HasherFake implements PasswordHasher {
  chamadasDeFakeVerify = 0;

  async hash(plain: string): Promise<string> {
    return `hash:${plain}`;
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    return hash === `hash:${plain}`;
  }

  async fakeVerify(): Promise<void> {
    this.chamadasDeFakeVerify += 1;
  }
}

class MailerFake implements IdentityMailer {
  readonly verificacoes: EmailDeVerificacao[] = [];
  readonly avisosDeContaExistente: { para: string; nome: string }[] = [];

  async enviarVerificacao(dados: EmailDeVerificacao): Promise<Result<void>> {
    this.verificacoes.push(dados);
    return ok(undefined);
  }

  async enviarAvisoDeContaExistente(dados: {
    para: Email;
    nome: string;
    urlEntrar: string;
  }): Promise<Result<void>> {
    this.avisosDeContaExistente.push({ para: dados.para.value, nome: dados.nome });
    return ok(undefined);
  }

  /** Token em claro do último link enviado — o teste lê o que o usuário leria. */
  get ultimoToken(): string {
    const ultimo = this.verificacoes.at(-1);
    if (!ultimo) throw new Error("nenhum e-mail de verificação foi enviado");
    return new URL(ultimo.url).searchParams.get("token") ?? "";
  }
}

class RateLimiterFake implements RateLimiter {
  readonly contagem = new Map<string, number>();
  #permissivo = true;

  bloquearTudo(): void {
    this.#permissivo = false;
  }

  async consume(chave: string): Promise<Result<void>> {
    this.contagem.set(chave, (this.contagem.get(chave) ?? 0) + 1);
    return this.#permissivo
      ? ok(undefined)
      : { ok: false, error: { kind: "RATE_LIMITED", code: "test.blocked", message: "bloqueado" } };
  }
}

class AuditoriaFake implements AuditTrail {
  readonly entradas: { action: string; entityId: string; metadata?: Record<string, unknown> }[] = [];

  async record(entrada: {
    actorAccountId: string | null;
    action: string;
    entity: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.entradas.push({
      action: entrada.action,
      entityId: entrada.entityId,
      ...(entrada.metadata ? { metadata: entrada.metadata } : {}),
    });
  }

  acoes(): string[] {
    return this.entradas.map((entrada) => entrada.action);
  }
}

// ── Montagem ─────────────────────────────────────────────────────────────────

const CTX: RequestContext = {
  traceId: "trace-teste",
  ipHash: "ip-hash-fake",
  userAgent: "vitest",
};

let contas: ContasFake;
let sessoes: SessoesFake;
let tokens: TokensFake;
let criancas: CriancasFake;
let hasher: HasherFake;
let mailer: MailerFake;
let rateLimiter: RateLimiterFake;
let auditoria: AuditoriaFake;
let relogio: FixedClock;
let deps: IdentityDeps;

beforeEach(() => {
  contas = new ContasFake();
  sessoes = new SessoesFake();
  tokens = new TokensFake();
  criancas = new CriancasFake();
  hasher = new HasherFake();
  mailer = new MailerFake();
  rateLimiter = new RateLimiterFake();
  auditoria = new AuditoriaFake();
  relogio = new FixedClock(new Date("2026-08-03T12:00:00.000Z"));

  deps = {
    accounts: contas,
    sessions: sessoes,
    verificationTokens: tokens,
    learners: criancas,
    hasher,
    mailer,
    rateLimiter,
    audit: auditoria,
    clock: relogio,
    appUrl: "https://crescendendoeaprendendo.vercel.app",
  };
});

const CADASTRO_VALIDO = {
  email: "mariana@exemplo.com",
  nome: "Mariana Silva",
  senha: "a casa da vovo tem quintal",
};

function codigo(resultado: Result<unknown>): string | undefined {
  return isErr(resultado) ? resultado.error.code : undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Cadastro
// ═══════════════════════════════════════════════════════════════════════════

describe("registrarResponsavel", () => {
  it("cria conta pendente de verificação e envia o link", async () => {
    const resultado = await registrarResponsavel(deps, CADASTRO_VALIDO, CTX);

    expect(resultado.ok).toBe(true);
    expect(unwrap(resultado).emailMascarado).toBe("ma•••••@exemplo.com");
    expect(contas.linhas.size).toBe(1);
    expect([...contas.linhas.values()][0]?.status).toBe("PENDING_VERIFICATION");
    expect(mailer.verificacoes).toHaveLength(1);
    expect(auditoria.acoes()).toContain("identity.account_registered");
  });

  it("persiste o resultado do hasher, não a senha digitada", async () => {
    await registrarResponsavel(deps, CADASTRO_VALIDO, CTX);
    const guardado = [...contas.linhas.values()][0]?.passwordHash ?? "";

    expect(guardado).not.toBe(CADASTRO_VALIDO.senha);
    expect(guardado).toBe(await hasher.hash(CADASTRO_VALIDO.senha));
    // Que o hash real seja irreversível é propriedade do Argon2id, verificada
    // em `infrastructure/argon2-hasher.test.ts` — aqui o hasher é um dublê.
  });

  it("não revela que o e-mail já existe — responde igual e avisa o dono", async () => {
    contas.semear({ email: "mariana@exemplo.com", nome: "Mariana" });

    const resultado = await registrarResponsavel(deps, CADASTRO_VALIDO, CTX);

    expect(resultado.ok).toBe(true);
    expect(unwrap(resultado).emailMascarado).toBe("ma•••••@exemplo.com");
    // Nenhuma conta nova, nenhum link de verificação — mas o dono foi avisado.
    expect(contas.linhas.size).toBe(1);
    expect(mailer.verificacoes).toHaveLength(0);
    expect(mailer.avisosDeContaExistente).toEqual([
      { para: "mariana@exemplo.com", nome: "Mariana" },
    ]);
  });

  it("recusa entrada inválida antes de tocar no banco", async () => {
    expect(codigo(await registrarResponsavel(deps, { ...CADASTRO_VALIDO, email: "nada" }, CTX)))
      .toBe("email.malformed");
    expect(codigo(await registrarResponsavel(deps, { ...CADASTRO_VALIDO, senha: "curta" }, CTX)))
      .toBe("password.too_short");
    expect(contas.linhas.size).toBe(0);
  });

  it("respeita o limite de criação por IP", async () => {
    rateLimiter.bloquearTudo();
    expect(codigo(await registrarResponsavel(deps, CADASTRO_VALIDO, CTX))).toBe(
      "auth.register_rate_limited",
    );
  });

  it("audita a conta mesmo quando o e-mail não sai", async () => {
    // Cenário real: produção sem provedor de e-mail configurado. A conta é
    // criada e o envio falha — a trilha não pode ficar com um buraco no lugar
    // do nascimento dela.
    deps = {
      ...deps,
      mailer: {
        async enviarVerificacao() {
          return {
            ok: false,
            error: {
              kind: "UNAVAILABLE",
              code: "mail.not_configured",
              message: "Não conseguimos enviar o e-mail agora.",
            },
          } as const;
        },
        async enviarAvisoDeContaExistente() {
          return ok(undefined);
        },
      },
    };

    const resultado = await registrarResponsavel(deps, CADASTRO_VALIDO, CTX);

    expect(codigo(resultado)).toBe("mail.not_configured");
    expect(contas.linhas.size).toBe(1);
    expect(auditoria.acoes()).toContain("identity.account_registered");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Verificação de e-mail
// ═══════════════════════════════════════════════════════════════════════════

describe("verificarEmail", () => {
  beforeEach(async () => {
    await registrarResponsavel(deps, CADASTRO_VALIDO, CTX);
  });

  it("ativa a conta com o token do link", async () => {
    const resultado = await verificarEmail(deps, mailer.ultimoToken, CTX);

    expect(resultado.ok).toBe(true);
    expect([...contas.linhas.values()][0]?.status).toBe("ACTIVE");
    expect(auditoria.acoes()).toContain("identity.email_verified");
  });

  it("consome o token — o mesmo link não serve duas vezes", async () => {
    const token = mailer.ultimoToken;
    await verificarEmail(deps, token, CTX);

    expect(codigo(await verificarEmail(deps, token, CTX))).toBe(
      "auth.verification_token_invalid",
    );
  });

  it("guarda o token em hash, nunca em claro", async () => {
    const token = mailer.ultimoToken;
    expect(tokens.linhas[0]?.tokenHash).toBe(hashToken(token));
    expect(tokens.linhas[0]?.tokenHash).not.toBe(token);
  });

  it("recusa token expirado e o remove do banco", async () => {
    const token = mailer.ultimoToken;
    relogio.advanceDays(2);

    expect(codigo(await verificarEmail(deps, token, CTX))).toBe(
      "auth.verification_token_invalid",
    );
    expect(tokens.linhas).toHaveLength(0);
  });

  it("recusa token inventado sem dizer o motivo real", async () => {
    expect(codigo(await verificarEmail(deps, "token-que-nunca-existiu", CTX))).toBe(
      "auth.verification_token_invalid",
    );
  });

  it("emitir novo token invalida o anterior", async () => {
    const primeiro = mailer.ultimoToken;
    await reenviarVerificacao(deps, CADASTRO_VALIDO.email, CTX);
    const segundo = mailer.ultimoToken;

    expect(segundo).not.toBe(primeiro);
    expect(codigo(await verificarEmail(deps, primeiro, CTX))).toBe(
      "auth.verification_token_invalid",
    );
    expect((await verificarEmail(deps, segundo, CTX)).ok).toBe(true);
  });

  it("reenvio responde igual para e-mail que não existe", async () => {
    const resultado = await reenviarVerificacao(deps, "ninguem@exemplo.com", CTX);
    expect(resultado.ok).toBe(true);
    expect(unwrap(resultado).emailMascarado).toBe("ni•••••@exemplo.com");
    expect(mailer.verificacoes).toHaveLength(1); // só o do cadastro
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Entrada e sessão
// ═══════════════════════════════════════════════════════════════════════════

describe("entrar", () => {
  beforeEach(() => {
    contas.semear({ email: "mariana@exemplo.com", passwordHash: "hash:senha-boa-mesmo" });
  });

  it("abre sessão de 30 dias e devolve o token em claro uma única vez", async () => {
    const resultado = await entrar(
      deps,
      { email: "mariana@exemplo.com", senha: "senha-boa-mesmo" },
      CTX,
    );

    const saida = unwrap(resultado);
    expect(saida.sessionToken).toHaveLength(43);
    expect(saida.expiresAt).toEqual(new Date("2026-09-02T12:00:00.000Z"));
    expect(auditoria.acoes()).toContain("identity.signed_in");
  });

  it("guarda apenas o hash do token de sessão", async () => {
    const saida = unwrap(
      await entrar(deps, { email: "mariana@exemplo.com", senha: "senha-boa-mesmo" }, CTX),
    );
    const linha = [...sessoes.linhas.values()][0];

    expect(linha?.tokenHash).toBe(hashToken(saida.sessionToken));
    expect(linha?.tokenHash).not.toBe(saida.sessionToken);
  });

  it("dá a mesma resposta para e-mail inexistente e senha errada", async () => {
    const inexistente = await entrar(deps, { email: "ninguem@exemplo.com", senha: "seja-la-o-que-for" }, CTX);
    const senhaErrada = await entrar(deps, { email: "mariana@exemplo.com", senha: "senha-errada-aqui" }, CTX);

    expect(codigo(inexistente)).toBe("auth.invalid_credentials");
    expect(codigo(senhaErrada)).toBe("auth.invalid_credentials");
  });

  it("gasta o mesmo tempo de hash quando a conta não existe", async () => {
    await entrar(deps, { email: "ninguem@exemplo.com", senha: "seja-la-o-que-for" }, CTX);
    expect(hasher.chamadasDeFakeVerify).toBe(1);
  });

  it("deixa entrar sem e-mail verificado, sinalizando o estado", async () => {
    contas.linhas.clear();
    contas.semear({
      email: "novo@exemplo.com",
      passwordHash: "hash:senha-boa-mesmo",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
    });

    const saida = unwrap(
      await entrar(deps, { email: "novo@exemplo.com", senha: "senha-boa-mesmo" }, CTX),
    );
    expect(saida.emailVerificado).toBe(false);
  });

  it("recusa conta suspensa somente depois de conferir a senha", async () => {
    contas.linhas.clear();
    contas.semear({
      email: "suspensa@exemplo.com",
      passwordHash: "hash:senha-boa-mesmo",
      status: "SUSPENDED",
    });

    expect(codigo(await entrar(deps, { email: "suspensa@exemplo.com", senha: "senha-errada-aqui" }, CTX)))
      .toBe("auth.invalid_credentials");
    expect(codigo(await entrar(deps, { email: "suspensa@exemplo.com", senha: "senha-boa-mesmo" }, CTX)))
      .toBe("account.suspended");
  });

  it("respeita o limite de tentativas por IP", async () => {
    rateLimiter.bloquearTudo();
    expect(codigo(await entrar(deps, { email: "mariana@exemplo.com", senha: "senha-boa-mesmo" }, CTX)))
      .toBe("auth.login_rate_limited");
  });
});

describe("resolverSessao e sair", () => {
  async function abrirSessao(): Promise<string> {
    contas.semear({ email: "mariana@exemplo.com", passwordHash: "hash:senha-boa-mesmo" });
    const saida = unwrap(
      await entrar(deps, { email: "mariana@exemplo.com", senha: "senha-boa-mesmo" }, CTX),
    );
    return saida.sessionToken;
  }

  it("traduz token em ator", async () => {
    const token = await abrirSessao();
    const ator = await resolverSessao(deps, token);

    expect(ator?.account.email.value).toBe("mariana@exemplo.com");
    expect(ator?.activeLearnerId).toBeNull();
  });

  it("devolve null para token ausente, inventado ou expirado", async () => {
    const token = await abrirSessao();

    expect(await resolverSessao(deps, null)).toBeNull();
    expect(await resolverSessao(deps, "token-inventado")).toBeNull();

    relogio.advanceDays(31);
    expect(await resolverSessao(deps, token)).toBeNull();
  });

  it("derruba a sessão quando a conta é suspensa depois do login", async () => {
    const token = await abrirSessao();
    const linha = [...contas.linhas.values()][0];
    if (linha) linha.status = "SUSPENDED";

    expect(await resolverSessao(deps, token)).toBeNull();
  });

  it("sair revoga a sessão e é idempotente", async () => {
    const token = await abrirSessao();

    expect((await sair(deps, token, CTX)).ok).toBe(true);
    expect(await resolverSessao(deps, token)).toBeNull();
    expect((await sair(deps, token, CTX)).ok).toBe(true);
    expect((await sair(deps, null, CTX)).ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Família e sub-sessão de criança
// ═══════════════════════════════════════════════════════════════════════════

describe("perfil de criança", () => {
  async function atorVerificado() {
    contas.semear({ email: "mariana@exemplo.com", passwordHash: "hash:senha-boa-mesmo" });
    const saida = unwrap(
      await entrar(deps, { email: "mariana@exemplo.com", senha: "senha-boa-mesmo" }, CTX),
    );
    const ator = await resolverSessao(deps, saida.sessionToken);
    if (!ator) throw new Error("sessão não resolvida");
    return ator;
  }

  const PERFIL = { displayName: "Cecília", birthYear: 2019, relation: "mãe" };

  it("cria a criança na faixa certa e sem conta própria", async () => {
    const perfil = unwrap(await criarPerfilDeCrianca(deps, await atorVerificado(), PERFIL, CTX));

    expect(perfil.displayName).toBe("Cecília");
    expect(perfil.ageBand).toBe("SPROUT");
    // ADR 0003: criança não vira Account.
    expect(contas.linhas.size).toBe(1);
  });

  it("não deixa a auditoria guardar dado de criança", async () => {
    await criarPerfilDeCrianca(deps, await atorVerificado(), PERFIL, CTX);
    const entrada = auditoria.entradas.find((e) => e.action === "identity.learner_created");

    expect(JSON.stringify(entrada)).not.toContain("Cecília");
    expect(JSON.stringify(entrada)).not.toContain("2019");
  });

  it("exige e-mail verificado — consentimento parental antes de dado de criança", async () => {
    contas.linhas.clear();
    contas.semear({
      email: "novo@exemplo.com",
      passwordHash: "hash:senha-boa-mesmo",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
    });
    const saida = unwrap(await entrar(deps, { email: "novo@exemplo.com", senha: "senha-boa-mesmo" }, CTX));
    const ator = await resolverSessao(deps, saida.sessionToken);
    if (!ator) throw new Error("sessão não resolvida");

    expect(codigo(await criarPerfilDeCrianca(deps, ator, PERFIL, CTX))).toBe(
      "account.email_not_verified",
    );
    expect(criancas.linhas).toHaveLength(0);
  });

  it("respeita o teto de crianças por conta", async () => {
    const ator = await atorVerificado();
    for (let i = 0; i < LIMITES.criancasPorConta; i += 1) {
      await criarPerfilDeCrianca(deps, ator, { ...PERFIL, displayName: `Crianca${"a".repeat(i)}` }, CTX);
    }

    expect(codigo(await criarPerfilDeCrianca(deps, ator, PERFIL, CTX))).toBe("learner.too_many");
  });

  it("lista apenas as crianças da própria família", async () => {
    const ator = await atorVerificado();
    await criarPerfilDeCrianca(deps, ator, PERFIL, CTX);

    const outraFamilia = contas.semear({ email: "outro@exemplo.com" });
    await criancas.create({
      guardianAccountId: outraFamilia.id,
      displayName: "Alheia",
      birthYear: 2019,
      ageBand: "SPROUT",
      locale: "pt-BR",
      relation: "pai",
    });

    const lista = unwrap(await listarFamilia(deps, ator));
    expect(lista.map((p) => p.displayName)).toEqual(["Cecília"]);
  });
});

describe("sub-sessão de criança", () => {
  async function familiaPronta() {
    contas.semear({ email: "mariana@exemplo.com", passwordHash: "hash:senha-boa-mesmo" });
    const saida = unwrap(
      await entrar(deps, { email: "mariana@exemplo.com", senha: "senha-boa-mesmo" }, CTX),
    );
    let ator = await resolverSessao(deps, saida.sessionToken);
    if (!ator) throw new Error("sessão não resolvida");

    const perfil = unwrap(
      await criarPerfilDeCrianca(deps, ator, { displayName: "Cecília", birthYear: 2019, relation: "mãe" }, CTX),
    );
    await definirPinDoResponsavel(deps, ator, "4827", CTX);

    // Recarrega o ator: a conta agora tem PIN.
    ator = await resolverSessao(deps, saida.sessionToken);
    if (!ator) throw new Error("sessão não resolvida");
    return { ator, perfil, token: saida.sessionToken };
  }

  it("abre a área infantil sem trocar a sessão do adulto", async () => {
    const { ator, perfil, token } = await familiaPronta();

    const aberta = unwrap(await iniciarSessaoDeCrianca(deps, ator, perfil.id, CTX));
    expect(aberta.learner.displayName).toBe("Cecília");
    expect(aberta.expiraEm).toEqual(new Date("2026-08-03T16:00:00.000Z")); // 4h

    const depois = await resolverSessao(deps, token);
    expect(depois?.activeLearnerId).toBe(perfil.id);
    expect(depois?.account.id).toBe(ator.account.id);
  });

  it("recusa abrir sem PIN definido — a porta de saída não trancaria", async () => {
    contas.semear({ email: "sempin@exemplo.com", passwordHash: "hash:senha-boa-mesmo" });
    const saida = unwrap(await entrar(deps, { email: "sempin@exemplo.com", senha: "senha-boa-mesmo" }, CTX));
    const ator = await resolverSessao(deps, saida.sessionToken);
    if (!ator) throw new Error("sessão não resolvida");
    const perfil = unwrap(
      await criarPerfilDeCrianca(deps, ator, { displayName: "Cecília", birthYear: 2019, relation: "mãe" }, CTX),
    );

    expect(codigo(await iniciarSessaoDeCrianca(deps, ator, perfil.id, CTX))).toBe(
      "account.pin_not_set",
    );
  });

  it("recusa criança de outra família sem distinguir de inexistente", async () => {
    const { ator } = await familiaPronta();
    const outra = contas.semear({ email: "outro@exemplo.com" });
    const alheia = await criancas.create({
      guardianAccountId: outra.id,
      displayName: "Alheia",
      birthYear: 2019,
      ageBand: "SPROUT",
      locale: "pt-BR",
      relation: "pai",
    });

    expect(codigo(await iniciarSessaoDeCrianca(deps, ator, alheia.id, CTX))).toBe("learner.not_found");
    expect(codigo(await iniciarSessaoDeCrianca(deps, ator, "lea_inexistente", CTX))).toBe("learner.not_found");
  });

  it("só sai da área infantil com o PIN certo", async () => {
    const { perfil, token } = await familiaPronta();
    let ator = await resolverSessao(deps, token);
    if (!ator) throw new Error("sessão não resolvida");
    await iniciarSessaoDeCrianca(deps, ator, perfil.id, CTX);

    ator = await resolverSessao(deps, token);
    if (!ator) throw new Error("sessão não resolvida");

    expect(codigo(await encerrarSessaoDeCrianca(deps, ator, "0000", CTX))).toBe("auth.pin_invalid");
    expect((await resolverSessao(deps, token))?.activeLearnerId).toBe(perfil.id);
    expect(auditoria.acoes()).toContain("identity.parent_pin_failed");

    expect((await encerrarSessaoDeCrianca(deps, ator, "4827", CTX)).ok).toBe(true);
    expect((await resolverSessao(deps, token))?.activeLearnerId).toBeNull();
  });

  it("limita tentativas de PIN", async () => {
    const { perfil, token } = await familiaPronta();
    let ator = await resolverSessao(deps, token);
    if (!ator) throw new Error("sessão não resolvida");
    await iniciarSessaoDeCrianca(deps, ator, perfil.id, CTX);
    ator = await resolverSessao(deps, token);
    if (!ator) throw new Error("sessão não resolvida");

    rateLimiter.bloquearTudo();
    expect(codigo(await encerrarSessaoDeCrianca(deps, ator, "4827", CTX))).toBe("auth.pin_rate_limited");
  });

  it("recusa PIN fraco ao definir", async () => {
    const { ator } = await familiaPronta();
    expect(codigo(await definirPinDoResponsavel(deps, ator, "1234", CTX))).toBe("pin.sequential");
    expect(codigo(await definirPinDoResponsavel(deps, ator, "1111", CTX))).toBe("pin.repeated");
  });
});
