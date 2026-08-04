import { z } from "zod";

/**
 * REGRA DE DESBLOQUEIO (docs/08 §3).
 *
 * ── A decisão que define este arquivo ──
 * O avaliador **não devolve um booleano**. Devolve o que falta.
 *
 * `docs/08 §3` é explícito: "o mapa mostra o caminho, nunca só um cadeado".
 * Um cadeado sem explicação é uma parede sem porta — a criança não sabe o que
 * fazer e conclui que o jogo decidiu que ela não pode. Devolver as pendências
 * estruturadas é o que permite à tela dizer *"Treine 2 missões em Frações para
 * enfrentar o Guardião"* em vez de mostrar um ícone fechado.
 *
 * Por isso `Jogabilidade` carrega `pendencias`, e por isso elas são dados e não
 * texto: quem escreve a frase é a camada de apresentação, que conhece o léxico
 * e a faixa etária de quem lê.
 *
 * Arquivo puro.
 */

// ── Gramática ────────────────────────────────────────────────────────────────

export interface CondicaoDeNivel {
  readonly level: { readonly gte: number };
}

export interface CondicaoDeMissao {
  /** Referência da missão em `content/` (`Quest.sourceRef`). */
  readonly questCompleted: string;
}

export interface CondicaoDeDominio {
  readonly masteryAvg: {
    /** Slugs de objetivo — os mesmos de `competenciasExigidas`. */
    readonly skills: readonly string[];
    readonly gte: number;
  };
}

export type CondicaoDeDesbloqueio =
  | CondicaoDeNivel
  | CondicaoDeMissao
  | CondicaoDeDominio;

export type RegraDeDesbloqueio =
  | { readonly all: readonly RegraDeDesbloqueio[] }
  | { readonly any: readonly RegraDeDesbloqueio[] }
  | CondicaoDeDesbloqueio;

/**
 * Schema da gramática.
 *
 * Recursivo, e por isso `z.lazy`. Vive aqui — no módulo que avalia a regra — e
 * é importado pelo schema de autoria em `content/`. Duas definições da mesma
 * gramática é como as duas passam a divergir, e a divergência apareceria como
 * conteúdo válido na autoria que o motor não entende em produção.
 */
export const regraDeDesbloqueioSchema: z.ZodType<RegraDeDesbloqueio> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(regraDeDesbloqueioSchema).min(1) }).strict(),
    z.object({ any: z.array(regraDeDesbloqueioSchema).min(1) }).strict(),
    z.object({ level: z.object({ gte: z.number().int().min(1) }).strict() }).strict(),
    z.object({ questCompleted: z.string().min(1).max(300) }).strict(),
    z
      .object({
        masteryAvg: z
          .object({
            skills: z.array(z.string().min(1)).min(1),
            gte: z.number().min(0).max(1),
          })
          .strict(),
      })
      .strict(),
  ]),
);

// ── O que falta ──────────────────────────────────────────────────────────────

export type Pendencia =
  | { readonly tipo: "NIVEL"; readonly exigido: number; readonly atual: number }
  | { readonly tipo: "MISSAO"; readonly ref: string }
  | {
      readonly tipo: "DOMINIO";
      readonly competencias: readonly string[];
      readonly exigido: number;
      readonly atual: number;
    };

export interface Jogabilidade {
  readonly jogavel: boolean;
  /** Vazio quando jogável. O caminho, quando não. */
  readonly pendencias: readonly Pendencia[];
}

const JOGAVEL: Jogabilidade = { jogavel: true, pendencias: [] };

export interface EstadoParaDesbloqueio {
  readonly nivel: number;
  /** Referências das missões que esta criança já concluiu. */
  readonly missoesConcluidas: ReadonlySet<string>;
  /** Slug do objetivo → probabilidade de domínio (`P(L)`). */
  readonly dominioPorCompetencia: ReadonlyMap<string, number>;
}

// ── Avaliação ────────────────────────────────────────────────────────────────

/**
 * Regra ausente é regra satisfeita.
 *
 * O padrão precisa ser "jogável": conteúdo autorado sem regra é a maioria do
 * acervo, e um padrão que travasse deixaria a criança sem nada para fazer por
 * causa de um campo não preenchido.
 */
export function avaliarDesbloqueio(
  regra: RegraDeDesbloqueio | null | undefined,
  estado: EstadoParaDesbloqueio,
): Jogabilidade {
  if (!regra) return JOGAVEL;

  if ("all" in regra) {
    const pendencias = regra.all.flatMap(
      (parte) => avaliarDesbloqueio(parte, estado).pendencias,
    );
    return pendencias.length === 0 ? JOGAVEL : { jogavel: false, pendencias };
  }

  if ("any" in regra) {
    const avaliadas = regra.any.map((parte) => avaliarDesbloqueio(parte, estado));
    if (avaliadas.some((a) => a.jogavel)) return JOGAVEL;

    /*
     * Nenhum caminho serve — então mostramos **um**, o que está mais perto.
     * Listar todos entregaria à criança uma lista de coisas que ela não precisa
     * fazer todas, e a leitura mais natural ("preciso de tudo isso?") é
     * justamente a errada.
     */
    const maisPerto = avaliadas.reduce((melhor, atual) =>
      atual.pendencias.length < melhor.pendencias.length ? atual : melhor,
    );
    return { jogavel: false, pendencias: maisPerto.pendencias };
  }

  if ("level" in regra) {
    return estado.nivel >= regra.level.gte
      ? JOGAVEL
      : {
          jogavel: false,
          pendencias: [{ tipo: "NIVEL", exigido: regra.level.gte, atual: estado.nivel }],
        };
  }

  if ("questCompleted" in regra) {
    return estado.missoesConcluidas.has(regra.questCompleted)
      ? JOGAVEL
      : { jogavel: false, pendencias: [{ tipo: "MISSAO", ref: regra.questCompleted }] };
  }

  const media = mediaDeDominio(regra.masteryAvg.skills, estado.dominioPorCompetencia);
  return media >= regra.masteryAvg.gte
    ? JOGAVEL
    : {
        jogavel: false,
        pendencias: [
          {
            tipo: "DOMINIO",
            competencias: regra.masteryAvg.skills,
            exigido: regra.masteryAvg.gte,
            atual: media,
          },
        ],
      };
}

/**
 * Média de domínio.
 *
 * Competência sem registro conta **zero**, e não é ignorada. Ignorar faria uma
 * criança que praticou uma das três competências exigidas parecer pronta pelas
 * três — e ela encararia o Colosso sem ter visto duas delas.
 */
function mediaDeDominio(
  competencias: readonly string[],
  dominio: ReadonlyMap<string, number>,
): number {
  if (competencias.length === 0) return 1;
  const soma = competencias.reduce((total, slug) => total + (dominio.get(slug) ?? 0), 0);
  return soma / competencias.length;
}

// ── Regra efetiva de uma missão ──────────────────────────────────────────────

/** Domínio médio que um Colosso cobra nas competências do capítulo (docs/08 §3). */
export const DOMINIO_DO_COLOSSO = 0.75;

/**
 * A regra declarada, mais a que o tipo da missão impõe.
 *
 * Um Colosso (`BOSS`) exige domínio médio nas `competenciasExigidas` **mesmo
 * sem regra escrita**. Deixar isso na mão de quem autora significaria que a
 * primeira missão de chefão sem o campo preenchido viraria um chefão de
 * enfeite — e a criança encararia o Guardião sem ter aprendido o que ele cobra.
 */
export function regraEfetiva(missao: {
  readonly tipo: string;
  readonly competenciasExigidas: readonly string[];
  readonly desbloqueio: RegraDeDesbloqueio | null;
}): RegraDeDesbloqueio | null {
  const doColosso: RegraDeDesbloqueio | null =
    missao.tipo === "BOSS" && missao.competenciasExigidas.length > 0
      ? {
          masteryAvg: {
            skills: missao.competenciasExigidas,
            gte: DOMINIO_DO_COLOSSO,
          },
        }
      : null;

  if (!doColosso) return missao.desbloqueio;
  if (!missao.desbloqueio) return doColosso;

  return { all: [missao.desbloqueio, doColosso] };
}
