import { describe, expect, it } from "vitest";

import { dimensoesRelevantes, REGRAS_DE_DIMENSAO } from "./dimension-rules";

const SEM_CARACTERISTICA = { requiresReading: null, visualSupportLevel: null, stepCount: null };

describe("dimensoesRelevantes", () => {
  it("não infere nada de uma atividade sem característica declarada", () => {
    expect(dimensoesRelevantes(SEM_CARACTERISTICA)).toEqual([]);
  });

  it("suporteVisual só conta com nível médio ou alto — não 'baixo' nem 'nenhum'", () => {
    expect(
      dimensoesRelevantes({ ...SEM_CARACTERISTICA, visualSupportLevel: "alto" }),
    ).toContain("suporteVisual");
    expect(
      dimensoesRelevantes({ ...SEM_CARACTERISTICA, visualSupportLevel: "medio" }),
    ).toContain("suporteVisual");
    expect(
      dimensoesRelevantes({ ...SEM_CARACTERISTICA, visualSupportLevel: "baixo" }),
    ).not.toContain("suporteVisual");
    expect(
      dimensoesRelevantes({ ...SEM_CARACTERISTICA, visualSupportLevel: "nenhum" }),
    ).not.toContain("suporteVisual");
  });

  it("instrucaoPassoAPasso exige 3 etapas ou mais", () => {
    expect(dimensoesRelevantes({ ...SEM_CARACTERISTICA, stepCount: 3 })).toContain(
      "instrucaoPassoAPasso",
    );
    expect(dimensoesRelevantes({ ...SEM_CARACTERISTICA, stepCount: 2 })).not.toContain(
      "instrucaoPassoAPasso",
    );
  });

  it("independenciaDeLeitura só quando a atividade declara que NÃO exige leitura", () => {
    expect(
      dimensoesRelevantes({ ...SEM_CARACTERISTICA, requiresReading: false }),
    ).toContain("independenciaDeLeitura");
    expect(
      dimensoesRelevantes({ ...SEM_CARACTERISTICA, requiresReading: true }),
    ).not.toContain("independenciaDeLeitura");
  });

  it("uma atividade pode ensinar mais de uma dimensão ao mesmo tempo", () => {
    const chaves = dimensoesRelevantes({
      requiresReading: false,
      visualSupportLevel: "alto",
      stepCount: 4,
    });
    expect([...chaves].sort()).toEqual(
      ["independenciaDeLeitura", "instrucaoPassoAPasso", "suporteVisual"].sort(),
    );
  });

  it("nenhuma chave de dimensão menciona diagnóstico ou condição médica", () => {
    const proibidas = [
      "autis",
      "tdah",
      "dislexi",
      "deficien",
      "transtorno",
      "superdotad",
      "diagnost",
    ];
    for (const chave of Object.keys(REGRAS_DE_DIMENSAO)) {
      for (const termo of proibidas) {
        expect(chave.toLowerCase(), chave).not.toContain(termo);
      }
    }
  });
});
