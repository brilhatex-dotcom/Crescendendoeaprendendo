import { err, ok, rateLimited, validationError, type Result } from "@/shared/kernel";
import { hashToken } from "@/shared/security/tokens";

import { Email } from "../../domain";
import type { IdentityDeps, RequestContext } from "../deps";
import { LIMITES } from "../policy";
import { emitirVerificacao } from "./register-guardian";

export interface VerificarEmailOutput {
  readonly accountId: string;
  readonly nome: string;
}

/**
 * Consome o token do link e ativa a conta.
 *
 * O token vale uma vez só: é apagado assim que aceito. Se o responsável clicar
 * de novo, cai no ramo "já verificada" da entidade — que responde sucesso sem
 * repetir efeito. Ver `Account.verifyEmail`.
 */
export async function verificarEmail(
  deps: IdentityDeps,
  token: string,
  ctx: RequestContext,
): Promise<Result<VerificarEmailOutput>> {
  const invalido = err(
    validationError(
      "auth.verification_token_invalid",
      "Este link de verificação não vale mais. Peça um novo.",
    ),
  );

  if (token.trim().length === 0) return invalido;

  const registro = await deps.verificationTokens.find(hashToken(token));
  if (!registro) return invalido;

  const agora = deps.clock.now();
  if (registro.expiresAt.getTime() <= agora.getTime()) {
    // Expirado é lixo: sai do banco agora, não espera rotina de limpeza.
    await deps.verificationTokens.consume(registro.tokenHash);
    return invalido;
  }

  const conta = await deps.accounts.findById(registro.identifier);
  if (!conta) return invalido;

  const verificacao = conta.verifyEmail(agora, ctx.traceId);
  if (!verificacao.ok) return verificacao;

  await deps.accounts.markEmailVerified(conta.id, agora);
  await deps.verificationTokens.consume(registro.tokenHash);

  await deps.audit.record({
    actorAccountId: conta.id,
    action: "identity.email_verified",
    entity: "Account",
    entityId: conta.id,
    metadata: { traceId: ctx.traceId },
  });

  return ok({ accountId: conta.id, nome: conta.name });
}

export interface ReenviarVerificacaoOutput {
  readonly emailMascarado: string;
}

/**
 * Reenvia o link. Também responde igual para conta inexistente, conta já
 * verificada e conta pendente — pelo mesmo motivo do cadastro.
 */
export async function reenviarVerificacao(
  deps: IdentityDeps,
  emailBruto: string,
  ctx: RequestContext,
): Promise<Result<ReenviarVerificacaoOutput>> {
  const email = Email.create(emailBruto);
  if (!email.ok) return email;

  const limite = await deps.rateLimiter.consume(
    `reenvio:${hashToken(email.value.value)}`,
    LIMITES.reenvioDeVerificacao.limite,
    LIMITES.reenvioDeVerificacao.janelaMs,
  );
  if (!limite.ok) {
    return err(
      rateLimited(
        "auth.resend_rate_limited",
        "Já enviamos alguns e-mails para este endereço. Espere um pouco antes de pedir outro.",
      ),
    );
  }

  const saida = ok({ emailMascarado: email.value.masked });

  const conta = await deps.accounts.findByEmail(email.value);
  if (!conta || conta.isEmailVerified) return saida;

  const envio = await emitirVerificacao(deps, {
    accountId: conta.id,
    email: email.value,
    nome: conta.name,
    agora: deps.clock.now(),
  });
  if (!envio.ok) return envio;

  await deps.audit.record({
    actorAccountId: conta.id,
    action: "identity.verification_resent",
    entity: "Account",
    entityId: conta.id,
    metadata: { traceId: ctx.traceId },
  });

  return saida;
}
