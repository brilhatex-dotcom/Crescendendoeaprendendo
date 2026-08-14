import { z } from "zod";

import { ACTIVITY_TYPES, DIFFICULTY_LABELS, regraDeRecompensaSchema } from "@/activities";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SCHEMAS DE AUTORIA DE CONTEÚDO
 *
 *  O contrato de tudo que pode ser escrito em `content/`. Um arquivo que não
 *  passa por aqui não entra na `main` — `scripts/validate-content.ts` roda no
 *  CI.
 *
 *  ── Por que validar conteúdo com o mesmo rigor do código ──
 *  Conteúdo quebrado não dá erro de compilação. Ele dá uma tela travada na
 *  frente de uma criança de 6 anos que não tem como reportar bug. O validador
 *  é o compilador do conteúdo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Blocos reutilizados ──────────────────────────────────────────────────────

/** Identificador legível e estável, usado em caminho de arquivo e em referência. */
export const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use apenas minúsculas, números e hífen (ex.: 'numeros-ate-10').",
  );

export const ageBandSchema = z.enum(["SPROUT", "EXPLORER", "PIONEER", "VANGUARD"]);

export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

export const difficultyLabelSchema = z.enum(DIFFICULTY_LABELS);

// ── Currículo (competências) ─────────────────────────────────────────────────

/**
 * Objetivo de aprendizagem — a unidade a que as atividades se ligam.
 *
 * `codigoBncc` é opcional de propósito: metade do que esta plataforma ensina
 * (dinheiro, emoções, segurança digital, empreendedorismo) **não está na BNCC**.
 * Exigir o código forçaria a inventar códigos falsos ou a deixar de fora
 * justamente o conteúdo que diferencia o produto.
 */
export const objetivoSchema = z.object({
  slug: slugSchema,
  descricao: z.string().min(10).max(300),
  codigoBncc: z
    .string()
    .regex(/^EF\d{2}[A-Z]{2}\d{2}$/, "Código BNCC no formato EF01MA01.")
    .optional(),
  /** Objetivos que precisam vir antes. Forma o DAG de pré-requisitos. */
  preRequisitos: z.array(slugSchema).default([]),
});

export const competenciaSchema = z.object({
  slug: slugSchema,
  nome: z.string().min(3).max(120),
  descricao: z.string().min(10).max(500),
  objetivos: z.array(objetivoSchema).min(1),
});

export const disciplinaCurricularSchema = z.object({
  slug: slugSchema,
  nome: z.string().min(2).max(80),
  /** Área da BNCC, quando aplicável. */
  area: z.string().max(80).optional(),
  competencias: z.array(competenciaSchema).min(1),
});

// ── Atividade autorada ───────────────────────────────────────────────────────

/**
 * Uma atividade dentro de uma fase.
 *
 * `config` é `unknown` aqui de propósito: quem sabe validar o conteúdo de uma
 * múltipla escolha é o *plugin* de múltipla escolha, não este arquivo. O
 * validador faz a segunda passada, entregando cada `config` ao `configSchema`
 * do plugin correspondente. É isso que permite adicionar o 30º tipo sem tocar
 * neste schema.
 */
export const atividadeAutoradaSchema = z.object({
  slug: slugSchema,
  tipo: activityTypeSchema,
  /** Objetivo de aprendizagem que esta atividade exercita. */
  objetivo: slugSchema,
  dificuldade: difficultyLabelSchema.default("MEDIO"),
  /** Segundos estimados. Alimenta o planejamento de sessão e o aviso de tempo. */
  duracaoEstimadaSeg: z.number().int().min(5).max(1800).default(60),
  faixaMinima: ageBandSchema,
  faixaMaxima: ageBandSchema,
  /** Validado pelo plugin do `tipo`, na segunda passada do validador. */
  config: z.unknown(),
  recompensa: regraDeRecompensaSchema.optional(),
});

// ── Fase (etapa dentro da missão) ────────────────────────────────────────────

/**
 * Fase = `Stage` no banco (docs/04).
 *
 * Nota sobre nomenclatura: no pedido original a "Fase" aparece acima da
 * "Missão". No modelo de dados já aprovado, `Stage` é uma etapa *dentro* de
 * `Quest` — a missão tem fases, e não o contrário. Seguimos o modelo de dados
 * para não criar duas verdades; se a intenção era outra hierarquia, ela cabe
 * como "Módulo", que existe logo acima.
 */
export const faseSchema = z.object({
  slug: slugSchema,
  nome: z.string().min(2).max(120),
  /** Quantos acertos para passar. Ausente = todas as atividades. */
  minimoParaPassar: z.number().int().min(0).optional(),
  atividades: z.array(atividadeAutoradaSchema).min(1),
});

// ── Missão ───────────────────────────────────────────────────────────────────

export const questKindSchema = z.enum([
  "STORY",
  "PRACTICE",
  "CHALLENGE",
  "BOSS",
  "REVIEW",
  "PROJECT",
  "FAMILY",
  "DAILY",
]);

/**
 * Regra de desbloqueio declarativa (docs/08 §3).
 *
 * A gramática é recursiva (`all`/`any`/condições) e vive **num lugar só**: o
 * módulo que a avalia. Este arquivo a importa em vez de redeclará-la — duas
 * definições da mesma gramática é como as duas passam a divergir, e a
 * divergência apareceria como conteúdo válido na autoria que o motor não
 * entende em produção.
 *
 * A dependência é de mão única (autoria → avaliador) e não cria ciclo.
 */
import { layoutDoMapaSchema, regraDeDesbloqueioSchema as regraDeDesbloqueio } from "@/modules/quest";

export { regraDeDesbloqueio as regraDeDesbloqueioSchema };

export const missaoSchema = z.object({
  slug: slugSchema,
  nome: z.string().min(3).max(160),
  tipo: questKindSchema.default("PRACTICE"),
  /** Texto curto que a criança lê antes de começar. */
  introducao: z.string().min(10).max(600),
  /** Fala de encerramento. */
  conclusao: z.string().min(5).max(600),
  ordem: z.number().int().min(0),
  desbloqueio: regraDeDesbloqueio.optional(),
  recompensaDaMissao: regraDeRecompensaSchema.optional(),
  /** Competências que um Colosso (chefão) cobra. */
  competenciasExigidas: z.array(slugSchema).default([]),
  fases: z.array(faseSchema).min(1),
});

// ── Catálogo de colecionáveis ("figurinhas") ─────────────────────────────────

/**
 * Uma figurinha do álbum da criança.
 *
 * `code` é o mesmo texto que uma `regraDeRecompensaSchema.colecionaveis`
 * declara em qualquer missão ou atividade — o motor de atividades só concede
 * o código (`src/activities/rewards.ts`); é este catálogo que diz o que ele
 * significa. `simbolo` é emoji, não upload de imagem, mesma decisão de
 * `stimulus.ts` para o apoio visual: sem `assetId`, a figurinha existe assim
 * que o arquivo é revisado em pull request.
 */
export const colecionavelSchema = z.object({
  code: slugSchema,
  nome: z.string().min(2).max(80),
  simbolo: z.string().min(1).max(8),
});

export const catalogoDeColecionaveisSchema = z.object({
  colecionaveis: z.array(colecionavelSchema).min(1),
});

export type Colecionavel = z.infer<typeof colecionavelSchema>;
export type CatalogoDeColecionaveis = z.infer<typeof catalogoDeColecionaveisSchema>;

// ── Estrutura acima da missão ────────────────────────────────────────────────

export const moduloSchema = z.object({
  slug: slugSchema,
  nome: z.string().min(2).max(120),
  descricao: z.string().max(500).optional(),
  ordem: z.number().int().min(0),
});

export const nivelSchema = z.object({
  slug: slugSchema,
  nome: z.string().min(2).max(120),
  ordem: z.number().int().min(0),
  /** Nível mínimo da criança para o conteúdo aparecer no mapa. */
  nivelMinimo: z.number().int().min(1).default(1),
  /**
   * Geografia do mapa deste mundo: onde cada missão aparece (`x`/`y` em
   * percentual) e que caminhos a ligam às vizinhas. Opcional — mundo sem
   * `mapa` cai na lista simples (ver `docs/HANDOFF.md`, "Mapa desenhado").
   * `missaoRef` é a mesma referência completa usada em
   * `desbloqueio.questCompleted` (`academia/disciplina/FAIXA/nivel/modulo/missao-slug`).
   * A integridade (todo nó aponta para uma missão real deste mundo, toda
   * missão do mundo tem nó, toda aresta liga nós existentes) é conferida em
   * `src/modules/content/domain/plan.ts`, não aqui — este schema só garante
   * a forma.
   */
  mapa: layoutDoMapaSchema.optional(),
});

export const disciplinaSchema = z.object({
  slug: slugSchema,
  nome: z.string().min(2).max(80),
  /** Aponta para a disciplina do currículo, onde vivem os objetivos. */
  curriculo: slugSchema,
});

export const academiaSchema = z.object({
  slug: slugSchema,
  nome: z.string().min(2).max(80),
  ilha: z.string().min(2).max(80),
  guardiao: z.string().min(2).max(80),
  descricao: z.string().min(10).max(600),
  ordem: z.number().int().min(0),
  /** Cores do tema. Trocar de ilha troca só estas três (docs/05 §2). */
  paleta: z.object({
    de: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    para: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    brilho: z.string().min(4).max(60),
  }),
});

export type Academia = z.infer<typeof academiaSchema>;
export type Disciplina = z.infer<typeof disciplinaSchema>;
export type Nivel = z.infer<typeof nivelSchema>;
export type Modulo = z.infer<typeof moduloSchema>;
export type Missao = z.infer<typeof missaoSchema>;
export type Fase = z.infer<typeof faseSchema>;
export type AtividadeAutorada = z.infer<typeof atividadeAutoradaSchema>;
export type DisciplinaCurricular = z.infer<typeof disciplinaCurricularSchema>;
export type Objetivo = z.infer<typeof objetivoSchema>;
