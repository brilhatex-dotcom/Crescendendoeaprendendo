import { describe, expect, it } from "vitest";

import { sugestaoQualificada } from "./accessibility-recommendation";
import { dimensoesRelevantes, REGRAS_DE_DIMENSAO } from "./dimension-rules";

describe("sugestaoQualificada", () => {
  it("dimensão sem sugestão mapeada devolve null, mesmo com evidência forte", () => {
    expect(sugestaoQualificada("dimensaoQualquerSemMapeamento", 0.9, 0.9)).toBeNull();
  });

  it("confiança insuficiente devolve null", () => {
    expect(sugestaoQualificada("suporteVisual", 0.3, 0.9)).toBeNull();
  });

  it("valor insuficiente devolve null", () => {
    expect(sugestaoQualificada("suporteVisual", 0.9, 0.4)).toBeNull();
  });

  it("suporteVisual qualificado sugere pictogramsEnabled", () => {
    // O mesmo exemplo do pedido do dono: "Confiança: 82%, Observações: 37".
    const sugestao = sugestaoQualificada("suporteVisual", 0.82, 0.85);
    expect(sugestao).not.toBeNull();
    expect(sugestao?.dimensionKey).toBe("suporteVisual");
    expect(sugestao?.settingField).toBe("pictogramsEnabled");
  });

  it("instrucaoPassoAPasso qualificado sugere stepByStepInstructions", () => {
    const sugestao = sugestaoQualificada("instrucaoPassoAPasso", 0.7, 0.7);
    expect(sugestao?.settingField).toBe("stepByStepInstructions");
  });

  it("independenciaDeLeitura qualificado sugere textToSpeech", () => {
    const sugestao = sugestaoQualificada("independenciaDeLeitura", 0.7, 0.7);
    expect(sugestao?.settingField).toBe("textToSpeech");
  });

  it("toda dimensão que REGRAS_DE_DIMENSAO conhece tem uma sugestão mapeada — nenhuma fica órfã", () => {
    for (const chave of Object.keys(REGRAS_DE_DIMENSAO)) {
      expect(sugestaoQualificada(chave, 1, 1), chave).not.toBeNull();
    }
  });

  it("nenhum motivo (reason) menciona diagnóstico ou condição médica", () => {
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
      const sugestao = sugestaoQualificada(chave, 1, 1);
      const texto = sugestao?.reason.toLowerCase() ?? "";
      for (const termo of proibidas) {
        expect(texto, `${chave}: "${sugestao?.reason}"`).not.toContain(termo);
      }
    }
  });

  it("toda dimensão relevante de uma atividade totalmente características tem sugestão", () => {
    const chaves = dimensoesRelevantes({
      requiresReading: false,
      visualSupportLevel: "alto",
      stepCount: 4,
    });
    for (const chave of chaves) {
      expect(sugestaoQualificada(chave, 1, 1), chave).not.toBeNull();
    }
  });
});
