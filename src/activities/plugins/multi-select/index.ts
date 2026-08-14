import type { ActivityPlugin } from "../../contracts";
import { evaluateMultiSelect, probabilidadeDeChuteMultiSelect } from "./evaluate";
import {
  multiSelectAnswerSchema,
  multiSelectConfigSchema,
  type MultiSelectAnswer,
  type MultiSelectConfig,
} from "./schema";

/** Plugin de múltipla seleção — "toque em todos os que servem". */
export const multiSelectPlugin: ActivityPlugin<MultiSelectConfig, MultiSelectAnswer> = {
  type: "MULTI_SELECT",
  configSchema: multiSelectConfigSchema,
  answerSchema: multiSelectAnswerSchema,
  evaluate: evaluateMultiSelect,
  probabilidadeDeChute: probabilidadeDeChuteMultiSelect,
  rendererId: "multi-select",
};

export {
  multiSelectConfigSchema,
  multiSelectAnswerSchema,
  type MultiSelectConfig,
  type MultiSelectAnswer,
};
