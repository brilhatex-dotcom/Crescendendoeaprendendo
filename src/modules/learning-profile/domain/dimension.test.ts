import { describe, expect, it } from "vitest";

import {
  calcularConfianca,
  calcularValor,
  contaComoEvidencia,
  mudouOSuficiente,
  recomputarDimensao,
} from "./dimension";

describe("contaComoEvidencia", () => {
  it("conta CORRECT, PARTIAL e INCORRECT", () => {
    expect(contaComoEvidencia("CORRECT")).toBe(true);
    expect(contaComoEvidencia("PARTIAL")).toBe(true);
    expect(contaComoEvidencia("INCORRECT")).toBe(true);
  });

  it("não conta pular ou estourar o tempo — não é sinal de modalidade", () => {
    expect(contaComoEvidencia("SKIPPED")).toBe(false);
    expect(contaComoEvidencia("TIMEOUT")).toBe(false);
  });
});

describe("calcularConfianca", () => {
  it("é 0 sem observação nenhuma", () => {
    expect(calcularConfianca(0)).toBe(0);
  });

  it("cresce rumo a 1 sem nunca alcançar", () => {
    expect(calcularConfianca(37)).toBeCloseTo(37 / 45, 5);
    expect(calcularConfianca(1000)).toBeLessThan(1);
    expect(calcularConfianca(1000)).toBeGreaterThan(0.99);
  });

  it("é monotônica: mais observações nunca reduz a confiança", () => {
    expect(calcularConfianca(20)).toBeGreaterThan(calcularConfianca(10));
  });
});

describe("calcularValor", () => {
  it("é null sem nenhuma observação", () => {
    expect(calcularValor([])).toBeNull();
  });

  it("é a média simples dos scoreRatio", () => {
    expect(calcularValor([1, 0.5, 0])).toBeCloseTo(0.5);
  });
});

describe("recomputarDimensao", () => {
  it("é null sem observação — não inventa um valor neutro", () => {
    expect(recomputarDimensao([])).toBeNull();
  });

  it("recomputa valor e confiança juntos", () => {
    const r = recomputarDimensao([1, 1, 0.5, 1]);
    expect(r?.value).toBeCloseTo(0.875);
    expect(r?.observationsCount).toBe(4);
    expect(r?.confidence).toBeCloseTo(4 / 12, 5);
  });

  it("é determinístico: a mesma lista de tentativas sempre recomputa o mesmo resultado", () => {
    const scores = [1, 0.8, 0.6, 1, 0];
    expect(recomputarDimensao(scores)).toEqual(recomputarDimensao(scores));
  });
});

describe("mudouOSuficiente", () => {
  it("sempre true quando não havia dimensão anterior", () => {
    expect(mudouOSuficiente(null, { value: 0.5, confidence: 0.1, observationsCount: 1 })).toBe(
      true,
    );
  });

  it("false quando o recompute dá exatamente o mesmo valor — a prova de idempotência", () => {
    const anterior = { value: 0.75, confidence: 0.5 };
    const recomputado = { value: 0.75, confidence: 0.5, observationsCount: 8 };
    expect(mudouOSuficiente(anterior, recomputado)).toBe(false);
  });

  it("true quando o valor se move além do limiar", () => {
    const anterior = { value: 0.5, confidence: 0.3 };
    const recomputado = { value: 0.6, confidence: 0.3, observationsCount: 10 };
    expect(mudouOSuficiente(anterior, recomputado)).toBe(true);
  });

  it("false para uma variação minúscula, dentro do limiar", () => {
    const anterior = { value: 0.5, confidence: 0.3 };
    const recomputado = { value: 0.505, confidence: 0.301, observationsCount: 10 };
    expect(mudouOSuficiente(anterior, recomputado)).toBe(false);
  });
});
