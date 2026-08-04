/**
 * RAZÃO CONTÁBIL (docs/08 §5).
 *
 * A carteira **não** é a verdade. A verdade é a sequência de lançamentos, e a
 * carteira é a projeção deles. Parece burocracia até a primeira vez que um
 * saldo aparece errado: com razão, dá para responder *por quê* — com um número
 * solto numa coluna, só dá para escolher entre dois palpites.
 *
 * Cinco invariantes, e as cinco vivem aqui ou em teste de política:
 *
 *  1. Saldo **nunca** negativo.
 *  2. Todo lançamento tem `idempotencyKey`; retry ou sync offline não credita duas vezes.
 *  3. Recompensa de missão é creditada uma vez só por `QuestRun`.
 *  4. `Wallet` é projeção; job noturno reconcilia.
 *  5. Preço é lido do servidor; preço enviado pelo cliente é ignorado.
 *
 * E a que está acima de todas: **nenhuma moeda se compra com dinheiro real**
 * (Bíblia Cap. 6 §6.5). Não há neste módulo nenhum caminho que receba valor
 * externo — e é assim que tem que continuar.
 *
 * Arquivo puro.
 */

/** Espelha `CurrencyKind` do banco. Fagulhas, Prismas e Estrelas-Guia. */
export const MOEDAS = ["COIN", "CRYSTAL", "DIAMOND"] as const;

export type Moeda = (typeof MOEDAS)[number];

export interface EstadoDaCarteira {
  readonly fagulhas: number;
  readonly prismas: number;
  readonly estrelas: number;
  /** Atualização condicional (docs/08 §11). */
  readonly versao: number;
}

export const carteiraInicial = (): EstadoDaCarteira => ({
  fagulhas: 0,
  prismas: 0,
  estrelas: 0,
  versao: 0,
});

export interface Movimento {
  readonly moeda: Moeda;
  /** Positivo credita, negativo debita. Zero não gera lançamento. */
  readonly quantidade: number;
  /** `QUEST_REWARD`, `ACTIVITY_REWARD`, `SHOP_PURCHASE`, `OFFLINE_RECONCILE`… */
  readonly motivo: string;
  readonly refType: string | null;
  readonly refId: string | null;
  readonly idempotencyKey: string;
}

export interface Lancamento extends Movimento {
  /** Saldo daquela moeda **depois** do lançamento. Nunca negativo. */
  readonly saldoDepois: number;
}

export interface SaldoInsuficiente {
  readonly moeda: Moeda;
  readonly disponivel: number;
  readonly pedido: number;
}

export interface ResultadoDoLancamento {
  readonly carteira: EstadoDaCarteira;
  readonly lancamentos: readonly Lancamento[];
  /** Preenchido quando algum débito não caberia. Nada é aplicado nesse caso. */
  readonly recusado: SaldoInsuficiente | null;
}

const saldoDe = (carteira: EstadoDaCarteira, moeda: Moeda): number => {
  switch (moeda) {
    case "COIN":
      return carteira.fagulhas;
    case "CRYSTAL":
      return carteira.prismas;
    case "DIAMOND":
      return carteira.estrelas;
  }
};

const comSaldo = (
  carteira: EstadoDaCarteira,
  moeda: Moeda,
  valor: number,
): EstadoDaCarteira => {
  switch (moeda) {
    case "COIN":
      return { ...carteira, fagulhas: valor };
    case "CRYSTAL":
      return { ...carteira, prismas: valor };
    case "DIAMOND":
      return { ...carteira, estrelas: valor };
  }
};

/**
 * Aplica movimentos em sequência.
 *
 * **Tudo ou nada.** Se qualquer débito não couber, nada é aplicado e o motivo
 * volta em `recusado`. Aplicar parcialmente deixaria a criança com metade de
 * uma compra — e sem jeito de saber qual metade.
 *
 * Movimentos de quantidade zero não geram lançamento: uma linha de razão que
 * não move saldo é ruído que atrapalha exatamente quem for auditar.
 */
export function lancar(
  carteira: EstadoDaCarteira,
  movimentos: readonly Movimento[],
): ResultadoDoLancamento {
  let atual = carteira;
  const lancamentos: Lancamento[] = [];

  for (const movimento of movimentos) {
    if (movimento.quantidade === 0) continue;

    const disponivel = saldoDe(atual, movimento.moeda);
    const depois = disponivel + movimento.quantidade;

    if (depois < 0) {
      return {
        carteira,
        lancamentos: [],
        recusado: {
          moeda: movimento.moeda,
          disponivel,
          pedido: Math.abs(movimento.quantidade),
        },
      };
    }

    atual = comSaldo(atual, movimento.moeda, depois);
    lancamentos.push({ ...movimento, saldoDepois: depois });
  }

  return {
    carteira: lancamentos.length > 0 ? { ...atual, versao: carteira.versao + 1 } : carteira,
    lancamentos,
    recusado: null,
  };
}

/**
 * Movimentos de crédito de um prêmio de atividade.
 *
 * A chave de cada lançamento deriva da chave da tentativa. É o que faz o
 * despachante, o retry e o sync offline convergirem para o mesmo resultado: a
 * segunda vez bate no índice único de `LedgerEntry` e não credita nada.
 *
 * Uma chave por moeda, e não uma para o prêmio inteiro, porque `LedgerEntry` é
 * uma linha por moeda — chave repetida entre elas colidiria consigo mesma.
 */
export function creditosDePremio(
  premio: { readonly moedas: number; readonly cristais: number; readonly diamantes: number },
  origem: { readonly idempotencyKey: string; readonly refType: string; readonly refId: string },
): readonly Movimento[] {
  const base = (moeda: Moeda, quantidade: number): Movimento => ({
    moeda,
    quantidade,
    motivo: "ACTIVITY_REWARD",
    refType: origem.refType,
    refId: origem.refId,
    idempotencyKey: `${origem.idempotencyKey}:${moeda}`,
  });

  return [
    base("COIN", premio.moedas),
    base("CRYSTAL", premio.cristais),
    base("DIAMOND", premio.diamantes),
  ].filter((movimento) => movimento.quantidade !== 0);
}
