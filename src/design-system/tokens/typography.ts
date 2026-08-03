/**
 * Design System "Aurora" — tipografia.
 * docs/05-design-system.md §3
 *
 * Corpo mínimo de 20px em SPROUT e entrelinha 1.6 são requisitos de
 * legibilidade infantil, não preferência estética.
 */

export const fontFamily = {
  display: "var(--font-display)", // Baloo 2 — títulos de missão, números de Luz
  body: "var(--font-body)", // Nunito — corpo, botões, painéis
  mono: "var(--font-mono)", // JetBrains Mono — relatórios, Academia da Tecnologia
  accessible: "var(--font-accessible)", // Atkinson Hyperlegible — opção dislexia
} as const;

/** A escala muda por faixa etária: o mesmo componente respira diferente. */
export const fontSize = {
  SPROUT: {
    xs: "0.875rem", // 14
    sm: "1rem", // 16
    base: "1.25rem", // 20 — mínimo para 6–8 anos
    lg: "1.5rem", // 24
    xl: "1.75rem", // 28
    display1: "2.75rem", // 44
  },
  EXPLORER: {
    xs: "0.8125rem",
    sm: "0.9375rem",
    base: "1.0625rem", // 17
    lg: "1.25rem",
    xl: "1.5rem",
    display1: "2.5rem",
  },
  ADULT: {
    xs: "0.75rem",
    sm: "0.8125rem",
    base: "0.9375rem", // 15
    lg: "1.0625rem",
    xl: "1.25rem",
    display1: "1.875rem",
  },
} as const;

export const lineHeight = {
  tight: "1.2",
  snug: "1.4",
  /** Padrão para texto infantil. */
  relaxed: "1.6",
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  black: "800",
} as const;
