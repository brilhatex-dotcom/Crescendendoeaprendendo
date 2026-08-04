/**
 * MOTOR DE ATIVIDADES — API pública.
 *
 * Quem consome o motor importa daqui e de mais nenhum lugar. Alcançar
 * `@/activities/plugins/multiple-choice/evaluate` de fora é acoplar-se a um
 * tipo específico — exatamente o que a arquitetura existe para impedir.
 *
 * Documentação: `docs/13-motor-de-atividades.md`
 */

export type {
  ActivityPlugin,
  ActivityType,
  AttemptOutcome,
  EvaluationContext,
  EvaluationDetails,
  EvaluationResult,
  FeedbackComEnsino,
  FeedbackDeAcerto,
  FeedbackTone,
  PedagogicalFeedback,
  SealedPlugin,
} from "./contracts";
export { ACTIVITY_TYPES } from "./contracts";

export {
  avaliarAtividade,
  criarRegistro,
  selar,
  type ActivityRegistry,
} from "./registry";

export { PLUGINS_REGISTRADOS } from "./plugins";

export {
  DIFFICULTY_LABELS,
  DIFICULDADE_INICIAL,
  alvoDeDificuldade,
  fatorDeDificuldade,
  seletorPorProximidade,
  type CandidataAtividade,
  type DifficultyLabel,
  type PedidoDeSelecao,
  type SeletorDeAtividades,
} from "./difficulty";

export {
  PREMIO_VAZIO,
  calcularPremio,
  currencyKindSchema,
  premioSchema,
  regraDeRecompensaSchema,
  somarPremios,
  type ContextoDeRecompensa,
  type CurrencyKind,
  type Premio,
  type RegraDeRecompensa,
} from "./rewards";

export {
  APRESENTACAO_PADRAO,
  apresentacaoDeFeedbackSchema,
  type ApresentacaoDeFeedback,
} from "./presentation";

export type {
  RegistradorDeTentativas,
  RegistroDeTentativa,
  ResumoDaAtividade,
} from "./telemetry";

export {
  atividadeEm,
  indiceAbsoluto,
  premioDaAtividade,
  primeiraPosicao,
  proximaPosicao,
  resolverApresentacao,
  submissaoSchema,
  totalDeAtividades,
  type AtividadeNaSessao,
  type ContextoDaJogada,
  type FaseNaSessao,
  type MissaoNaSessao,
  type PosicaoNaMissao,
  type Submissao,
} from "./session";

/** Registro padrão da aplicação, com todos os plugins do manifesto. */
export { registroPadrao } from "./default-registry";
