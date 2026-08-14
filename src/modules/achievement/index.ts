/**
 * MÓDULO ACHIEVEMENT — API pública.
 *
 * O quadro de conquistas: catálogo autorado (`content/conquistas.json`)
 * cruzado com o progresso recomputado da criança. Reage a eventos de outros
 * módulos, não é chamado por eles — nem `assessment` nem `quest` sabem que
 * conquista existe (docs/01 §2), mesmo espírito de `collection`.
 *
 * Fronteira do módulo: quem está de fora importa daqui e de mais nenhum lugar.
 */

export { criarAvaliacaoPorTentativa, criarAvaliacaoPorMissao } from "./application/grant-achievements";
export { criarBuscarQuadro, type BuscarQuadro } from "./application/view-achievements";
export type {
  AchievementDeps,
  ConquistaDesbloqueada,
  RepositorioDeConquistas,
} from "./application/ports";

export {
  montarQuadro,
  type ConquistaNoQuadro,
  type Familia,
  type Grau,
  type ItemDoCatalogoDeConquista,
} from "./domain/board";

export {
  TIPOS_DE_CRITERIO,
  criterioDeConquistaSchema,
  foiAlcancado,
  progressoDoCriterio,
  type CriterioDeConquista,
  type TipoDeCriterio,
} from "./domain/criteria";
