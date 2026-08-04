/**
 * MÓDULO ASSESSMENT — API pública.
 *
 * Transforma a resposta de uma criança em três coisas: histórico (`Attempt`),
 * modelo do que ela sabe (`SkillMastery`, via BKT + Elo) e agenda de revisão
 * (`ReviewCard`, via SM-2). Publica o que aconteceu; não credita nada.
 *
 * Fronteira do módulo: quem está de fora importa daqui e de mais nenhum lugar
 * (verificado por dependency-cruiser).
 */

export {
  criarSubmeterTentativa,
  type SubmeterTentativa,
  type SubmeterTentativaEntrada,
  type SubmeterTentativaSaida,
} from "./application/submit-attempt";

export {
  DominioMudouNoMeio,
  TentativaJaRegistrada,
  type AssessmentDeps,
  type PedidoDeContexto,
  type RepositorioDeAvaliacao,
} from "./application/ports";

export {
  planejarTentativa,
  type ContextoDaTentativa,
  type DadosDaTentativa,
  type EscritaDeDominio,
  type EscritaDeRevisao,
  type PlanoDaTentativa,
  type SubmissaoAvaliada,
} from "./domain/attempt-plan";

export {
  TOPICO_TELEMETRIA_DE_TENTATIVA,
  TOPICO_TENTATIVA_AVALIADA,
  type TentativaAvaliada,
} from "./domain/events";

export {
  BKT,
  atualizarProbabilidade,
  esquecer,
  posteriorDeAcerto,
  posteriorDeErro,
} from "./domain/bkt";

export { ELO, atualizarHabilidade, fatorK, probabilidadeEsperada } from "./domain/elo";

export {
  atingiuDominio,
  dominioInicial,
  evoluirDominio,
  type EstadoDeDominio,
  type EvidenciaDeTentativa,
} from "./domain/mastery";

export {
  SM2,
  diasEntre,
  proximaRevisao,
  qualidadeDaResposta,
  type EstadoDeRevisao,
} from "./domain/spaced-repetition";
