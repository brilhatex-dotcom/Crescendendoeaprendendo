import {
  err,
  ok,
  rateLimited,
  unauthenticated,
  type Result,
} from "@/shared/kernel";
import { generateToken, hashToken } from "@/shared/security/tokens";

import { Email } from "../../domain";
import type { IdentityDeps, RequestContext } from "../deps";
import { DURACAO, LIMITES } from "../policy";

export interface EntrarInput {
  readonly email: string;
  readonly senha: string;
}

export interface EntrarOutput {
  /** Token em claro — só a camada de apresentação vê, para gravar no cookie. */
  readonly sessionToken: string;
  readonly expiresAt: Date;
  readonly accountId: string;
  readonly emailVerificado: boolean;
}

/**
 * Autentica o responsável e abre a sessão adulta.
 *
 * Três decisões que parecem detalhe e não são:
 *
 * 1. **Uma única mensagem de erro** para e-mail inexistente, senha errada e
 *    conta excluída. Mensagens distintas viram um oráculo de contas.
 * 2. **`fakeVerify()` quando a conta não existe.** Sem isso, a resposta para
 *    e-mail desconhecido volta em milissegundos e a resposta para e-mail real
 *    demora o tempo do Argon2 — a diferença é medível e enumera contas do mesmo
 *    jeito, só que pelo relógio.
 * 3. **Token novo a cada login** (nunca reaproveitado), guardado em hash. Ver
 *    docs/09 §5, "sequestro de sessão".
 */
export async function entrar(
  deps: IdentityDeps,
  input: EntrarInput,
  ctx: RequestContext,
): Promise<Result<EntrarOutput>> {
  const limite = await deps.rateLimiter.consume(
    `login:${ctx.ipHash ?? "sem-ip"}`,
    LIMITES.login.limite,
    LIMITES.login.janelaMs,
  );
  if (!limite.ok) {
    return err(
      rateLimited(
        "auth.login_rate_limited",
        "Muitas tentativas. Aguarde um minuto e tente de novo.",
      ),
    );
  }

  const credencialInvalida = err(
    unauthenticated("auth.invalid_credentials", "E-mail ou senha incorretos."),
  );

  const email = Email.create(input.email);
  if (!email.ok) {
    await deps.hasher.fakeVerify();
    return credencialInvalida;
  }

  const conta = await deps.accounts.findByEmail(email.value);
  if (!conta) {
    await deps.hasher.fakeVerify();
    return credencialInvalida;
  }

  const hashGuardado = await deps.accounts.findPasswordHash(conta.id);
  if (!hashGuardado) {
    // Conta só de OAuth. Gastamos o mesmo tempo e damos a mesma resposta.
    await deps.hasher.fakeVerify();
    return credencialInvalida;
  }

  const senhaConfere = await deps.hasher.verify(hashGuardado, input.senha);
  if (!senhaConfere) return credencialInvalida;

  // Só depois de provar a senha é que o estado da conta pode falar. Checar
  // status antes vazaria a existência da conta para quem errou a senha.
  const permitido = conta.canSignIn();
  if (!permitido.ok) return permitido;

  const agora = deps.clock.now();
  const token = generateToken();
  const expiresAt = new Date(agora.getTime() + DURACAO.sessaoAdulta);

  await deps.sessions.create({
    accountId: conta.id,
    tokenHash: hashToken(token),
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
    expiresAt,
  });

  await deps.accounts.registerLogin(conta.id, agora);
  await deps.audit.record({
    actorAccountId: conta.id,
    action: "identity.signed_in",
    entity: "Account",
    entityId: conta.id,
    metadata: { traceId: ctx.traceId },
  });

  return ok({
    sessionToken: token,
    expiresAt,
    accountId: conta.id,
    emailVerificado: conta.isEmailVerified,
  });
}

/** Encerra a sessão adulta. Idempotente: token já morto não é erro. */
export async function sair(
  deps: IdentityDeps,
  sessionToken: string | null,
  ctx: RequestContext,
): Promise<Result<void>> {
  if (!sessionToken) return ok(undefined);

  const agora = deps.clock.now();
  const sessao = await deps.sessions.findLiveByTokenHash(hashToken(sessionToken), agora);
  if (!sessao) return ok(undefined);

  await deps.sessions.revoke(sessao.id, agora);
  await deps.audit.record({
    actorAccountId: sessao.accountId,
    action: "identity.signed_out",
    entity: "Session",
    entityId: sessao.id,
    metadata: { traceId: ctx.traceId },
  });

  return ok(undefined);
}
