"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { identityDeps } from "@/composition/identity";
import { createAction, type EstadoDaAction } from "@/server/action";
import {
  abrirSubSessaoDeCrianca,
  fecharSubSessaoDeCrianca,
  gravarCookieDeSessao,
  lerTokenDeSessao,
  limparCookieDeSessao,
} from "@/server/session";
import { err, forbidden } from "@/shared/kernel";

import {
  criarPerfilDeCrianca,
  definirPinDoResponsavel,
  encerrarSessaoDeCrianca,
  entrar,
  iniciarSessaoDeCrianca,
  pedirRedefinicaoDeSenha,
  redefinirSenha,
  registrarResponsavel,
  reenviarVerificacao,
  sair,
} from "..";

/**
 * Server Actions do módulo de identidade.
 *
 * Todas passam por `createAction` — nenhuma é escrita solta (docs/09 §4). O que
 * sobra aqui é só o que a apresentação legitimamente decide: o schema de
 * entrada do formulário, e o que fazer com cookie e navegação depois que o caso
 * de uso respondeu.
 *
 * Os schemas Zod deliberadamente **não** repetem as regras de negócio. Eles
 * garantem só a forma ("é string, tem tamanho plausível"); quem decide se a
 * senha é aceitável é o Value Object no domínio. Duplicar a regra nos dois
 * lugares é como as duas versões passam a divergir.
 */

// ── Cadastro ─────────────────────────────────────────────────────────────────

export const criarContaAction = createAction({
  nome: "identity.register_guardian",
  escopo: "publica",
  entrada: z.object({
    nome: z.string().min(1, "Informe seu nome.").max(200),
    email: z.string().min(1, "Informe seu e-mail.").max(320),
    senha: z.string().min(1, "Escolha uma senha.").max(200),
  }),
  executar: async ({ entrada, ctx }) =>
    registrarResponsavel(identityDeps(), entrada, ctx),
});

export const reenviarVerificacaoAction = createAction({
  nome: "identity.resend_verification",
  escopo: "publica",
  entrada: z.object({
    email: z.string().min(1, "Informe seu e-mail.").max(320),
  }),
  executar: async ({ entrada, ctx }) =>
    reenviarVerificacao(identityDeps(), entrada.email, ctx),
});

// ── Entrada e saída ──────────────────────────────────────────────────────────

/**
 * O cookie é gravado aqui, não no caso de uso: `entrar` devolve o token e não
 * sabe o que é um cookie — é o que permite testá-lo sem `next/headers`.
 */
export const entrarAction = createAction({
  nome: "identity.sign_in",
  escopo: "publica",
  entrada: z.object({
    email: z.string().min(1, "Informe seu e-mail.").max(320),
    senha: z.string().min(1, "Informe sua senha.").max(200),
  }),
  executar: async ({ entrada, ctx }) => {
    const resultado = await entrar(identityDeps(), entrada, ctx);
    if (resultado.ok) {
      await gravarCookieDeSessao(
        resultado.value.sessionToken,
        resultado.value.expiresAt,
      );
    }
    return resultado;
  },
});

// ── Esqueci minha senha ──────────────────────────────────────────────────────

export const pedirRedefinicaoDeSenhaAction = createAction({
  nome: "identity.request_password_reset",
  escopo: "publica",
  entrada: z.object({
    email: z.string().min(1, "Informe seu e-mail.").max(320),
  }),
  executar: async ({ entrada, ctx }) =>
    pedirRedefinicaoDeSenha(identityDeps(), entrada.email, ctx),
});

export const redefinirSenhaAction = createAction({
  nome: "identity.reset_password",
  escopo: "publica",
  entrada: z.object({
    token: z.string().min(1, "Link inválido.").max(200),
    senha: z.string().min(1, "Escolha uma senha.").max(200),
    confirmacao: z.string().min(1, "Confirme a senha nova.").max(200),
  }),
  executar: async ({ entrada, ctx }) => {
    if (entrada.senha !== entrada.confirmacao) {
      return err(
        forbidden("password.mismatch", "As duas senhas digitadas não são iguais."),
      );
    }
    return redefinirSenha(identityDeps(), entrada.token, entrada.senha, ctx);
  },
});

/**
 * Sair não devolve estado para formulário nenhum: termina em redirect.
 *
 * `redirect` funciona lançando uma exceção de controle do Next, então ela
 * precisa acontecer **fora** do `createAction` — dentro, o `catch` do wrapper
 * a trataria como falha inesperada.
 */
export async function sairAction(): Promise<never> {
  const deps = identityDeps();
  await sair(deps, await lerTokenDeSessao(), {
    traceId: "sign-out",
    ipHash: null,
    userAgent: null,
  });
  await limparCookieDeSessao();
  redirect("/entrar");
}

// ── Família ──────────────────────────────────────────────────────────────────

export const criarPerfilAction = createAction({
  nome: "identity.create_learner",
  escopo: "adulto-verificado",
  entrada: z.object({
    displayName: z.string().min(1, "Como a criança quer ser chamada?").max(80),
    birthYear: z.coerce
      .number()
      .int("Informe o ano com 4 dígitos.")
      .min(1900, "Informe o ano com 4 dígitos.")
      .max(2200, "Informe o ano com 4 dígitos."),
    relation: z.string().min(1, "Quem você é para a criança?").max(80),
  }),
  executar: async ({ entrada, ator, ctx }) => {
    if (!ator) return err(SEM_SESSAO);
    return criarPerfilDeCrianca(identityDeps(), ator, entrada, ctx);
  },
});

export const definirPinAction = createAction({
  nome: "identity.set_parent_pin",
  escopo: "adulto-verificado",
  entrada: z.object({
    pin: z.string().min(1, "Escolha um PIN.").max(20),
    confirmacao: z.string().max(20).optional(),
  }),
  executar: async ({ entrada, ator, ctx }) => {
    if (!ator) return err(SEM_SESSAO);
    if (entrada.confirmacao !== undefined && entrada.confirmacao !== entrada.pin) {
      return err(
        forbidden("pin.mismatch", "Os dois PINs digitados não são iguais."),
      );
    }
    return definirPinDoResponsavel(identityDeps(), ator, entrada.pin, ctx);
  },
});

// ── Sub-sessão de criança ────────────────────────────────────────────────────

export const abrirAreaInfantilAction = createAction({
  nome: "identity.start_learner_session",
  escopo: "adulto-verificado",
  entrada: z.object({ learnerId: z.string().min(1).max(64) }),
  executar: async ({ entrada, ator, ctx }) => {
    if (!ator) return err(SEM_SESSAO);

    const resultado = await iniciarSessaoDeCrianca(
      identityDeps(),
      ator,
      entrada.learnerId,
      ctx,
    );
    if (resultado.ok) {
      await abrirSubSessaoDeCrianca(
        ator.sessionId,
        resultado.value.learner.id,
        resultado.value.expiraEm,
      );
    }
    return resultado;
  },
});

export const sairDaAreaInfantilAction = createAction({
  nome: "identity.end_learner_session",
  escopo: "adulto",
  entrada: z.object({ pin: z.string().min(1, "Digite o PIN.").max(20) }),
  executar: async ({ entrada, ator, ctx }) => {
    if (!ator) return err(SEM_SESSAO);

    const resultado = await encerrarSessaoDeCrianca(
      identityDeps(),
      ator,
      entrada.pin,
      ctx,
    );
    if (resultado.ok) await fecharSubSessaoDeCrianca();
    return resultado;
  },
});

/**
 * `createAction` já barra sessão ausente antes de chegar aqui; este erro existe
 * para satisfazer o tipo sem `any` nem `!`. Se ele aparecer em log, alguma
 * ação foi declarada com escopo errado.
 */
const SEM_SESSAO = forbidden("auth.session_required", "Sua sessão expirou. Entre novamente.");

export type { EstadoDaAction };
