/**
 * MÓDULO LEARNING-PROFILE — API pública.
 *
 * Motor de Aprendizagem Adaptativa: observa com qual apresentação cada
 * criança rende melhor (suporte visual, instrução em etapas, independência
 * de leitura...) e infere, com confiança crescente, um perfil por criança.
 * Nunca diagnostica — as chaves de dimensão são sempre eixos de
 * apresentação, nunca nomes de condição médica ou psicológica.
 *
 * Reage a `assessment.attempt_evaluated` pelo outbox; não é chamado por
 * nenhum outro módulo do fluxo de resposta (mesmo espírito de `achievement`).
 * A seleção de variante por perfil (Fase 3a) consome `buscarPerfilDeAprendizagem`
 * e `escolherApresentacao` a partir de `src/activities/content-bridge.ts` — o
 * único ponto por onde toda atividade (autorada ou de slot) passa antes da
 * tela, e o único arquivo de `src/activities` liberado a importar `src/modules`
 * (`.dependency-cruiser.cjs`, regra `motor-e-puro`).
 *
 * A mesma reação também gera `Recommendation` de acessibilidade quando uma
 * dimensão tem evidência o bastante (Fase 3b) — nunca aplicada sozinha; o
 * responsável aceita ou recusa em `responderRecomendacao`, e este módulo
 * nunca escreve `LearnerSettings` (aggregate de `identity`) diretamente.
 */

export {
  criarAtualizarPerfilAPartirDeTentativa,
} from "./application/update-from-attempt";
export {
  criarBuscarPerfilDeAprendizagem,
  type BuscarPerfilDeAprendizagem,
  type DimensaoDoPerfil,
} from "./application/read-profile";
export {
  escolherApresentacao,
  type ApresentacaoCandidata,
} from "./application/select-presentation";
export {
  criarListarRecomendacoesPendentes,
  type ListarRecomendacoesPendentes,
} from "./application/list-recommendations";
export {
  criarResponderRecomendacao,
  type ConfiguracaoASugerir,
  type ResponderRecomendacao,
  type ResponderRecomendacaoDeps,
  type ResponderRecomendacaoEntrada,
  type ResponderRecomendacaoSaida,
} from "./application/respond-to-recommendation";
export type {
  CaracteristicasDaAtividade,
  DimensaoPersistida,
  LearningProfileDeps,
  RecomendacaoPersistida,
  RepositorioDePerfilDeAprendizagem,
  SugestaoDeAcessibilidade,
} from "./application/ports";

export {
  REGRAS_DE_DIMENSAO,
  dimensoesRelevantes,
} from "./domain/dimension-rules";
export {
  calcularConfianca,
  calcularValor,
  contaComoEvidencia,
  evidenciaSuficiente,
  mudouOSuficiente,
  recomputarDimensao,
  type DimensaoAnterior,
  type DimensaoRecomputada,
} from "./domain/dimension";
export { sugestaoQualificada } from "./domain/accessibility-recommendation";
