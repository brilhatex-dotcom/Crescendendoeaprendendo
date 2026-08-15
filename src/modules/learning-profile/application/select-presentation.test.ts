import { describe, expect, it } from "vitest";

import type { CaracteristicasDaAtividade } from "../domain/dimension-rules";
import type { DimensaoDoPerfil } from "./read-profile";
import { escolherApresentacao, type ApresentacaoCandidata } from "./select-presentation";

const SEM_CARACTERISTICAS: CaracteristicasDaAtividade = {
  requiresReading: null,
  visualSupportLevel: null,
  stepCount: null,
};

function dimensao(
  key: string,
  value: number,
  confidence: number,
): DimensaoDoPerfil {
  return { key, value, confidence, observationsCount: 0, lastObservedAt: null };
}

function candidata(
  tag: string | null,
  caracteristicas: Partial<CaracteristicasDaAtividade>,
): ApresentacaoCandidata<string> {
  return {
    tag,
    caracteristicas: { ...SEM_CARACTERISTICAS, ...caracteristicas },
    payload: tag ?? "padrao",
  };
}

const PADRAO = candidata(null, {});

describe("escolherApresentacao", () => {
  it("sem perfil, devolve a padrão", () => {
    const visual = candidata("suporte-visual-alto", { visualSupportLevel: "alto" });
    expect(escolherApresentacao([], PADRAO, [visual])).toBe(PADRAO);
  });

  it("sem variantes, devolve a padrão", () => {
    const perfil = [dimensao("suporteVisual", 0.9, 0.9)];
    expect(escolherApresentacao(perfil, PADRAO, [])).toBe(PADRAO);
  });

  it("confiança abaixo do limiar não qualifica a variante", () => {
    const perfil = [dimensao("suporteVisual", 0.9, 0.3)];
    const visual = candidata("suporte-visual-alto", { visualSupportLevel: "alto" });
    expect(escolherApresentacao(perfil, PADRAO, [visual])).toBe(PADRAO);
  });

  it("valor abaixo do limiar não qualifica a variante — desempenho ruim não é motivo pra trocar", () => {
    const perfil = [dimensao("suporteVisual", 0.4, 0.9)];
    const visual = candidata("suporte-visual-alto", { visualSupportLevel: "alto" });
    expect(escolherApresentacao(perfil, PADRAO, [visual])).toBe(PADRAO);
  });

  it("confiança e valor suficientes: escolhe a variante", () => {
    const perfil = [dimensao("suporteVisual", 0.85, 0.82)];
    const visual = candidata("suporte-visual-alto", { visualSupportLevel: "alto" });
    expect(escolherApresentacao(perfil, PADRAO, [visual])).toBe(visual);
  });

  it("entre duas variantes qualificadas, escolhe a de maior valor × confiança", () => {
    const perfil = [
      dimensao("suporteVisual", 0.7, 0.7),
      dimensao("instrucaoPassoAPasso", 0.95, 0.9),
    ];
    const visual = candidata("suporte-visual-alto", { visualSupportLevel: "alto" });
    const passoAPasso = candidata("passo-a-passo", { stepCount: 3 });
    expect(escolherApresentacao(perfil, PADRAO, [visual, passoAPasso])).toBe(passoAPasso);
  });

  it("variante sem nenhuma dimensão relevante nunca é escolhida, mesmo com perfil forte", () => {
    const perfil = [dimensao("suporteVisual", 0.95, 0.95)];
    // Só declara tipoDeInteracao — não mapeia a dimensão nenhuma em REGRAS_DE_DIMENSAO.
    const semDimensao = candidata("so-tipo-de-interacao", {});
    expect(escolherApresentacao(perfil, PADRAO, [semDimensao])).toBe(PADRAO);
  });

  it("determinístico: mesma entrada, mesma saída", () => {
    const perfil = [dimensao("suporteVisual", 0.85, 0.82)];
    const visual = candidata("suporte-visual-alto", { visualSupportLevel: "alto" });
    const a = escolherApresentacao(perfil, PADRAO, [visual]);
    const b = escolherApresentacao(perfil, PADRAO, [visual]);
    expect(a).toBe(b);
  });
});
