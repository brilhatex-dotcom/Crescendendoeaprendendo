import { z } from "zod";

import { fatorDeDificuldade } from "./difficulty";
import type { AttemptOutcome } from "./contracts";

/**
 * MOTOR DE RECOMPENSAS
 *
 * Nenhum número de recompensa mora neste arquivo. O que mora aqui é a *forma*
 * de uma regra de recompensa e a aritmética que a aplica. Os valores vêm do
 * conteúdo versionado (docs/08, cabeçalho: "constantes de balanceamento ficam
 * em `content/`, para ajuste sem deploy").
 *
 * Por que isso importa mais do que parece: balanceamento de economia muda toda
 * semana nos primeiros meses. Se cada ajuste de "quanto vale acertar de
 * primeira" exigir deploy, o balanceamento simplesmente não acontece — e uma
 * economia mal balanceada é o que faz criança farmar o fácil em vez de encarar
 * o difícil.
 */

// ── Moedas e prêmios ─────────────────────────────────────────────────────────

/**
 * Espelha `CurrencyKind` do banco. **Nenhuma delas é comprável com dinheiro
 * real** — invariante da Bíblia Cap. 6 §6.5, verificada em teste de política.
 */
export const currencyKindSchema = z.enum(["COINS", "CRYSTALS", "DIAMONDS"]);
export type CurrencyKind = z.infer<typeof currencyKindSchema>;

/**
 * Tudo que uma atividade ou missão pode conceder.
 *
 * A lista é aberta por construção: `itens`, `conquistas`, `desbloqueios` e
 * `colecionaveis` são ids opacos resolvidos por outros módulos. O motor de
 * atividades não sabe o que é um veículo nem uma parte da cidade — ele apenas
 * declara que aquilo foi concedido, e quem entende do assunto reage ao evento
 * (docs/01 §2). Adicionar "partes da cidade" não muda este arquivo.
 */
export const premioSchema = z.object({
  xp: z.number().int().min(0).default(0),
  moedas: z.number().int().min(0).default(0),
  cristais: z.number().int().min(0).default(0),
  diamantes: z.number().int().min(0).default(0),
  /** Energia — o "Fôlego". Pode ser devolvida, nunca cobrada para aprender. */
  folego: z.number().int().min(0).default(0),
  itens: z.array(z.string()).default([]),
  conquistas: z.array(z.string()).default([]),
  desbloqueios: z.array(z.string()).default([]),
  colecionaveis: z.array(z.string()).default([]),
});

export type Premio = z.infer<typeof premioSchema>;

export const PREMIO_VAZIO: Premio = {
  xp: 0,
  moedas: 0,
  cristais: 0,
  diamantes: 0,
  folego: 0,
  itens: [],
  conquistas: [],
  desbloqueios: [],
  colecionaveis: [],
};

// ── Regra de recompensa (dado autorado) ──────────────────────────────────────

/**
 * Quanto vale cada desfecho.
 *
 * Repare que `INCORRECT` também pode conceder XP — e o padrão de docs/08 §1 é
 * que conceda. "Acertar após ensino: 4 × fator, **nunca zero — errar e aprender
 * rende**." Zerar a recompensa de quem errou ensina a evitar o que é difícil.
 */
export const regraDeRecompensaSchema = z.object({
  /** Prêmio base por desfecho, antes do fator de dificuldade. */
  porDesfecho: z.object({
    CORRECT: premioSchema,
    PARTIAL: premioSchema,
    INCORRECT: premioSchema,
    SKIPPED: premioSchema.optional(),
    TIMEOUT: premioSchema.optional(),
  }),

  /**
   * Multiplicadores por dica usada. Índice 0 = nenhuma dica.
   * docs/08 §1: 10 de primeira, 6 após dica, 4 após ensino → [1, 0.6, 0.4].
   * Pedir ajuda reduz o ganho, mas nunca o anula: pedir ajuda é comportamento
   * que queremos ensinar, não punir.
   */
  multiplicadorPorDica: z.array(z.number().min(0).max(1)).default([1]),

  /**
   * Decaimento ao rejogar (docs/08 §3): 100% → 30% → 10% → 0%.
   * Praticar de novo é livre; farmar não compensa.
   */
  decaimentoPorRepeticao: z.array(z.number().min(0).max(1)).default([1, 0.3, 0.1, 0]),

  /** Se falso, o fator de dificuldade não se aplica (ex.: prêmio fixo de missão). */
  aplicarFatorDeDificuldade: z.boolean().default(true),
});

export type RegraDeRecompensa = z.infer<typeof regraDeRecompensaSchema>;

// ── Cálculo ──────────────────────────────────────────────────────────────────

export interface ContextoDeRecompensa {
  readonly outcome: AttemptOutcome;
  readonly dicasUsadas: number;
  /** 0 na primeira vez que joga esta atividade. */
  readonly repeticoes: number;
  readonly dificuldadeDaAtividade: number;
  readonly habilidadeDaCrianca: number;
  /**
   * Fôlego zerado corta apenas o cosmético: XP e domínio continuam integrais
   * (docs/08 §4). Energia nunca impede aprender.
   */
  readonly semFolego: boolean;
}

/**
 * Aplica a regra e devolve o prêmio final.
 *
 * Função pura: nenhum efeito, nenhuma escrita. Quem credita é o módulo de
 * economia, em transação e com `idempotencyKey` (docs/08 §5.2). Este arquivo só
 * calcula quanto — e por isso pode ser testado exaustivamente sem banco.
 */
export function calcularPremio(
  regra: RegraDeRecompensa,
  ctx: ContextoDeRecompensa,
): Premio {
  const base = regra.porDesfecho[ctx.outcome];
  if (!base) return PREMIO_VAZIO;

  const fatorDica = ultimoOuIndice(regra.multiplicadorPorDica, ctx.dicasUsadas, 1);
  const fatorRepeticao = ultimoOuIndice(regra.decaimentoPorRepeticao, ctx.repeticoes, 1);
  const fatorDesafio = regra.aplicarFatorDeDificuldade
    ? fatorDeDificuldade(ctx.dificuldadeDaAtividade, ctx.habilidadeDaCrianca)
    : 1;

  const multiplicador = fatorDica * fatorRepeticao * fatorDesafio;

  /**
   * XP e domínio ignoram a falta de Fôlego; moeda e cosmético, não.
   * É exatamente esta linha que implementa a regra ética de docs/08 §4 — e a
   * razão de ela estar aqui, no cálculo, e não numa checagem de UI que alguém
   * poderia esquecer numa tela nova.
   */
  const fatorEconomico = ctx.semFolego ? 0 : 1;

  return {
    xp: Math.round(base.xp * multiplicador),
    moedas: Math.round(base.moedas * multiplicador * fatorEconomico),
    cristais: Math.round(base.cristais * multiplicador * fatorEconomico),
    diamantes: Math.round(base.diamantes * multiplicador * fatorEconomico),
    folego: base.folego,
    itens: ctx.semFolego ? [] : base.itens,
    conquistas: base.conquistas,
    desbloqueios: base.desbloqueios,
    colecionaveis: ctx.semFolego ? [] : base.colecionaveis,
  };
}

/** Lê o índice; passando do fim, repete o último valor declarado. */
function ultimoOuIndice(
  valores: readonly number[],
  indice: number,
  padrao: number,
): number {
  if (valores.length === 0) return padrao;
  const posicao = Math.min(Math.max(indice, 0), valores.length - 1);
  return valores[posicao] ?? padrao;
}

export function somarPremios(a: Premio, b: Premio): Premio {
  return {
    xp: a.xp + b.xp,
    moedas: a.moedas + b.moedas,
    cristais: a.cristais + b.cristais,
    diamantes: a.diamantes + b.diamantes,
    folego: a.folego + b.folego,
    itens: [...a.itens, ...b.itens],
    conquistas: [...a.conquistas, ...b.conquistas],
    desbloqueios: [...a.desbloqueios, ...b.desbloqueios],
    colecionaveis: [...a.colecionaveis, ...b.colecionaveis],
  };
}
