/**
 * MÓDULO PROGRESSION — API pública.
 *
 * A Luz que sobe, o nível que muda, o Fôlego que volta, a Trilha que continua.
 * **Reage** ao evento da tentativa; nunca é chamado por quem avalia.
 *
 * Fronteira do módulo: quem está de fora importa daqui e de mais nenhum lugar.
 */

export { criarCreditoDeTentativa } from "./application/credit-attempt";

export {
  ProgressoMudouNoMeio,
  type ConsultaDeProgresso,
  type ProgressionDeps,
  type RepositorioDeProgresso,
} from "./application/ports";

export {
  aplicarGanho,
  comoEstaAgora,
  progressoInicial,
  type EstadoDeProgresso,
  type GanhoDaTentativa,
  type ProgressoAtualizado,
} from "./domain/progress";

export {
  TIERS,
  apelidoDoTier,
  luzAcumuladaParaNivel,
  nivelParaLuz,
  progressoNoNivel,
  tierDoNivel,
  type Tier,
} from "./domain/level";

export { FOLEGO, devolver, regenerar } from "./domain/energy";

export {
  TRILHA,
  diaCivil,
  registrarDia,
  type EstadoDaTrilha,
} from "./domain/streak";
