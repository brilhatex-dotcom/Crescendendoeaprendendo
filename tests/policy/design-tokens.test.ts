import { describe, expect, it } from "vitest";

import {
  academyPalette,
  brand,
  semantic,
} from "@/design-system/tokens/color";
import { fontSize } from "@/design-system/tokens/typography";

/**
 * TESTES DE POLÍTICA
 *
 * "Estas proibições são verificadas por testes automatizados que quebram o
 *  build — não confiamos apenas na disciplina do time."
 *  — Bíblia Vol. 1, Cap. 1 §1.6 (PG2)
 *
 * A defesa contra a deriva de produto não é a boa vontade de quem programa.
 * É um teste que falha.
 */

/** Converte hex em luminância relativa (WCAG 2.1). */
function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(clean.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

describe("Política: o erro nunca é vermelho (PP5)", () => {
  it("a cor do 'quase' é coral, não vermelho puro", () => {
    const { r, g, b } = hexToRgb(brand.almost);

    // Vermelho saturado ativa resposta de ameaça e piora a retenção infantil.
    // O coral tem verde e azul substanciais — não é um vermelho de alerta.
    expect(g).toBeGreaterThan(90);
    expect(b).toBeGreaterThan(90);
    expect(r - Math.max(g, b)).toBeLessThan(140);
  });

  it("o token de erro não é mais escuro que o de sucesso", () => {
    // Erro e acerto precisam ter peso visual equivalente. Um erro visualmente
    // mais "pesado" que o acerto ensina que errar é pior do que acertar é bom.
    const luzErro = relativeLuminance(brand.almost);
    const luzAcerto = relativeLuminance(brand.success);

    expect(luzErro).toBeGreaterThan(luzAcerto * 0.6);
  });
});

describe("Política: contraste AA em todo modo de superfície (V6)", () => {
  const modos = ["play", "care", "class"] as const;

  it.each(modos)("texto primário do modo %s atinge 4.5:1", (modo) => {
    const tokens = semantic[modo];
    const ratio = contrastRatio(
      tokens["text/primary"],
      tokens["surface/base"],
    );

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it.each(modos)("texto secundário do modo %s atinge 4.5:1", (modo) => {
    const tokens = semantic[modo];
    const ratio = contrastRatio(
      tokens["text/secondary"],
      tokens["surface/base"],
    );

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Política: as sete Academias (Bíblia Cap. 4)", () => {
  const esperadas = [
    "conhecimento",
    "inteligencia",
    "vida",
    "tecnologia",
    "criatividade",
    "descobertas",
    "prosperidade",
  ] as const;

  it("todas as sete têm paleta própria", () => {
    expect(Object.keys(academyPalette).sort()).toEqual([...esperadas].sort());
  });

  it("cada academia define os três tokens que o tema troca", () => {
    for (const [slug, paleta] of Object.entries(academyPalette)) {
      expect(paleta.from, `${slug}.from`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(paleta.to, `${slug}.to`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(paleta.glow, `${slug}.glow`).toMatch(/^rgba\(/);
    }
  });

  it("a Prosperidade usa paleta de terra, não de ouro cintilante", () => {
    // Bíblia Cap. 11 §11.2 — vacina o capítulo mais sensível contra
    // estética de ostentação.
    const { r, g, b } = hexToRgb(academyPalette.prosperidade.from);

    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(b).toBeLessThan(60); // sem brilho frio de metal precioso
  });
});

describe("Política: legibilidade infantil (docs/05 §3)", () => {
  it("o corpo de texto em SPROUT tem no mínimo 20px", () => {
    // Requisito de legibilidade para 6–8 anos, não preferência estética.
    const base = Number.parseFloat(fontSize.SPROUT.base) * 16;
    expect(base).toBeGreaterThanOrEqual(20);
  });

  it("a escala encolhe conforme a criança cresce", () => {
    const sprout = Number.parseFloat(fontSize.SPROUT.base);
    const explorer = Number.parseFloat(fontSize.EXPLORER.base);
    const adult = Number.parseFloat(fontSize.ADULT.base);

    expect(sprout).toBeGreaterThan(explorer);
    expect(explorer).toBeGreaterThan(adult);
  });
});
