import type { PlanoDeImportacao } from "../domain/plan";

/**
 * Porta de escrita do acervo.
 *
 * A camada de aplicação conhece esta interface; quem a implementa com Prisma
 * vive em `infrastructure/`. É o que permite testar o caso de uso com um dublê
 * e provar a regra sem subir Postgres.
 */
export interface EscritorDeConteudo {
  /**
   * Grava o plano inteiro. **Precisa ser idempotente**: rodar duas vezes com o
   * mesmo plano tem que deixar o banco no mesmo estado, sem duplicar linha.
   *
   * `Attempt` referencia `Activity.id` — duplicar atividade quebraria o
   * histórico de quem já jogou.
   */
  gravar(plano: PlanoDeImportacao): Promise<ResumoDaEscrita>;
}

export interface ResumoDaEscrita {
  readonly academias: number;
  readonly disciplinas: number;
  readonly eixos: number;
  readonly competencias: number;
  readonly objetivos: number;
  readonly preRequisitos: number;
  readonly mundos: number;
  readonly capitulos: number;
  readonly missoes: number;
  readonly fases: number;
  readonly atividades: number;
  readonly vinculos: number;
}

export const RESUMO_VAZIO: ResumoDaEscrita = {
  academias: 0,
  disciplinas: 0,
  eixos: 0,
  competencias: 0,
  objetivos: 0,
  preRequisitos: 0,
  mundos: 0,
  capitulos: 0,
  missoes: 0,
  fases: 0,
  atividades: 0,
  vinculos: 0,
};
