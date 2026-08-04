/**
 * MÓDULO ECONOMY — API pública.
 *
 * Carteira com razão contábil. **Nenhuma moeda se compra com dinheiro real**
 * (Bíblia Cap. 6 §6.5) — não existe neste módulo caminho que receba valor
 * externo, e há teste de política guardando isso.
 *
 * Fronteira do módulo: quem está de fora importa daqui e de mais nenhum lugar.
 */

export { criarCreditoDeRecompensa } from "./application/credit-reward";

export {
  CarteiraMudouNoMeio,
  type ConsultaDeCarteira,
  type EconomyDeps,
  type RepositorioDeCarteira,
} from "./application/ports";

export {
  MOEDAS,
  carteiraInicial,
  creditosDePremio,
  lancar,
  type EstadoDaCarteira,
  type Lancamento,
  type Moeda,
  type Movimento,
  type ResultadoDoLancamento,
  type SaldoInsuficiente,
} from "./domain/ledger";
