import {
  criarListarRecomendacoesPendentes,
  criarResponderRecomendacao,
  type ListarRecomendacoesPendentes,
  type ResponderRecomendacao,
} from "@/modules/learning-profile";
import { criarRepositorioPrismaDePerfilDeAprendizagem } from "@/modules/learning-profile/infrastructure/prisma-learning-profile-repository";
import { db } from "@/server/db";
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";

/**
 * Composition root do lado RESPONSÁVEL do Learning Profile — a tela
 * "Personalização da Aprendizagem" (Fase 3b).
 *
 * O lado JOGADA (escolher qual apresentação servir durante a missão) mora em
 * `src/activities/content-bridge.ts`, por uma exceção documentada de
 * `.dependency-cruiser.cjs` (regra `motor-e-puro`) — é o único ponto por
 * onde toda atividade passa antes da tela, e não podia depender deste
 * arquivo sem criar um ciclo. Este arquivo é para tudo o mais que o módulo
 * precisa fora daquele caminho quente: hoje, só o responsável lendo e
 * respondendo sugestões de acessibilidade.
 */
const repositorio = criarRepositorioPrismaDePerfilDeAprendizagem(db);
const unidadeDeTrabalho = criarUnidadeDeTrabalho(db);

interface LearningProfileGuardianDeps {
  readonly listarRecomendacoesPendentes: ListarRecomendacoesPendentes;
  readonly responderRecomendacao: ResponderRecomendacao;
}

let cache: LearningProfileGuardianDeps | undefined;

export function learningProfileGuardianDeps(): LearningProfileGuardianDeps {
  cache ??= {
    listarRecomendacoesPendentes: criarListarRecomendacoesPendentes({ repositorio }),
    responderRecomendacao: criarResponderRecomendacao({ repositorio, unidadeDeTrabalho }),
  };
  return cache;
}
