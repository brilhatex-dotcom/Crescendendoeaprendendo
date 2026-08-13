import { describe, expect, it } from "vitest";

import { codigosUnicos, montarGaleria, type ItemDoCatalogo } from "./gallery";

const CATALOGO: readonly ItemDoCatalogo[] = [
  { code: "concha-da-orla", nome: "Concha da Orla", simbolo: "🐚" },
  { code: "caranguejo-da-mare", nome: "Caranguejo da Maré", simbolo: "🦀" },
];

describe("montarGaleria", () => {
  it("revela nome e símbolo de quem já foi ganho", () => {
    const ganhaEm = new Date("2026-08-13T12:00:00Z");
    const galeria = montarGaleria(CATALOGO, new Map([["concha-da-orla", ganhaEm]]));

    expect(galeria[0]).toEqual({
      code: "concha-da-orla",
      descoberta: true,
      nome: "Concha da Orla",
      simbolo: "🐚",
      ganhaEm,
    });
  });

  it("esconde nome e símbolo de quem ainda não foi ganho", () => {
    const galeria = montarGaleria(CATALOGO, new Map());

    expect(galeria[1]).toEqual({ code: "caranguejo-da-mare", descoberta: false });
    // Nada além do code deve vazar — nem como propriedade undefined.
    expect(Object.keys(galeria[1] ?? {}).sort()).toEqual(["code", "descoberta"]);
  });

  it("preserva a ordem do catálogo", () => {
    const galeria = montarGaleria(CATALOGO, new Map());
    expect(galeria.map((f) => f.code)).toEqual(["concha-da-orla", "caranguejo-da-mare"]);
  });

  it("catálogo vazio dá galeria vazia", () => {
    expect(montarGaleria([], new Map())).toEqual([]);
  });
});

describe("codigosUnicos", () => {
  it("remove repetição preservando a primeira ocorrência", () => {
    expect(codigosUnicos(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("lista vazia dá lista vazia", () => {
    expect(codigosUnicos([])).toEqual([]);
  });
});
