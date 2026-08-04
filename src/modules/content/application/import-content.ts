import { type AppError, type Result, err, ok, validationError } from "@/shared/kernel";

import { type ProblemaDePlano, planejarImportacao } from "../domain/plan";
import type { EscritorDeConteudo, ResumoDaEscrita } from "./ports";

/**
 * Importa o acervo de `content/` para o Postgres.
 *
 * ── Por que a importação é tudo-ou-nada ──
 * Um acervo meio importado é pior que nenhum: a criança abre uma missão cuja
 * fase seguinte não existe, e trava numa tela sem saída. Se qualquer referência
 * não fecha, nada é gravado e o problema aparece no terminal de quem publicou —
 * não na frente dela.
 */

export interface AcervoParaImportar {
  readonly academias: readonly unknown[];
}

export interface ImportarConteudoDeps {
  readonly escritor: EscritorDeConteudo;
}

export interface ImportarConteudoEntrada {
  /** Acervo já carregado e validado por `content/loader`. */
  readonly acervo: Parameters<typeof planejarImportacao>[0];
  /**
   * Publica mesmo com problemas de referência. Existe para diagnóstico local,
   * nunca para o CI nem para produção.
   */
  readonly forcar?: boolean;
}

export interface ImportarConteudoSaida {
  readonly resumo: ResumoDaEscrita;
  readonly problemas: readonly ProblemaDePlano[];
}

export function criarImportarConteudo({ escritor }: ImportarConteudoDeps) {
  return async function importarConteudo(
    entrada: ImportarConteudoEntrada,
  ): Promise<Result<ImportarConteudoSaida, AppError>> {
    const { plano, problemas } = planejarImportacao(entrada.acervo);

    if (problemas.length > 0 && entrada.forcar !== true) {
      return err(
        validationError(
          "content.plano_incompleto",
          `O acervo tem ${problemas.length} referência(s) que não fecham. Nada foi gravado.`,
          {
            problemas: problemas.map((p) => `${p.onde}: ${p.mensagem}`),
          },
        ),
      );
    }

    const resumo = await escritor.gravar(plano);

    return ok({ resumo, problemas });
  };
}

export type ImportarConteudo = ReturnType<typeof criarImportarConteudo>;
