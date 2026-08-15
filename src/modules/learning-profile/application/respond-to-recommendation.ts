import { err, notFound, ok, type Result, type UnidadeDeTrabalho } from "@/shared/kernel";

import type { RepositorioDePerfilDeAprendizagem } from "./ports";

export interface ResponderRecomendacaoDeps {
  readonly repositorio: RepositorioDePerfilDeAprendizagem;
  readonly unidadeDeTrabalho: UnidadeDeTrabalho;
}

export interface ResponderRecomendacaoEntrada {
  readonly learnerId: string;
  readonly recommendationId: string;
  readonly aceitar: boolean;
}

/** O que aplicar em `LearnerSettings` — só presente quando o responsável aceitou. */
export interface ConfiguracaoASugerir {
  readonly settingField: string;
  readonly suggestedValue: boolean;
}

export interface ResponderRecomendacaoSaida {
  readonly aceita: boolean;
  readonly configuracao: ConfiguracaoASugerir | null;
}

export type ResponderRecomendacao = (
  entrada: ResponderRecomendacaoEntrada,
) => Promise<Result<ResponderRecomendacaoSaida>>;

/**
 * O responsável aceita ou recusa uma sugestão de acessibilidade.
 *
 * Este módulo nunca escreve `LearnerSettings` — não é dele o aggregate. Só
 * marca a recomendação como respondida e devolve *o que* aplicar; quem
 * decide se aplica (e escreve o `AuditLog` da mudança) é a camada de
 * apresentação, orquestrando este resultado com o módulo `identity`, dono de
 * `LearnerSettings`. Manter os dois módulos sem se conhecerem é o mesmo
 * raciocínio de `assessment` nunca creditar XP sozinho (docs/01 §2).
 */
export function criarResponderRecomendacao(
  deps: ResponderRecomendacaoDeps,
): ResponderRecomendacao {
  return async (entrada) => {
    const consumida = await deps.unidadeDeTrabalho.executar((tx) =>
      deps.repositorio.consumirRecomendacao(entrada.recommendationId, entrada.learnerId, tx),
    );

    if (!consumida) {
      return err(
        notFound(
          "learning_profile.recommendation_not_found",
          "Esta sugestão não existe mais, ou já foi respondida.",
        ),
      );
    }

    return ok({
      aceita: entrada.aceitar,
      configuracao: entrada.aceitar
        ? { settingField: consumida.settingField, suggestedValue: true }
        : null,
    });
  };
}
