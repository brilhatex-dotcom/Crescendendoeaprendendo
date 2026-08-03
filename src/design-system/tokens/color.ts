/**
 * Design System "Aurora" — cor.
 * Contrato: docs/05-design-system.md · Bíblia Vol. 1 Cap. 11
 *
 * Três camadas: primitivos → semânticos → componentes.
 * Valor cru (hex) dentro de componente é erro de lint. Sempre via token.
 */

// ── Camada 1: primitivos ─────────────────────────────────────────────────────

export const primitive = {
  violet: {
    50: "#F5F3FF",
    100: "#EDE9FE",
    300: "#C4B5FD",
    500: "#7C5CFF",
    700: "#5B3FD9",
    900: "#3B1E8F",
    950: "#0B0620",
  },
  cyan: { 300: "#67E8F9", 500: "#22D3EE", 700: "#0E7490" },
  amber: { 300: "#FCD34D", 500: "#FFB020", 700: "#B45309" },
  green: { 300: "#6EE7B7", 500: "#34D399", 700: "#047857" },
  coral: { 300: "#FDA4AF", 500: "#FB7185", 700: "#BE123C" },
  slate: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    900: "#0F172A",
    950: "#020617",
  },
  white: "#FFFFFF",
} as const;

// ── Camada 2: semânticos, por modo de superfície ─────────────────────────────
//
// Um sistema, três modos. É o que impede um painel de pais infantilizado ou
// uma área infantil corporativa (docs/05 §intro).

export type SurfaceMode = "play" | "care" | "class";

export const semantic = {
  /** Área da criança: mundo, cor saturada, profundidade, vidro. */
  play: {
    "surface/base": primitive.violet[950],
    "surface/raised": "#160C33",
    "surface/glass": "rgba(22, 12, 51, 0.78)",
    "text/primary": primitive.white,
    "text/secondary": primitive.slate[200],
    "border/subtle": "rgba(255, 255, 255, 0.12)",
  },
  /** Painel dos pais: calmo, denso em dado, alto contraste. */
  care: {
    "surface/base": primitive.slate[50],
    "surface/raised": primitive.white,
    "surface/glass": "rgba(255, 255, 255, 0.86)",
    "text/primary": primitive.slate[900],
    "text/secondary": primitive.slate[600],
    "border/subtle": primitive.slate[200],
  },
  /** Painel do professor: produtivo, densidade alta, zero decoração. */
  class: {
    "surface/base": primitive.white,
    "surface/raised": primitive.slate[50],
    "surface/glass": "rgba(255, 255, 255, 0.94)",
    "text/primary": primitive.slate[900],
    "text/secondary": primitive.slate[500],
    "border/subtle": primitive.slate[200],
  },
} as const;

// ── Marca e feedback ─────────────────────────────────────────────────────────

export const brand = {
  primary: primitive.violet[500], // Violeta Aurora — Luz/XP, ações principais
  secondary: primitive.cyan[500], // Turquesa Corrente — progresso, o Fagulha
  accent: primitive.amber[500], // Âmbar Fagulha — moedas, recompensa
  success: primitive.green[500], // Verde Folha — acerto, domínio
  /**
   * "Quase" — coral, NUNCA vermelho.
   * Vermelho saturado ativa resposta de ameaça e piora a retenção infantil.
   * Decisão pedagógica (PP5), não estética.
   */
  almost: primitive.coral[500],
  fog: primitive.slate[500], // A Névoa — o não explorado
} as const;

// ── As sete Academias ────────────────────────────────────────────────────────
//
// Trocar de ilha troca três variáveis. Nenhum componente conhece nomes de
// academia — Open/Closed no visual (docs/05 §2).

export interface AcademyPalette {
  readonly from: string;
  readonly to: string;
  readonly glow: string;
}

export const academyPalette = {
  conhecimento: { from: "#4F46E5", to: "#22D3EE", glow: "rgba(79, 70, 229, 0.45)" },
  inteligencia: { from: "#7C5CFF", to: "#EC4899", glow: "rgba(124, 92, 255, 0.45)" },
  vida: { from: "#10B981", to: "#84CC16", glow: "rgba(16, 185, 129, 0.45)" },
  tecnologia: { from: "#06B6D4", to: "#3B82F6", glow: "rgba(6, 182, 212, 0.45)" },
  criatividade: { from: "#FB923C", to: "#F472B6", glow: "rgba(251, 146, 60, 0.45)" },
  descobertas: { from: "#14B8A6", to: "#FDE047", glow: "rgba(20, 184, 166, 0.45)" },
  /** Terra, madeira, cobre — jamais ouro cintilante (Bíblia Cap. 11 §11.2). */
  prosperidade: { from: "#D97706", to: "#FBBF24", glow: "rgba(217, 119, 6, 0.45)" },
} as const satisfies Record<string, AcademyPalette>;

export type AcademySlug = keyof typeof academyPalette;
