import { err, ok, rateLimited, type Result } from "@/shared/kernel";
import { generateToken, hashToken } from "@/shared/security/tokens";

import { Email, GuardianName, PlainPassword } from "../../domain";
import type { IdentityDeps, RequestContext } from "../deps";
import { DURACAO, LIMITES } from "../policy";

export interface RegistrarResponsavelInput {
  readonly email: string;
  readonly nome: string;
  readonly senha: string;
  readonly locale?: string;
}

export interface RegistrarResponsavelOutput {
  /** Para a tela dizer "enviamos para ma•••••@exemplo.com" sem expor o endereço. */
  readonly emailMascarado: string;
}

/**
 * Cria a conta do responsável e dispara a verificação de e-mail.
 *
 * ── Sobre a resposta quando o e-mail já existe ──
 * Não dizemos "este e-mail já está cadastrado". Essa mensagem transforma o
 * formulário de cadastro num oráculo: qualquer um descobre se um endereço tem
 * conta aqui — e, num produto sobre crianças, saber que determinada família usa
 * a plataforma já é informação sensível (docs/09 §5).
 *
 * Em vez disso a resposta é idêntica nos dois caminhos, e quem recebe e-mail é
 * sempre o dono do endereço: ou o link de verificação, ou o aviso de que a
 * conta já existe. Ninguém fica no escuro, e nada vaza para quem sonda.
 */
export async function registrarResponsavel(
  deps: IdentityDeps,
  input: RegistrarResponsavelInput,
  ctx: RequestContext,
): Promise<Result<RegistrarResponsavelOutput>> {
  const limite = await deps.rateLimiter.consume(
    `registro:${ctx.ipHash ?? "sem-ip"}`,
    LIMITES.criacaoDeConta.limite,
    LIMITES.criacaoDeConta.janelaMs,
  );
  if (!limite.ok) {
    return err(
      rateLimited(
        "auth.register_rate_limited",
        "Muitas contas criadas deste local. Tente novamente daqui a pouco.",
      ),
    );
  }

  const email = Email.create(input.email);
  if (!email.ok) return email;

  const nome = GuardianName.create(input.nome);
  if (!nome.ok) return nome;

  const senha = PlainPassword.create(input.senha, email.value.value);
  if (!senha.ok) return senha;

  const agora = deps.clock.now();
  const saida = ok({ emailMascarado: email.value.masked });

  const existente = await deps.accounts.findByEmail(email.value);
  if (existente) {
    await deps.mailer.enviarAvisoDeContaExistente({
      para: email.value,
      nome: existente.name,
      urlEntrar: `${deps.appUrl}/entrar`,
    });
    // Mesma forma de resposta do caminho feliz — inclusive em caso de sucesso.
    return saida;
  }

  const passwordHash = await deps.hasher.hash(senha.value.reveal());
  const conta = await deps.accounts.create({
    email: email.value,
    nome: nome.value.value,
    passwordHash,
    locale: input.locale ?? "pt-BR",
  });

  const envio = await emitirVerificacao(deps, {
    accountId: conta.id,
    email: email.value,
    nome: nome.value.firstName,
    agora,
  });
  if (!envio.ok) return envio;

  await deps.audit.record({
    actorAccountId: conta.id,
    action: "identity.account_registered",
    entity: "Account",
    entityId: conta.id,
    metadata: { traceId: ctx.traceId },
  });

  return saida;
}

/**
 * Emite um token de uso único e envia o link. Exportado porque o reenvio de
 * verificação precisa exatamente do mesmo comportamento — e duas
 * implementações do mesmo token divergem em prazo mais cedo ou mais tarde.
 */
export async function emitirVerificacao(
  deps: IdentityDeps,
  dados: {
    readonly accountId: string;
    readonly email: Email;
    readonly nome: string;
    readonly agora: Date;
  },
): Promise<Result<void>> {
  const token = generateToken();
  const expiresAt = new Date(dados.agora.getTime() + DURACAO.tokenDeVerificacao);

  // O identificador é a conta, não o e-mail: trocar de e-mail no futuro não
  // deixa token órfão apontando para um endereço que já não é da conta.
  await deps.verificationTokens.issue({
    identifier: dados.accountId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const enviado = await deps.mailer.enviarVerificacao({
    para: dados.email,
    nome: dados.nome,
    url: `${deps.appUrl}/verificar-email?token=${encodeURIComponent(token)}`,
    expiraEm: expiresAt,
  });

  return enviado.ok ? ok(undefined) : enviado;
}
