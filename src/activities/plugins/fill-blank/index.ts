import type { ActivityPlugin } from "../../contracts";
import { evaluateFillBlank, probabilidadeDeChuteFillBlank } from "./evaluate";
import {
  fillBlankAnswerSchema,
  fillBlankConfigSchema,
  MARCADOR_DE_LACUNA,
  type FillBlankAnswer,
  type FillBlankConfig,
} from "./schema";

/** Plugin de completar-a-lacuna — frase com espaço vazio, banco de palavras. */
export const fillBlankPlugin: ActivityPlugin<FillBlankConfig, FillBlankAnswer> = {
  type: "FILL_BLANK",
  configSchema: fillBlankConfigSchema,
  answerSchema: fillBlankAnswerSchema,
  evaluate: evaluateFillBlank,
  probabilidadeDeChute: probabilidadeDeChuteFillBlank,
  rendererId: "fill-blank",
};

export {
  fillBlankConfigSchema,
  fillBlankAnswerSchema,
  MARCADOR_DE_LACUNA,
  type FillBlankConfig,
  type FillBlankAnswer,
};
