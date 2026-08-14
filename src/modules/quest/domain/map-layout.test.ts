import { describe, expect, it } from "vitest";

import { LAYOUT_VAZIO, layoutDoMapaSchema } from "./map-layout";

/**
 * O layout do mapa é geografia, não regra — mas a forma ainda precisa ser
 * validada, porque quem escreve `x`/`y` fora de 0–100 quebraria a projeção
 * na tela sem nenhum erro de compilação para avisar.
 */

const NO_VALIDO = { missaoRef: "conhecimento/mat/SPROUT/n1/m1/missao-01", x: 20, y: 80 };

describe("layoutDoMapaSchema", () => {
  it("aceita um layout com nós e arestas", () => {
    const analise = layoutDoMapaSchema.safeParse({
      nos: [NO_VALIDO, { missaoRef: "conhecimento/mat/SPROUT/n1/m1/missao-02", x: 50, y: 50 }],
      arestas: [{ de: NO_VALIDO.missaoRef, para: "conhecimento/mat/SPROUT/n1/m1/missao-02" }],
    });
    expect(analise.success).toBe(true);
  });

  it("arestas é opcional e vira lista vazia", () => {
    const analise = layoutDoMapaSchema.safeParse({ nos: [NO_VALIDO] });
    expect(analise.success).toBe(true);
    expect(analise.success && analise.data.arestas).toEqual([]);
  });

  it("exige ao menos um nó — mapa vazio não é um mapa autorado", () => {
    expect(layoutDoMapaSchema.safeParse({ nos: [] }).success).toBe(false);
  });

  it.each([
    ["x negativo", { ...NO_VALIDO, x: -1 }],
    ["x acima de 100", { ...NO_VALIDO, x: 101 }],
    ["y negativo", { ...NO_VALIDO, y: -1 }],
    ["y acima de 100", { ...NO_VALIDO, y: 101 }],
    ["missaoRef vazio", { ...NO_VALIDO, missaoRef: "" }],
  ])("recusa nó com %s", (_rotulo, no) => {
    expect(layoutDoMapaSchema.safeParse({ nos: [no] }).success).toBe(false);
  });

  it("recusa aresta com ponta vazia", () => {
    const analise = layoutDoMapaSchema.safeParse({
      nos: [NO_VALIDO],
      arestas: [{ de: "", para: NO_VALIDO.missaoRef }],
    });
    expect(analise.success).toBe(false);
  });
});

describe("LAYOUT_VAZIO", () => {
  it("não tem nó nem aresta", () => {
    expect(LAYOUT_VAZIO).toEqual({ nos: [], arestas: [] });
  });
});
