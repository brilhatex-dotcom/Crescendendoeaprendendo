import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { isProduction } from "@/config/env";
import { identityDeps } from "@/composition/identity";
import { resolverSessao, type Ator } from "@/modules/identity";
import type { AppError, Result } from "@/shared/kernel";
import type { EstadoDaAction } from "@/shared/forms/action-state";

import {
  ipHashDaRequisicao,
  lerSubSessaoDeCrianca,
  lerTokenDeSessao,
  userAgentDaRequisicao,
} from "./session";

/**
 * `createAction` — o único jeito de escrever uma Server Action neste projeto.
 *
 * Aplica, sempre nesta ordem (docs/09 §4):
 *
 *   1. resolução de sessão e escopo
 *   2. política de autorização
 *   3. validação Zod da entrada (fail-closed)
 *   4. rate limit
 *   5. idempotência, quando a ação tem efeito econômico
 *   6. execução do caso de uso
 *   7. revalidação das rotas que a ação invalidou
 *   8. tratamento de erro — nunca vaza *stack* ao cliente
 *
 * A ordem não é arbitrária. Validar antes de autorizar conta ao anônimo quais
 * campos existem; limitar taxa antes de autenticar deixa um usuário legítimo
 * ser bloqueado por vizinho de IP.
 *
 * **Sobre idempotência (passo 5):** o wrapper exige e valida a chave; **quem
 * guarda é o caso de uso**, na coluna própria da entidade que ele escreve
 * (`Attempt.idempotencyKey`, `LedgerEntry.idempotencyKey`). Uma tabela genérica
 * de chaves seria mais fácil de escrever e teria um defeito grave: a chave
 * viveria separada da linha que ela protege, e as duas poderiam divergir — a
 * chave gravada e a tentativa perdida, ou o contrário. Com a restrição `@unique`
 * na própria tabela, a proteção e o dado são a mesma escrita.
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
  | "adulto-verificado"
  /**
   * Sub-sessão de criança em vigor (`play:*`). Jogar missão, responder
   * atividade, falar com o tutor.
   *
   * Não é um escopo "mais fraco" que o adulto: é **outro** escopo. Um token de
   * criança não abre rota adulta, e uma ação de criança exige que a sub-sessão
   * esteja aberta — não basta o responsável estar logado (docs/09 §2).
   */
  | "crianca";

interface Config<TSchema extends z.ZodTypeAny, TSaida> {
  /** Nome estável, usado em log e auditoria: `identity.sign_in`. */
  readonly nome: string;
  readonly escopo: Escopo;
  readonly entrada: TSchema;
  /**
   * A ação tem efeito econômico (credita, debita ou registra tentativa).
   *
   * Torna `chaveDeIdempotencia` obrigatória no formulário e a entrega em
   * `ctx.idempotencyKey`. Fail-closed: sem chave válida, a ação nem chega ao
   * caso de uso. O contrário — aceitar e deixar passar — é o comportamento que
   * faz um toque duplo virar dois créditos, e o defeito só aparece na conta de
   * quem jogou.
   */
  readonly idempotente?: boolean;
  /**
   * Rotas cujo conteúdo servido deixa de valer quando esta ação dá certo.
   *
   * Server Action que muda dado renderizado no servidor **precisa** dizer o que
   * invalidou. Sem isto, o formulário responde "Perfil de Menina criado." e a
   * lista logo acima continua dizendo "você ainda não criou nenhum perfil" —
   * as duas frases na mesma tela, e o responsável sem saber em qual acreditar.
   *
   * Fica aqui, e não espalhado nos casos de uso, porque é decisão de
   * apresentação: o caso de uso não sabe que existe uma página `/familia`.
   */
  readonly revalidar?: readonly string[];
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
  /** Presente somente em ação declarada `idempotente`. */
  readonly idempotencyKey: string | null;
}

/**
 * Campo em que o cliente envia a chave.
 *
 * Nome único em todo o sistema de propósito: um cliente novo que esqueça de
 * enviá-la falha na hora, em desenvolvimento, e não em produção depois de já
 * ter creditado duas vezes.
 */
export const CAMPO_DE_IDEMPOTENCIA = "chaveDeIdempotencia";

/**
 * Forma aceita da chave: `crypto.randomUUID()` e afins.
 *
 * O formato é verificado — e não apenas o comprimento — porque a chave vira
 * valor de índice único. Aceitar texto arbitrário deixaria um cliente
 * defeituoso reservar a chave `""` para sempre e bloquear todo mundo.
 */
const CHAVE_DE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{16,64}$/;

type Action<TSaida> = (
  estadoAnterior: EstadoDaAction<TSaida>,
  formData: FormData,
) => Promise<EstadoDaAction<TSaida>>;

export function createAction<TSchema extends z.ZodTypeAny, TSaida>(
  config: Config<TSchema, TSaida>,
): Action<TSaida> {
  return async function acaoEnvolvida(_estadoAnterior, formData) {
    let ctx: ContextoDaAction = {
      traceId: randomUUID(),
      ipHash: await ipHashDaRequisicao(),
      userAgent: await userAgentDaRequisicao(),
      idempotencyKey: null,
    };

    try {
      // 1 · sessão
      const ator = await resolverSessao(identityDeps(), await lerTokenDeSessao());

      // 2 · política
      const autorizacao = await autorizar(config.escopo, ator);
      if (autorizacao) return autorizacao;

      // 3 · validação (fail-closed: campo não declarado é descartado)
      const analise = config.entrada.safeParse(paraObjeto(formData));
      if (!analise.success) return comoErroDeCampos(analise.error);

      // 5 · idempotência
      if (config.idempotente) {
        const chave = lerChaveDeIdempotencia(formData);
        if (!chave) {
          console.error(`[action:${config.nome}] chave de idempotência ausente ou inválida`, {
            traceId: ctx.traceId,
          });
          return {
            status: "erro",
            mensagem: "Não conseguimos registrar isso agora. Tente de novo.",
          };
        }
        ctx = { ...ctx, idempotencyKey: chave };
      }

      // 4 · rate limit + 6 · caso de uso
      //     Cada caso de uso declara o próprio limite, porque a janela certa
      //     depende do que a ação faz — login e reenvio de e-mail não podem
      //     compartilhar um número só.
      const resultado = await config.executar({
        entrada: analise.data,
        ator,
        ctx,
      });

      if (resultado.ok) {
        // Só no sucesso: revalidar depois de uma falha jogaria fora cache bom.
        for (const rota of config.revalidar ?? []) revalidatePath(rota);
        return { status: "sucesso", dados: resultado.value };
      }
      return comoErro(resultado.error);
    } catch (causa) {
      // 8 · nada de stack para o cliente. O traceId liga a tela ao log.
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

async function autorizar(
  escopo: Escopo,
  ator: Ator | null,
): Promise<{ status: "erro"; mensagem: string } | null> {
  if (escopo === "publica") return null;

  if (!ator) {
    return { status: "erro", mensagem: "Sua sessão expirou. Entre novamente." };
  }

  if (escopo === "crianca") {
    /*
     * Duas checagens, e as duas precisam passar:
     *  · o banco diz qual criança está ativa (`activeLearnerId`) — é o que
     *    torna "sair" e "trocar de criança" efetivos na hora;
     *  · o cookie assinado prova que a sub-sessão é desta sessão adulta e que
     *    ainda está dentro das 4 horas.
     *
     * Só o cookie deixaria uma sub-sessão revogada continuar valendo até
     * expirar. Só o banco não teria prazo próprio nem amarração de sessão.
     */
    const learnerIdDoCookie = await lerSubSessaoDeCrianca(ator.sessionId, new Date());

    if (!ator.activeLearnerId || learnerIdDoCookie !== ator.activeLearnerId) {
      return {
        status: "erro",
        mensagem: "Sua aventura foi pausada. Peça a um adulto para entrar de novo.",
      };
    }
    return null;
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
 * Lê e valida a chave de idempotência. `null` quando ausente ou malformada.
 *
 * Fora do `entrada` de propósito: a chave não é dado de negócio, é metadado de
 * transporte. Se ela entrasse no schema Zod, cada ação com efeito econômico
 * teria que declará-la de novo — e a primeira que esquecesse ficaria sem
 * proteção sem ninguém notar, porque nada quebraria.
 */
function lerChaveDeIdempotencia(formData: FormData): string | null {
  const bruta = formData.get(CAMPO_DE_IDEMPOTENCIA);
  if (typeof bruta !== "string") return null;

  const chave = bruta.trim();
  return CHAVE_DE_IDEMPOTENCIA.test(chave) ? chave : null;
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
