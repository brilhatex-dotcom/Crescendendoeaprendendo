import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { systemClock, unwrap, isErr, type Result } from "@/shared/kernel";
import {
  criarPerfilDeCrianca,
  definirPinDoResponsavel,
  encerrarSessaoDeCrianca,
  entrar,
  iniciarSessaoDeCrianca,
  listarFamilia,
  registrarResponsavel,
  resolverSessao,
  verificarEmail,
  type IdentityDeps,
  type RequestContext,
} from "@/modules/identity";
import { Argon2Hasher } from "@/modules/identity/infrastructure/argon2-hasher";
import { InMemoryRateLimiter } from "@/modules/identity/infrastructure/memory-rate-limiter";
import { PrismaAccountRepository } from "@/modules/identity/infrastructure/prisma-account-repository";
import { PrismaAuditTrail } from "@/modules/identity/infrastructure/prisma-audit-trail";
import { PrismaLearnerRepository } from "@/modules/identity/infrastructure/prisma-learner-repository";
import { PrismaSessionRepository } from "@/modules/identity/infrastructure/prisma-session-repository";
import { PrismaVerificationTokenRepository } from "@/modules/identity/infrastructure/prisma-verification-token-repository";
import type { EmailDeVerificacao, IdentityMailer } from "@/modules/identity/application/ports";

/**
 * Teste de integração — Postgres de verdade, Argon2 de verdade.
 *
 * Os testes de `application/identity.test.ts` provam a *regra* com dublês. Este
 * prova o que dublê nenhum alcança: que o SQL gerado funciona, que a transação
 * de criação de criança é atômica, que o filtro de guarda está no `where` e
 * que os enums do Prisma batem com os tipos do domínio.
 *
 * Roda fora do `npm run verify`, por `npm run test:integration`, porque exige
 * banco. O CI o executa num job próprio com serviço de Postgres.
 */

const db = new PrismaClient();
const ctx: RequestContext = {
  traceId: "integracao",
  ipHash: "hash-de-ip",
  userAgent: "vitest",
};

/** Captura o link de verificação sem enviar e-mail de verdade. */
class MailerDeTeste implements IdentityMailer {
  readonly enviados: EmailDeVerificacao[] = [];

  async enviarVerificacao(dados: EmailDeVerificacao): Promise<Result<void>> {
    this.enviados.push(dados);
    return { ok: true, value: undefined };
  }

  async enviarAvisoDeContaExistente(): Promise<Result<void>> {
    return { ok: true, value: undefined };
  }

  get ultimoToken(): string {
    const ultimo = this.enviados.at(-1);
    if (!ultimo) throw new Error("nenhum e-mail enviado");
    return new URL(ultimo.url).searchParams.get("token") ?? "";
  }
}

let mailer: MailerDeTeste;
let deps: IdentityDeps;

beforeEach(async () => {
  // Ordem importa: filhos antes dos pais, senão a FK reclama.
  await db.auditLog.deleteMany();
  await db.guardianLink.deleteMany();
  await db.learnerSettings.deleteMany();
  await db.learner.deleteMany();
  await db.session.deleteMany();
  await db.verificationToken.deleteMany();
  await db.accountRoleAssignment.deleteMany();
  await db.account.deleteMany();

  mailer = new MailerDeTeste();
  deps = {
    accounts: new PrismaAccountRepository(db),
    sessions: new PrismaSessionRepository(db),
    verificationTokens: new PrismaVerificationTokenRepository(db),
    learners: new PrismaLearnerRepository(db),
    hasher: new Argon2Hasher(),
    mailer,
    rateLimiter: new InMemoryRateLimiter(systemClock),
    audit: new PrismaAuditTrail(db),
    clock: systemClock,
    appUrl: "https://crescendendoeaprendendo.vercel.app",
  };
});

afterAll(async () => {
  await db.$disconnect();
});

const CADASTRO = {
  email: "mariana@exemplo.com",
  nome: "Mariana Silva",
  senha: "a casa da vovo tem quintal",
};

describe("jornada completa da Etapa 0", () => {
  it("cadastra, verifica, cria criança, abre e fecha a área infantil", async () => {
    // 1 · cadastro
    expect((await registrarResponsavel(deps, CADASTRO, ctx)).ok).toBe(true);

    const linha = await db.account.findFirstOrThrow();
    expect(linha.status).toBe("PENDING_VERIFICATION");
    expect(linha.passwordHash).toMatch(/^\$argon2id\$/);
    expect(linha.passwordHash).not.toContain("quintal");

    // O papel GUARDIAN nasce junto, escopado à família.
    const papeis = await db.accountRoleAssignment.findMany();
    expect(papeis).toHaveLength(1);
    expect(papeis[0]?.role).toBe("GUARDIAN");
    expect(papeis[0]?.organizationId).toBeNull();

    // 2 · verificação de e-mail
    expect((await verificarEmail(deps, mailer.ultimoToken, ctx)).ok).toBe(true);
    expect((await db.account.findFirstOrThrow()).status).toBe("ACTIVE");
    expect(await db.verificationToken.count()).toBe(0); // uso único

    // 3 · login
    const login = unwrap(
      await entrar(deps, { email: CADASTRO.email, senha: CADASTRO.senha }, ctx),
    );
    const ator = await resolverSessao(deps, login.sessionToken);
    expect(ator).not.toBeNull();
    if (!ator) throw new Error("sessão não resolvida");

    // O banco guarda o hash do token, nunca o token.
    const sessao = await db.session.findFirstOrThrow();
    expect(sessao.tokenHash).not.toBe(login.sessionToken);

    // 4 · perfil da criança
    const crianca = unwrap(
      await criarPerfilDeCrianca(
        deps,
        ator,
        { displayName: "Cecília", birthYear: 2019, relation: "mãe" },
        ctx,
      ),
    );
    expect(crianca.ageBand).toBe("SPROUT");

    // A transação criou os três registros, não só a criança.
    expect(await db.learner.count()).toBe(1);
    expect(await db.learnerSettings.count()).toBe(1);
    expect(await db.guardianLink.count()).toBe(1);

    // Acessibilidade por padrão em SPROUT (Bíblia Cap. 1 V6).
    const ajustes = await db.learnerSettings.findFirstOrThrow();
    expect(ajustes.textToSpeech).toBe(true);

    // Pseudônimo para telemetria/IA nasce separado do id real.
    const learnerRow = await db.learner.findFirstOrThrow();
    expect(learnerRow.pseudonymId).not.toBe(learnerRow.id);

    // 5 · PIN e área infantil
    expect((await definirPinDoResponsavel(deps, ator, "4827", ctx)).ok).toBe(true);

    const atorComPin = await resolverSessao(deps, login.sessionToken);
    if (!atorComPin) throw new Error("sessão não resolvida");

    expect((await iniciarSessaoDeCrianca(deps, atorComPin, crianca.id, ctx)).ok).toBe(true);
    expect((await db.session.findFirstOrThrow()).activeLearnerId).toBe(crianca.id);

    // 6 · saída exige o PIN certo
    const dentro = await resolverSessao(deps, login.sessionToken);
    if (!dentro) throw new Error("sessão não resolvida");

    const pinErrado = await encerrarSessaoDeCrianca(deps, dentro, "9999", ctx);
    expect(isErr(pinErrado) && pinErrado.error.code).toBe("auth.pin_invalid");
    expect((await db.session.findFirstOrThrow()).activeLearnerId).toBe(crianca.id);

    expect((await encerrarSessaoDeCrianca(deps, dentro, "4827", ctx)).ok).toBe(true);
    expect((await db.session.findFirstOrThrow()).activeLearnerId).toBeNull();
  });

  it("isola as famílias no nível da consulta", async () => {
    const criarFamilia = async (email: string, apelido: string) => {
      await registrarResponsavel(deps, { ...CADASTRO, email }, ctx);
      await verificarEmail(deps, mailer.ultimoToken, ctx);
      const login = unwrap(await entrar(deps, { email, senha: CADASTRO.senha }, ctx));
      const ator = await resolverSessao(deps, login.sessionToken);
      if (!ator) throw new Error("sessão não resolvida");
      const perfil = unwrap(
        await criarPerfilDeCrianca(
          deps,
          ator,
          { displayName: apelido, birthYear: 2019, relation: "mãe" },
          ctx,
        ),
      );
      await definirPinDoResponsavel(deps, ator, "4827", ctx);
      const atualizado = await resolverSessao(deps, login.sessionToken);
      if (!atualizado) throw new Error("sessão não resolvida");
      return { ator: atualizado, perfil };
    };

    const a = await criarFamilia("familia-a@exemplo.com", "Cecília");
    const b = await criarFamilia("familia-b@exemplo.com", "Rafael");

    // Cada uma vê apenas a própria criança.
    expect(unwrap(await listarFamilia(deps, a.ator)).map((p) => p.displayName)).toEqual([
      "Cecília",
    ]);

    // E não consegue abrir a área infantil da outra.
    const invasao = await iniciarSessaoDeCrianca(deps, a.ator, b.perfil.id, ctx);
    expect(isErr(invasao) && invasao.error.code).toBe("learner.not_found");
  });

  it("registra a trilha de auditoria sem dado de criança", async () => {
    await registrarResponsavel(deps, CADASTRO, ctx);
    await verificarEmail(deps, mailer.ultimoToken, ctx);
    const login = unwrap(
      await entrar(deps, { email: CADASTRO.email, senha: CADASTRO.senha }, ctx),
    );
    const ator = await resolverSessao(deps, login.sessionToken);
    if (!ator) throw new Error("sessão não resolvida");
    await criarPerfilDeCrianca(
      deps,
      ator,
      { displayName: "Cecília", birthYear: 2019, relation: "mãe" },
      ctx,
    );

    const trilha = await db.auditLog.findMany({ orderBy: { id: "asc" } });
    expect(trilha.map((linha) => linha.action)).toEqual([
      "identity.account_registered",
      "identity.email_verified",
      "identity.signed_in",
      "identity.learner_created",
    ]);
    // `AuditLog.id` é BigInt (escrita sequencial, docs/04 §1) e BigInt não tem
    // representação em JSON — daí o replacer.
    const serializada = JSON.stringify(trilha, (_chave, valor: unknown) =>
      typeof valor === "bigint" ? valor.toString() : valor,
    );
    expect(serializada).not.toContain("Cecília");
    expect(serializada).not.toContain("2019");
  });

  it("recusa e-mail duplicado sem criar segunda conta", async () => {
    await registrarResponsavel(deps, CADASTRO, ctx);
    // Resposta idêntica à do caminho feliz — e nenhuma conta a mais.
    expect((await registrarResponsavel(deps, CADASTRO, ctx)).ok).toBe(true);
    expect(await db.account.count()).toBe(1);
  });
});
