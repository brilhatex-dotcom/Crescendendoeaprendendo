import { err, ok, rateLimited, validationError, type Result } from "@/shared/kernel";
import { generateToken, hashToken } from "@/shared/security/tokens";

import { Email, PlainPassword } from "../../domain";
import type { IdentityDeps, RequestContext } from "../deps";
import { DURACAO, LIMITES } from "../policy";

/**
 * Redefinição de senha "esqueci minha senha", pelo mesmo padrão de
 * `verify-email.ts` — link de uso único por e-mail, mesma resposta exista ou
 * não a conta.
 *
 * ── Sobre reusar `VerificationTokenRepository` ──
 * Não existe uma tabela própria para este token. `VerificationToken` já é só
 * "identificador → hash de uso único com prazo"; criar um par de
 * modelo+migração idênticos só para trocar o nome seria duplicar sem ganhar
 * nada. O que separa os dois usos é o prefixo do identificador
 * (`PREFIXO_REDEFINICAO` vs. o `accountId` puro da verificação de e-mail) —
 * pedir uma redefinição de senha não invalida um link de verificação
 * pendente, e vice-versa, porque `issue()` só apaga tokens do mesmo
 * identificador.
 */
const PREFIXO_REDEFINICAO = "pwreset:";

export interface PedirRedefinicaoOutput {
  readonly emailMascarado: string;
}

export async function pedirRedefinicaoDeSenha(
  deps: IdentityDeps,
  emailBruto: string,
  ctx: RequestContext,
): Promise<Result<PedirRedefinicaoOutput>> {
  const email = Email.create(emailBruto);
  if (!email.ok) return email;

  const limite = await deps.rateLimiter.consume(
    `redefinicao:${hashToken(email.value.value)}`,
    LIMITES.pedidoDeRedefinicao.limite,
    LIMITES.pedidoDeRedefinicao.janelaMs,
  );
  if (!limite.ok) {
    return err(
      rateLimited(
        "auth.reset_rate_limited",
        "Já enviamos alguns e-mails para este endereço. Espere um pouco antes de pedir outro.",
      ),
    );
  }

  const saida = ok({ emailMascarado: email.value.masked });

  const conta = await deps.accounts.findByEmail(email.value);
  // Conta inexistente ou só-OAuth (sem senha para redefinir): mesma resposta,
  // nenhum e-mail sai. Diferenciar aqui reabriria o oráculo de contas que o
  // cadastro já fecha (docs/09 §5).
  if (!conta || !conta.hasPassword) return saida;

  const agora = deps.clock.now();
  const token = generateToken();
  const expiresAt = new Date(agora.getTime() + DURACAO.tokenDeRedefinicaoSenha);

  await deps.verificationTokens.issue({
    identifier: `${PREFIXO_REDEFINICAO}${conta.id}`,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const enviado = await deps.mailer.enviarRedefinicaoDeSenha({
    para: email.value,
    nome: conta.name,
    url: `${deps.appUrl}/redefinir-senha?token=${encodeURIComponent(token)}`,
    expiraEm: expiresAt,
  });
  if (!enviado.ok) return enviado;

  await deps.audit.record({
    actorAccountId: conta.id,
    action: "identity.password_reset_requested",
    entity: "Account",
    entityId: conta.id,
    metadata: { traceId: ctx.traceId },
  });

  return saida;
}

export interface RedefinirSenhaOutput {
  readonly accountId: string;
}

/**
 * Consome o token do link e grava a senha nova.
 *
 * Toda sessão ativa da conta é revogada — igual ao script de operador
 * (`scripts/redefinir-senha.ts`), pelo mesmo motivo: trocar a senha e
 * continuar logado em todo lugar já conectado anularia o propósito da troca.
 */
export async function redefinirSenha(
  deps: IdentityDeps,
  token: string,
  novaSenhaBruta: string,
  ctx: RequestContext,
): Promise<Result<RedefinirSenhaOutput>> {
  const invalido = err(
    validationError(
      "auth.reset_token_invalid",
      "Este link de redefinição não vale mais. Peça um novo.",
    ),
  );

  if (token.trim().length === 0) return invalido;

  const registro = await deps.verificationTokens.find(hashToken(token));
  if (!registro || !registro.identifier.startsWith(PREFIXO_REDEFINICAO)) return invalido;

  const agora = deps.clock.now();
  if (registro.expiresAt.getTime() <= agora.getTime()) {
    await deps.verificationTokens.consume(registro.tokenHash);
    return invalido;
  }

  const accountId = registro.identifier.slice(PREFIXO_REDEFINICAO.length);
  const conta = await deps.accounts.findById(accountId);
  if (!conta) return invalido;

  const permitido = conta.canSignIn();
  if (!permitido.ok) return permitido;

  const senha = PlainPassword.create(novaSenhaBruta, conta.email.value);
  if (!senha.ok) return senha;

  const passwordHash = await deps.hasher.hash(senha.value.reveal());

  await deps.accounts.updatePasswordHash(conta.id, passwordHash);
  await deps.sessions.revokeAllForAccount(conta.id, agora);
  await deps.verificationTokens.consume(registro.tokenHash);

  await deps.audit.record({
    actorAccountId: conta.id,
    action: "identity.password_reset",
    entity: "Account",
    entityId: conta.id,
    metadata: { traceId: ctx.traceId },
  });

  return ok({ accountId: conta.id });
}
