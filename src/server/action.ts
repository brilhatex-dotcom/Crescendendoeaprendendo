import { randomUUID } from "node:crypto";
import type { z } from "zod";

import { isProduction } from "@/config/env";
import { identityDeps } from "@/composition/identity";
import { resolverSessao, type Ator } from "@/modules/identity";
import type { AppError, Result } from "@/shared/kernel";
import type { EstadoDaAction } from "@/shared/forms/action-state";

import { ipHashDaRequisicao, lerTokenDeSessao, userAgentDaRequisicao } from "./session";

/**
 * `createAction` — o único jeito de escrever uma Server Action neste projeto.
 *
 * Aplica, sempre nesta ordem (docs/09 §4):
 *
 *   1. resolução de sessão e escopo
 *   2. política de autorização
 *   3. validação Zod da entrada (fail-closed)
 *   4. rate limit
 *   5. execução do caso de uso
 *   6. tratamento de erro — nunca vaza *stack* ao cliente
 *
 * A ordem não é arbitrária. Validar antes de autorizar conta ao anônimo quais
 * campos existem; limitar taxa antes de autenticar deixa um usuário legítimo
 * ser bloqueado por vizinho de IP.
 *
 * **Sobre idempotência (passo 5 do documento):** ela entra aqui quando existir
 * a primeira ação com efeito econômico. Hoje nenhuma existe — o módulo de
 * economia é da Etapa 1 — e a chave de idempotência mora em `LedgerEntry`, não
 * numa tabela genérica. Escrever agora um passo que nada usa seria adivinhar o
 * formato errado; está registrado em `docs/HANDOFF.md` como pré-requisito da
 * primeira ação de carteira.
 */

/**
 * O estado do formulário mora em `@/shared/forms/action-state`, que não importa
 * nada — é o que permite ao Client Component lê-lo sem arrastar `next/headers`
 * para o pacote do navegador.
 */
export type { EstadoDaAction };

/** Quem pode executar a ação. */
export type Escopo =
  /** Qualquer visitante — login, cadastro, verificação. */
  | "publica"
  /** Sessão adulta válida. */
  | "adulto"
  /** Sessão adulta **com e-mail verificado** — tudo que toca dado de criança. */
  | "adulto-verificado";

interface Config<TSchema extends z.ZodTypeAny, TSaida> {
  /** Nome estável, usado em log e auditoria: `identity.sign_in`. */
  readonly nome: string;
  readonly escopo: Escopo;
  readonly entrada: TSchema;
  readonly executar: (args: {
    readonly entrada: z.infer<TSchema>;
    readonly ator: Ator | null;
    readonly ctx: ContextoDaAction;
  }) => Promise<Result<TSaida>>;
}

export interface ContextoDaAction {
  readonly traceId: string;
  readonly ipHash: string | null;
  readonly userAgent: string | null;
}

type Action<TSaida> = (
  estadoAnterior: EstadoDaAction<TSaida>,
  formData: FormData,
) => Promise<EstadoDaAction<TSaida>>;

export function createAction<TSchema extends z.ZodTypeAny, TSaida>(
  config: Config<TSchema, TSaida>,
): Action<TSaida> {
  return async function acaoEnvolvida(_estadoAnterior, formData) {
    const ctx: ContextoDaAction = {
      traceId: randomUUID(),
      ipHash: await ipHashDaRequisicao(),
      userAgent: await userAgentDaRequisicao(),
    };

    try {
      // 1 · sessão
      const ator = await resolverSessao(identityDeps(), await lerTokenDeSessao());

      // 2 · política
      const autorizacao = autorizar(config.escopo, ator);
      if (autorizacao) return autorizacao;

      // 3 · validação (fail-closed: campo não declarado é descartado)
      const analise = config.entrada.safeParse(paraObjeto(formData));
      if (!analise.success) return comoErroDeCampos(analise.error);

      // 4 · rate limit + 5 · caso de uso
      //     Cada caso de uso declara o próprio limite, porque a janela certa
      //     depende do que a ação faz — login e reenvio de e-mail não podem
      //     compartilhar um número só.
      const resultado = await config.executar({
        entrada: analise.data,
        ator,
        ctx,
      });

      if (resultado.ok) return { status: "sucesso", dados: resultado.value };
      return comoErro(resultado.error);
    } catch (causa) {
      // 6 · nada de stack para o cliente. O traceId liga a tela ao log.
      console.error(`[action:${config.nome}] falha inesperada`, {
        traceId: ctx.traceId,
        causa,
      });
      return {
        status: "erro",
        mensagem: isProduction
          ? `Algo deu errado do nosso lado. Se persistir, informe o código ${ctx.traceId.slice(0, 8)}.`
          : `Falha inesperada: ${causa instanceof Error ? causa.message : String(causa)}`,
      };
    }
  };
}

// ── Peças internas ───────────────────────────────────────────────────────────

function autorizar(
  escopo: Escopo,
  ator: Ator | null,
): { status: "erro"; mensagem: string } | null {
  if (escopo === "publica") return null;

  if (!ator) {
    return { status: "erro", mensagem: "Sua sessão expirou. Entre novamente." };
  }

  if (escopo === "adulto-verificado" && !ator.account.isEmailVerified) {
    return {
      status: "erro",
      mensagem: "Confirme seu e-mail para continuar.",
    };
  }

  return null;
}

/**
 * `FormData` → objeto simples.
 *
 * Campos de arquivo são descartados de propósito: upload tem caminho próprio
 * com URL assinada e verificação de tipo (docs/09 §5), e não entra por aqui.
 */
function paraObjeto(formData: FormData): Record<string, string> {
  const objeto: Record<string, string> = {};
  for (const [chave, valor] of formData.entries()) {
    if (typeof valor === "string") objeto[chave] = valor;
  }
  return objeto;
}

function comoErroDeCampos(erro: z.ZodError): EstadoDaAction<never> {
  const campos: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = problema.path[0];
    if (typeof campo === "string" && !campos[campo]) {
      campos[campo] = problema.message;
    }
  }
  return {
    status: "erro",
    mensagem: "Confira os campos destacados.",
    campos,
  };
}

/**
 * Erro de domínio vira mensagem de tela.
 *
 * As mensagens do `AppError` já foram escritas para serem lidas por um adulto
 * (o domínio não fala em código), então passam direto. O que não passa é o
 * `kind` INTERNAL: esse vira texto genérico, porque mensagem interna costuma
 * carregar detalhe de implementação.
 */
function comoErro(erro: AppError): EstadoDaAction<never> {
  const campoAlvo = CAMPO_POR_PREFIXO.find(([prefixo]) => erro.code.startsWith(prefixo));

  if (erro.kind === "INTERNAL") {
    return { status: "erro", mensagem: "Algo deu errado do nosso lado. Tente de novo." };
  }

  return campoAlvo
    ? { status: "erro", mensagem: erro.message, campos: { [campoAlvo[1]]: erro.message } }
    : { status: "erro", mensagem: erro.message };
}

/**
 * Liga o código do erro ao campo do formulário, para que a mensagem apareça
 * onde o usuário errou em vez de só no topo da página.
 */
const CAMPO_POR_PREFIXO: readonly (readonly [string, string])[] = [
  ["email.", "email"],
  ["password.", "senha"],
  ["pin.", "pin"],
  ["display_name.", "displayName"],
  ["guardian_name.", "nome"],
  ["learner.birth_year", "birthYear"],
  ["learner.age_", "birthYear"],
  ["learner.relation", "relation"],
];
