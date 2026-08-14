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
 * A seleção de variante por perfil (Fase 3) consome `buscarPerfilDeAprendizagem`
 * a partir de `quest/application`.
 */

export {
  criarAtualizarPerfilAPartirDeTentativa,
} from "./application/update-from-attempt";
export {
  criarBuscarPerfilDeAprendizagem,
  type BuscarPerfilDeAprendizagem,
  type DimensaoDoPerfil,
} from "./application/read-profile";
export type {
  CaracteristicasDaAtividade,
  DimensaoPersistida,
  LearningProfileDeps,
  RepositorioDePerfilDeAprendizagem,
} from "./application/ports";

export {
  REGRAS_DE_DIMENSAO,
  dimensoesRelevantes,
} from "./domain/dimension-rules";
export {
  calcularConfianca,
  calcularValor,
  contaComoEvidencia,
  mudouOSuficiente,
  recomputarDimensao,
  type DimensaoAnterior,
  type DimensaoRecomputada,
} from "./domain/dimension";
