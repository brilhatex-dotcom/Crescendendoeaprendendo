import { describe, expect, it } from "vitest";

import { faixaParaIdade, resolverFaixaEtaria } from "./age-band";
import { isErr, unwrap } from "@/shared/kernel";

const HOJE = new Date("2026-08-03T12:00:00.000Z");

function codigoDoErro(birthYear: number): string | undefined {
  const resultado = resolverFaixaEtaria(birthYear, HOJE);
  return isErr(resultado) ? resultado.error.code : undefined;
}

describe("faixa etária", () => {
  it("mapeia cada faixa da Bíblia Cap. 2 §2.1", () => {
    expect(faixaParaIdade(6)).toBe("SPROUT");
    expect(faixaParaIdade(8)).toBe("SPROUT");
    expect(faixaParaIdade(9)).toBe("EXPLORER");
    expect(faixaParaIdade(12)).toBe("EXPLORER");
    expect(faixaParaIdade(13)).toBe("PIONEER");
    expect(faixaParaIdade(16)).toBe("VANGUARD");
    expect(faixaParaIdade(18)).toBeUndefined();
  });

  it("coloca a primeira usuária (7 anos) em SPROUT", () => {
    expect(unwrap(resolverFaixaEtaria(2019, HOJE))).toEqual({
      ageBand: "SPROUT",
      idade: 7,
    });
  });

  it("recusa criança abaixo da idade mínima", () => {
    expect(codigoDoErro(2022)).toBe("learner.age_out_of_range");
  });

  it("recusa acima de 17", () => {
    expect(codigoDoErro(2000)).toBe("learner.age_out_of_range");
  });

  it("recusa faixa que existe no modelo mas ainda não no produto", () => {
    // 14 anos → PIONEER, previsto no schema, sem conteúdo autorado.
    expect(codigoDoErro(2012)).toBe("learner.age_band_unavailable");
  });

  it("recusa ano no futuro e ano não inteiro", () => {
    expect(codigoDoErro(2030)).toBe("learner.birth_year_future");
    expect(codigoDoErro(2019.5)).toBe("learner.birth_year_invalid");
  });
});
