import type { AttemptOutcome } from "./contracts";
import type { Premio } from "./rewards";

/**
 * REGISTRO DA TENTATIVA — o que o motor mede.
 *
 * Estes dados existem para três consumidores, nesta ordem de importância:
 *  1. a criança — que recebe conteúdo adequado porque o sistema sabe onde ela está;
 *  2. o responsável — que vê progresso real em vez de tempo de tela;
 *  3. a IA, depois — que personaliza a partir do que foi medido.
 *
 * ── A restrição que define a forma deste tipo ──
 * **Não existe `learnerId` aqui.** Telemetria usa `pseudonymId`, sempre
 * (docs/09 §6, teste de política de docs/08 §12.7). Se o campo existisse, um
 * dia alguém o preencheria — e dado de criança identificado sairia para o
 * provedor de IA. Tornar o campo inexpressável é mais forte que revisar código.
 */
export interface RegistroDeTentativa {
  /** Id pseudonimizado. Nunca o id real da criança. */
  readonly pseudonymId: string;
  readonly activityId: string;
  readonly activityType: string;
  readonly objectiveId: string;
  readonly questRunId: string | null;

  readonly outcome: AttemptOutcome;
  /** 0..1 — o quanto da resposta estava correta. */
  readonly scoreRatio: number;
  /** Tentativa número N nesta atividade, começando em 1. */
  readonly tentativa: number;
  readonly dicasUsadas: number;
  readonly duracaoMs: number;
  /** Código do equívoco, quando o plugin conseguiu diagnosticar. */
  readonly equivoco: string | null;

  readonly premio: Premio;
  /** Dificuldade calibrada da atividade no momento da tentativa. */
  readonly dificuldade: number;
  /** Habilidade estimada da criança no momento da tentativa (Elo). */
  readonly habilidadeAntes: number;

  readonly ocorridoEm: Date;
}

/**
 * Onde o registro é gravado.
 *
 * Porta, não implementação: em desenvolvimento pode ser o console, em produção
 * é `LearningEvent` + fila. O motor não sabe e não deve saber.
 */
export interface RegistradorDeTentativas {
  registrar(registro: RegistroDeTentativa): Promise<void>;
}

/**
 * Agregado por atividade, para calibrar dificuldade (docs/08 §2) e para o
 * relatório do responsável. Calculado, nunca digitado.
 */
export interface ResumoDaAtividade {
  readonly activityId: string;
  readonly tentativas: number;
  readonly acertos: number;
  readonly acertosDePrimeira: number;
  readonly duracaoMedianaMs: number;
  readonly dicasPorTentativa: number;
  /** Equívocos mais frequentes — é daqui que sai "o que a turma não entendeu". */
  readonly equivocosFrequentes: readonly { readonly codigo: string; readonly vezes: number }[];
}
