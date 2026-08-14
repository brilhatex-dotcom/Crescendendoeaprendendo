import { describe, expect, it } from "vitest";

import {
  criterioDeConquistaSchema,
  foiAlcancado,
  progressoDoCriterio,
  type CriterioDeConquista,
} from "./criteria";

describe("criterioDeConquistaSchema", () => {
  it("aceita os dois tipos conhecidos", () => {
    expect(
      criterioDeConquistaSchema.safeParse({ tipo: "competenciasDominadas", minimo: 5 }).success,
    ).toBe(true);
    expect(
      criterioDeConquistaSchema.safeParse({ tipo: "missoesConcluidas", minimo: 1 }).success,
    ).toBe(true);
  });

  it("recusa tipo desconhecido", () => {
    expect(
      criterioDeConquistaSchema.safeParse({ tipo: "inventado", minimo: 1 }).success,
    ).toBe(false);
  });

  it("recusa mínimo menor que 1", () => {
    expect(
      criterioDeConquistaSchema.safeParse({ tipo: "missoesConcluidas", minimo: 0 }).success,
    ).toBe(false);
  });

  it("recusa mínimo fracionário", () => {
    expect(
      criterioDeConquistaSchema.safeParse({ tipo: "missoesConcluidas", minimo: 1.5 }).success,
    ).toBe(false);
  });
});

describe("progressoDoCriterio", () => {
  const criterio: CriterioDeConquista = { tipo: "missoesConcluidas", minimo: 5 };

  it("é a razão entre a contagem e o mínimo", () => {
    expect(progressoDoCriterio(0, criterio)).toBe(0);
    expect(progressoDoCriterio(2, criterio)).toBe(0.4);
    expect(progressoDoCriterio(5, criterio)).toBe(1);
  });

  it("nunca ultrapassa 1, mesmo com contagem acima do mínimo", () => {
    expect(progressoDoCriterio(50, criterio)).toBe(1);
  });
});

describe("foiAlcancado", () => {
  it("verdadeiro só a partir de progresso 1", () => {
    expect(foiAlcancado(0.999)).toBe(false);
    expect(foiAlcancado(1)).toBe(true);
  });
});
