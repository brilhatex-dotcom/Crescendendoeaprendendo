import { z } from "zod";

import { APRESENTACAO_PADRAO, apresentacaoDeFeedbackSchema } from "./presentation";
import type { ApresentacaoDeFeedback } from "./presentation";
import type { EvaluationResult, FeedbackTone } from "./contracts";
import { calcularPremio, type Premio, type RegraDeRecompensa } from "./rewards";
import { DIFICULDADE_INICIAL, type DifficultyLabel } from "./difficulty";

/**
 * SESSÃO DE MISSÃO — o estado de uma jogada.
 *
 * Puro e serializável: nenhuma referência a componente, banco ou requisição.
 * É isso que torna a sessão **retomável** — fechar o app no meio de uma missão
 * nunca pode custar progresso (docs/04, `QuestRun`), e um estado que carrega
 * objetos vivos não sobrevive a uma serialização.
 */

export interface AtividadeNaSessao {
  readonly slug: string;
  /**
   * Identidade estável da atividade no acervo — o mesmo valor gravado em
   * `Activity.sourceRef` pelo importador.
   *
   * É a ponte entre o mundo do conteúdo (arquivos, slugs) e o mundo do
   * histórico (linhas, ids). Sem ela, registrar uma tentativa exigiria que o
   * executor de missão conhecesse chave primária de tabela — e o motor voltaria
   * a depender de banco, que é justamente o que esta camada evita.
   */
  readonly ref: string;
  readonly tipo: string;
  readonly objetivo: string;
  readonly config: unknown;
  readonly dificuldade: DifficultyLabel;
  readonly recompensa?: RegraDeRecompensa | undefined;
  /**
   * Tag da apresentação servida (`Activity.presentationVariants`), ou `null`
   * para a apresentação padrão. Escolhida por `escolherApresentacao`
   * (Motor de Aprendizagem Adaptativa, Fase 3) antes da sessão existir — o
   * motor só recebe o `config` já decidido, nunca sabe que houve escolha.
   */
  readonly presentationTag: string | null;
}

export interface FaseNaSessao {
  readonly slug: string;
  readonly nome: string;
  readonly atividades: readonly AtividadeNaSessao[];
}

export interface MissaoNaSessao {
  readonly slug: string;
  /**
   * Identidade estável da missão no acervo — o mesmo valor gravado em
   * `Quest.sourceRef` pelo importador. Ver `AtividadeNaSessao.ref`.
   */
  readonly ref: string;
  readonly nome: string;
  readonly introducao: string;
  readonly conclusao: string;
  readonly fases: readonly FaseNaSessao[];
  readonly recompensaDaMissao?: RegraDeRecompensa | undefined;
}

/** Posição atual dentro da missão. */
export interface PosicaoNaMissao {
  readonly fase: number;
  readonly atividade: number;
}

export function primeiraPosicao(): PosicaoNaMissao {
  return { fase: 0, atividade: 0 };
}

/**
 * Avança para a próxima atividade, atravessando fases.
 * Devolve `null` quando a missão acabou.
 */
export function proximaPosicao(
  missao: MissaoNaSessao,
  atual: PosicaoNaMissao,
): PosicaoNaMissao | null {
  const fase = missao.fases[atual.fase];
  if (!fase) return null;

  if (atual.atividade + 1 < fase.atividades.length) {
    return { fase: atual.fase, atividade: atual.atividade + 1 };
  }

  let proximaFase = atual.fase + 1;
  while (proximaFase < missao.fases.length) {
    if ((missao.fases[proximaFase]?.atividades.length ?? 0) > 0) {
      return { fase: proximaFase, atividade: 0 };
    }
    proximaFase += 1;
  }

  return null;
}

export function atividadeEm(
  missao: MissaoNaSessao,
  posicao: PosicaoNaMissao,
): AtividadeNaSessao | null {
  return missao.fases[posicao.fase]?.atividades[posicao.atividade] ?? null;
}

export function totalDeAtividades(missao: MissaoNaSessao): number {
  return missao.fases.reduce((total, fase) => total + fase.atividades.length, 0);
}

export function indiceAbsoluto(
  missao: MissaoNaSessao,
  posicao: PosicaoNaMissao,
): number {
  let indice = 0;
  for (let f = 0; f < posicao.fase; f += 1) {
    indice += missao.fases[f]?.atividades.length ?? 0;
  }
  return indice + posicao.atividade;
}

// ── Apresentação da devolutiva ───────────────────────────────────────────────

/**
 * Resolve como a devolutiva aparece: o que o conteúdo pediu, com o padrão do
 * tom preenchendo o resto.
 *
 * O conteúdo só declara o que quer mudar. Obrigar cada atividade a repetir os
 * seis campos de apresentação faria autor nenhum ajustar nada.
 */
export function resolverApresentacao(
  tom: FeedbackTone,
  declarado: Partial<ApresentacaoDeFeedback> | undefined,
): ApresentacaoDeFeedback {
  return apresentacaoDeFeedbackSchema.parse({
    ...APRESENTACAO_PADRAO[tom],
    ...(declarado ?? {}),
  });
}

// ── Pontuação e prêmio da atividade ──────────────────────────────────────────

export interface ContextoDaJogada {
  readonly dicasUsadas: number;
  readonly repeticoes: number;
  readonly habilidadeDaCrianca: number;
  readonly semFolego: boolean;
}

/**
 * Prêmio de uma atividade avaliada.
 *
 * Atividade sem regra de recompensa declarada não paga nada — e isso é
 * proposital. Um valor padrão escondido no código seria exatamente o tipo de
 * número que ninguém encontra quando a economia precisa ser rebalanceada.
 */
export function premioDaAtividade(
  atividade: AtividadeNaSessao,
  resultado: EvaluationResult,
  ctx: ContextoDaJogada,
): Premio | null {
  if (!atividade.recompensa) return null;

  return calcularPremio(atividade.recompensa, {
    outcome: resultado.outcome,
    dicasUsadas: ctx.dicasUsadas,
    repeticoes: ctx.repeticoes,
    dificuldadeDaAtividade: DIFICULDADE_INICIAL[atividade.dificuldade],
    habilidadeDaCrianca: ctx.habilidadeDaCrianca,
    semFolego: ctx.semFolego,
  });
}

// ── Resposta enviada pelo cliente ────────────────────────────────────────────

/**
 * Envelope da submissão. O conteúdo de `resposta` é validado pelo
 * `answerSchema` do plugin — este schema só garante o envelope.
 */
export const submissaoSchema = z.object({
  missaoSlug: z.string().min(1).max(80),
  atividadeSlug: z.string().min(1).max(80),
  resposta: z.unknown(),
  dicasUsadas: z.number().int().min(0).max(10).default(0),
  tentativa: z.number().int().min(1).max(50).default(1),
  duracaoMs: z.number().int().min(0).max(3_600_000).default(0),
});

export type Submissao = z.infer<typeof submissaoSchema>;
