import type { ZodType, ZodTypeDef } from "zod";

import type { Result } from "@/shared/kernel";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MOTOR DE ATIVIDADES — CONTRATOS
 *  ADR 0002 · docs/01 §3
 *
 *  Este arquivo é o núcleo. Ele não conhece nenhum tipo concreto de atividade,
 *  nenhuma missão, nenhum conteúdo. Ele descreve a FORMA de uma atividade —
 *  e é só isso que o resto do sistema precisa saber.
 *
 *  Regra que sustenta tudo: **o motor interpreta conteúdo, não contém conteúdo.**
 *  Se algum dia for preciso editar este arquivo para adicionar um tipo de
 *  atividade, a arquitetura falhou.
 *
 *  Proibido aqui: React, Next, Prisma, acesso a rede, acesso a relógio.
 *  Verificado em CI (`.dependency-cruiser.cjs`, regra `motor-e-puro`).
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Identidade do tipo de atividade ──────────────────────────────────────────

/**
 * Os tipos previstos. Espelha o enum `ActivityType` do banco (docs/04).
 *
 * Declarar os 20 aqui, com apenas 2 implementados, é intencional: o contrato do
 * conteúdo e do banco fica estável desde o começo, e adicionar um plugin não
 * exige migration. Um tipo sem plugin registrado simplesmente não é jogável —
 * e o validador de conteúdo acusa isso na hora, não em produção.
 */
export const ACTIVITY_TYPES = [
  "MULTIPLE_CHOICE",
  "MULTI_SELECT",
  "TRUE_FALSE",
  "FILL_BLANK",
  "WORD_BUILD",
  "DRAG_MATCH",
  "ORDER_SEQUENCE",
  "NUMBER_LINE",
  "GRID_PUZZLE",
  "MEMORY_PAIRS",
  "SPEED_TAP",
  "STORY_BRANCH",
  "CHESS_PUZZLE",
  "CODE_BLOCKS",
  "DRAWING_CANVAS",
  "AUDIO_RECORD",
  "FREE_TEXT",
  "PHOTO_PROOF",
  "SIMULATION",
  "BUILD_3D",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// ── Feedback pedagógico ──────────────────────────────────────────────────────

/**
 * O tom da devolutiva. Não existe "certo" e "errado" neste produto
 * (Bíblia Cap. 11 §11.2 · docs/08 §12.3).
 */
export type FeedbackTone =
  /** Acertou. Celebra sem exagero — elogio inflacionado perde valor. */
  | "CELEBRA"
  /** Chegou perto: acertou parte, ou errou por um detalhe identificável. */
  | "QUASE"
  /** Não chegou lá, mas há um caminho claro para tentar de novo. */
  | "ORIENTA";

/**
 * Devolutiva mostrada à criança.
 *
 * `mensagem` e `ensino` vêm do CONTEÚDO, não do código. O motor nunca inventa
 * texto pedagógico: quem escreve é quem autora a atividade, que sabe qual é o
 * equívoco provável e como desfazê-lo. O motor apenas escolhe qual devolutiva
 * se aplica ao que a criança respondeu.
 */
export interface FeedbackBase {
  readonly tom: FeedbackTone;
  /** Frase curta de reação. Ex.: "Isso! Você contou de dois em dois." */
  readonly mensagem: string;
  /** Pista para a próxima tentativa, quando faz sentido oferecer uma. */
  readonly dica?: string;
}

/**
 * Devolutiva de quem NÃO acertou.
 *
 * `ensino` é obrigatório — e é o compilador que garante, não a boa vontade de
 * quem escreve o plugin. Este é o mecanismo que torna a regra de docs/08 §12.3
 * impossível de violar por esquecimento: um `EvaluationResult` incorreto sem
 * ensino **não compila**.
 *
 * O racional pedagógico: erro sem explicação é só punição. Se o produto não tem
 * o que ensinar naquele momento, ele não deveria ter feito a pergunta.
 */
export interface FeedbackComEnsino extends FeedbackBase {
  readonly tom: "QUASE" | "ORIENTA";
  /** A explicação que transforma o erro em aprendizado. Nunca vazia. */
  readonly ensino: string;
}

export interface FeedbackDeAcerto extends FeedbackBase {
  readonly tom: "CELEBRA";
}

export type PedagogicalFeedback = FeedbackDeAcerto | FeedbackComEnsino;

// ── Resultado da avaliação ───────────────────────────────────────────────────

export type AttemptOutcome =
  | "CORRECT"
  | "PARTIAL"
  | "INCORRECT"
  | "SKIPPED"
  | "TIMEOUT";

/**
 * Marcações que o renderer usa para destacar a resposta na tela — quais itens
 * ficaram certos, quais saíram do lugar.
 *
 * É `unknown` de propósito no núcleo: cada plugin conhece a forma dos seus
 * próprios destaques, e o motor não precisa conhecer nenhuma. O renderer do
 * plugin faz o *narrowing* com o próprio schema.
 */
export type EvaluationDetails = Readonly<Record<string, unknown>>;

interface ResultadoBase {
  /** 0..1. Alimenta score, Elo e BKT — por isso é razão, não pontuação bruta. */
  readonly scoreRatio: number;
  readonly detalhes?: EvaluationDetails;
}

/**
 * Resultado de uma avaliação.
 *
 * União discriminada, e não um objeto com campos opcionais, exatamente para
 * que o caso "incorreto sem ensino" seja inexpressável. Ver `FeedbackComEnsino`.
 */
export type EvaluationResult =
  | (ResultadoBase & {
      readonly outcome: "CORRECT";
      readonly feedback: FeedbackDeAcerto;
    })
  | (ResultadoBase & {
      readonly outcome: "PARTIAL" | "INCORRECT" | "TIMEOUT";
      readonly feedback: FeedbackComEnsino;
      /**
       * Código do equívoco diagnosticado (`Attempt.misconception`).
       * Ex.: "contou-o-primeiro-elemento-como-zero". É o que permite, mais
       * tarde, o tutor e o relatório dos pais falarem do *padrão* de erro em
       * vez do erro isolado.
       */
      readonly equivoco?: string;
    })
  | (ResultadoBase & {
      readonly outcome: "SKIPPED";
      /** Pular não é errar: não há o que ensinar sobre uma resposta que não veio. */
      readonly feedback?: undefined;
    });

// ── Contexto da avaliação ────────────────────────────────────────────────────

/**
 * Tudo que `evaluate` pode saber além da resposta.
 *
 * Deliberadamente pequeno e sem identidade: **não há `learnerId` aqui**. Uma
 * função de correção que conhece a criança é uma função de correção que pode
 * corrigir diferente para crianças diferentes — e isso é injusto de um jeito
 * que ninguém percebe até ser tarde. O que entra é só o que muda a correção.
 */
export interface EvaluationContext {
  /** Quantas dicas a criança já pediu nesta atividade. */
  readonly dicasUsadas: number;
  /** Tentativa número N nesta mesma atividade, começando em 1. */
  readonly tentativa: number;
  /** Tempo gasto, para atividades com limite. */
  readonly duracaoMs: number;
  /** Idioma do conteúdo, para plugins sensíveis a texto. */
  readonly locale: string;
}

// ── O contrato do plugin ─────────────────────────────────────────────────────

/**
 * Um tipo de atividade. Declara exatamente cinco coisas e nada mais.
 *
 * @typeParam TConfig - o conteúdo autorado (a pergunta, as opções, as devolutivas)
 * @typeParam TAnswer - o que a criança envia
 */
export interface ActivityPlugin<TConfig = unknown, TAnswer = unknown> {
  readonly type: ActivityType;

  /**
   * Valida o conteúdo autorado. Roda na autoria, no CI e na leitura.
   *
   * O terceiro parâmetro é `unknown`, e não `TConfig`, de propósito: a entrada
   * é JSON de arquivo ou de banco, sobre o qual não temos garantia nenhuma. É
   * isso, também, que permite ao schema usar `.default()` e `.superRefine()` —
   * ambos fazem a entrada divergir da saída, e `ZodType<T>` sozinho exigiria
   * que fossem idênticas.
   */
  readonly configSchema: ZodType<TConfig, ZodTypeDef, unknown>;

  /** Valida o que chega do cliente. Entrada não declarada é rejeitada. */
  readonly answerSchema: ZodType<TAnswer, ZodTypeDef, unknown>;

  /**
   * Corrige. **Função pura**: mesmas entradas, mesmo resultado, sempre.
   *
   * Sem relógio, sem aleatoriedade, sem rede, sem banco. É isso que permite
   * rodar o MESMO código no servidor (autoritativo, à prova de trapaça) e no
   * cliente (devolutiva instantânea, funciona offline) sem duplicar a regra de
   * correção — que é o lugar mais caro do sistema para ter duas versões.
   */
  evaluate(
    config: TConfig,
    answer: TAnswer,
    ctx: EvaluationContext,
  ): EvaluationResult;

  /**
   * Probabilidade de acertar chutando, para o BKT (docs/08 §2).
   *
   * Depende da config, não só do tipo: múltipla escolha com 2 opções é 0.5;
   * com 5, é 0.2. Um valor fixo por tipo faria o modelo de domínio superestimar
   * o aprendizado justamente nas atividades mais fáceis de chutar.
   */
  probabilidadeDeChute(config: TConfig): number;

  /**
   * Identificador do componente de tela. O núcleo guarda a string; quem resolve
   * o import dinâmico é a camada de renderização (`renderers.tsx`), que é
   * cliente. Assim o motor continua puro e um Sudoku pesado não entra no bundle
   * de quem só vai ler um texto.
   */
  readonly rendererId: string;
}

/**
 * Plugin com os genéricos **selados**, para guardar em coleção heterogênea.
 *
 * O registro precisa guardar plugins de tipos diferentes no mesmo mapa, e ali
 * `TConfig` varia — o tipo concreto não sobrevive. A saída fácil seria `any`
 * (proibido) ou `ActivityPlugin<never, never>` (que nem tipa).
 *
 * A saída certa é esta: em vez de apagar o tipo, **fechamos** o plugin atrás de
 * uma fachada que só aceita dado cru e devolve `Result`. A conversão de cru
 * para tipado acontece dentro, onde os tipos concretos ainda existem, usando os
 * schemas Zod. Assim o apagamento fica confinado a uma função (`selar`) em vez
 * de espalhado por todo o motor — e nenhum `any` é necessário.
 */
export interface SealedPlugin {
  readonly type: ActivityType;
  readonly rendererId: string;

  /** Valida conteúdo autorado vindo de JSON. */
  validarConfig(bruto: unknown): Result<unknown>;

  /** Valida resposta vinda do cliente. */
  validarResposta(bruto: unknown): Result<unknown>;

  /**
   * Valida as duas pontas e corrige. Um único ponto de entrada, para que seja
   * impossível avaliar sem ter validado antes.
   */
  avaliar(
    configBruta: unknown,
    respostaBruta: unknown,
    ctx: EvaluationContext,
  ): Result<EvaluationResult>;

  probabilidadeDeChute(configBruta: unknown): Result<number>;
}
