import { describe, expect, it, vi } from "vitest";

import { LAYOUT_VAZIO } from "../domain/map-layout";
import { lerLayoutDoMapa } from "./map-layout-json";

/**
 * Leitura tolerante: nunca lança, nunca trava a tela do mapa por causa de um
 * `World.mapLayout` que não bate mais com o schema atual.
 */

describe("lerLayoutDoMapa", () => {
  it("lê um layout válido", () => {
    const bruto = {
      nos: [{ missaoRef: "conhecimento/mat/SPROUT/n1/m1/missao-01", x: 10, y: 90 }],
      arestas: [],
    };
    expect(lerLayoutDoMapa(bruto)).toEqual(bruto);
  });

  it("placeholder do importador ({nos:[]}) vira LAYOUT_VAZIO sem log", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(lerLayoutDoMapa({ schemaVersion: 1, nos: [], arestas: [] })).toEqual(LAYOUT_VAZIO);
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });

  it.each([
    ["null", null],
    ["não é objeto", "conteúdo qualquer"],
    ["objeto vazio", {}],
    ["nó com x fora de 0–100", { nos: [{ missaoRef: "m1", x: 200, y: 10 }] }],
  ])("%s vira LAYOUT_VAZIO", (_rotulo, bruto) => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(lerLayoutDoMapa(bruto)).toEqual(LAYOUT_VAZIO);
    aviso.mockRestore();
  });

  it("layout irreconhecível com nós avisa no console — conteúdo defasado merece atenção", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    lerLayoutDoMapa({ nos: [{ missaoRef: "m1", x: 200, y: 10 }] });
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });
});
