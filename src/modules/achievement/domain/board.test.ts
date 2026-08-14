import { describe, expect, it } from "vitest";

import { montarQuadro, type ItemDoCatalogoDeConquista } from "./board";

const VISIVEL: ItemDoCatalogoDeConquista = {
  code: "primeiro-farol",
  nome: "Primeiro Farol Aceso",
  descricao: "Dominou a primeira competência.",
  familia: "DOMINIO",
  grau: "BRONZE",
  oculta: false,
};

const OCULTA: ItemDoCatalogoDeConquista = {
  code: "segredo",
  nome: "Segredo",
  descricao: "Não devia aparecer antes de desbloquear.",
  familia: "DESCOBERTA",
  grau: "LENDARIA",
  oculta: true,
};

describe("montarQuadro", () => {
  it("conquista desbloqueada carrega nome, descrição e a data — mesmo se oculta", () => {
    const quadro = montarQuadro(
      [VISIVEL, OCULTA],
      new Map([
        ["primeiro-farol", { progresso: 1, desbloqueadaEm: new Date("2026-08-14T00:00:00Z") }],
        ["segredo", { progresso: 1, desbloqueadaEm: new Date("2026-08-14T00:00:00Z") }],
      ]),
    );

    for (const item of quadro) {
      expect(item.desbloqueada).toBe(true);
      if (item.desbloqueada) {
        expect(item.nome.length).toBeGreaterThan(0);
        expect(item.desbloqueadaEm).toEqual(new Date("2026-08-14T00:00:00Z"));
      }
    }
  });

  it("conquista visível e não desbloqueada mostra nome, descrição e progresso", () => {
    const [item] = montarQuadro([VISIVEL], new Map([["primeiro-farol", { progresso: 0.4, desbloqueadaEm: null }]]));

    expect(item?.desbloqueada).toBe(false);
    if (item && !item.desbloqueada && !item.oculta) {
      expect(item.nome).toBe("Primeiro Farol Aceso");
      expect(item.progresso).toBe(0.4);
    } else {
      throw new Error("esperava conquista visível com progresso");
    }
  });

  it("sem nenhum registro de progresso, conquista visível aparece com progresso 0", () => {
    const [item] = montarQuadro([VISIVEL], new Map());

    expect(item?.desbloqueada).toBe(false);
    if (item && !item.desbloqueada && !item.oculta) {
      expect(item.progresso).toBe(0);
    } else {
      throw new Error("esperava conquista visível com progresso 0");
    }
  });

  it("conquista oculta e não desbloqueada não carrega nome nem descrição", () => {
    const [item] = montarQuadro([OCULTA], new Map());

    expect(item).toEqual({ code: "segredo", desbloqueada: false, oculta: true });
  });
});
