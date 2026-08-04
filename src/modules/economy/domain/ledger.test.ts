import { describe, expect, it } from "vitest";

import {
  carteiraInicial,
  creditosDePremio,
  lancar,
  type Movimento,
} from "./ledger";

/**
 * A razão contábil é o lugar onde um defeito vira dinheiro de mentira que
 * alguém contou como verdade. Os testes aqui cobrem as invariantes de
 * docs/08 §5 — saldo nunca negativo, tudo-ou-nada, idempotência derivada.
 */

const credito = (parcial: Partial<Movimento> = {}): Movimento => ({
  moeda: "COIN",
  quantidade: 10,
  motivo: "ACTIVITY_REWARD",
  refType: "Attempt",
  refId: "act_1",
  idempotencyKey: "chave-1",
  ...parcial,
});

describe("lançamentos", () => {
  it("crédito soma e registra o saldo depois", () => {
    const resultado = lancar(carteiraInicial(), [credito()]);

    expect(resultado.carteira.fagulhas).toBe(10);
    expect(resultado.lancamentos[0]?.saldoDepois).toBe(10);
    expect(resultado.recusado).toBeNull();
  });

  it("cada moeda anda por conta própria", () => {
    const resultado = lancar(carteiraInicial(), [
      credito({ moeda: "COIN", quantidade: 5 }),
      credito({ moeda: "CRYSTAL", quantidade: 2, idempotencyKey: "chave-2" }),
      credito({ moeda: "DIAMOND", quantidade: 1, idempotencyKey: "chave-3" }),
    ]);

    expect(resultado.carteira).toMatchObject({ fagulhas: 5, prismas: 2, estrelas: 1 });
  });

  it("saldo nunca fica negativo", () => {
    const carteira = { ...carteiraInicial(), fagulhas: 8 };
    const resultado = lancar(carteira, [credito({ quantidade: -20 })]);

    expect(resultado.recusado).toEqual({ moeda: "COIN", disponivel: 8, pedido: 20 });
    expect(resultado.carteira).toBe(carteira);
  });

  it("um débito que não cabe cancela o lote inteiro", () => {
    const carteira = { ...carteiraInicial(), fagulhas: 100, prismas: 1 };

    const resultado = lancar(carteira, [
      credito({ quantidade: -50 }),
      credito({ moeda: "CRYSTAL", quantidade: -5, idempotencyKey: "chave-2" }),
    ]);

    // Aplicar em parte deixaria a criança com metade de uma compra — e sem
    // jeito de saber qual metade.
    expect(resultado.recusado?.moeda).toBe("CRYSTAL");
    expect(resultado.lancamentos).toEqual([]);
    expect(resultado.carteira).toBe(carteira);
  });

  it("gastar tudo é permitido; zero não é negativo", () => {
    const carteira = { ...carteiraInicial(), fagulhas: 30 };
    const resultado = lancar(carteira, [credito({ quantidade: -30 })]);

    expect(resultado.recusado).toBeNull();
    expect(resultado.carteira.fagulhas).toBe(0);
  });

  it("movimento de zero não gera lançamento nem nova versão", () => {
    const carteira = carteiraInicial();
    const resultado = lancar(carteira, [credito({ quantidade: 0 })]);

    // Linha de razão que não move saldo é ruído para quem for auditar.
    expect(resultado.lancamentos).toEqual([]);
    expect(resultado.carteira).toBe(carteira);
  });

  it("a versão avança só quando algo foi lançado", () => {
    const carteira = carteiraInicial();
    expect(lancar(carteira, [credito()]).carteira.versao).toBe(carteira.versao + 1);
    expect(lancar(carteira, []).carteira.versao).toBe(carteira.versao);
  });
});

describe("créditos de prêmio", () => {
  const premio = { moedas: 5, cristais: 2, diamantes: 0 };
  const origem = { idempotencyKey: "tentativa-abc", refType: "Attempt", refId: "act_9" };

  it("uma chave por moeda, derivada da chave da tentativa", () => {
    const movimentos = creditosDePremio(premio, origem);

    // Chave única por moeda: `LedgerEntry` é uma linha por moeda, e uma chave
    // só colidiria consigo mesma.
    const chaves = movimentos.map((m) => m.idempotencyKey);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const chave of chaves) expect(chave.startsWith(origem.idempotencyKey)).toBe(true);
  });

  it("moeda zerada não vira lançamento", () => {
    const movimentos = creditosDePremio(premio, origem);
    expect(movimentos.map((m) => m.moeda)).toEqual(["COIN", "CRYSTAL"]);
  });

  it("prêmio só de Luz não produz movimento nenhum", () => {
    expect(creditosDePremio({ moedas: 0, cristais: 0, diamantes: 0 }, origem)).toEqual([]);
  });

  it("a mesma origem produz sempre as mesmas chaves", () => {
    // É isto que faz retry e sync offline convergirem: a segunda vez bate no
    // índice único de `LedgerEntry` e não credita nada.
    expect(creditosDePremio(premio, origem)).toEqual(creditosDePremio(premio, origem));
  });
});
