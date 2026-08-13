/**
 * MÓDULO COLLECTION — API pública.
 *
 * A galeria de figurinhas: catálogo autorado (`content/colecionaveis.json`)
 * cruzado com o que cada criança já ganhou. Reage a eventos de outros
 * módulos, não é chamado por eles — nem `assessment` nem `quest` sabem que
 * figurinha existe (docs/01 §2).
 *
 * Fronteira do módulo: quem está de fora importa daqui e de mais nenhum lugar.
 */

export { criarConcessaoPorTentativa, criarConcessaoPorMissao } from "./application/grant-collectibles";
export { criarBuscarGaleria, type BuscarGaleria } from "./application/view-gallery";
export type { CollectionDeps, RepositorioDeColecionaveis } from "./application/ports";

export {
  montarGaleria,
  codigosUnicos,
  type FigurinhaDaGaleria,
  type ItemDoCatalogo,
} from "./domain/gallery";
