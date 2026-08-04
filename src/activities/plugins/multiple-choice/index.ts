import type { ActivityPlugin } from "../../contracts";
import {
  evaluateMultipleChoice,
  probabilidadeDeChuteMultipleChoice,
} from "./evaluate";
import {
  multipleChoiceAnswerSchema,
  multipleChoiceConfigSchema,
  type MultipleChoiceAnswer,
  type MultipleChoiceConfig,
} from "./schema";

/**
 * Plugin de múltipla escolha.
 *
 * Repare no tamanho deste arquivo: um plugin é uma declaração, não um módulo.
 * Toda a inteligência está no schema (o que pode ser autorado) e no evaluate
 * (como se corrige). É essa magreza que faz o 30º tipo de atividade custar o
 * mesmo que o 2º.
 */
export const multipleChoicePlugin: ActivityPlugin<
  MultipleChoiceConfig,
  MultipleChoiceAnswer
> = {
  type: "MULTIPLE_CHOICE",
  configSchema: multipleChoiceConfigSchema,
  answerSchema: multipleChoiceAnswerSchema,
  evaluate: evaluateMultipleChoice,
  probabilidadeDeChute: probabilidadeDeChuteMultipleChoice,
  rendererId: "multiple-choice",
};

export {
  multipleChoiceConfigSchema,
  multipleChoiceAnswerSchema,
  type MultipleChoiceConfig,
  type MultipleChoiceAnswer,
};
