import type { ActivityPlugin } from "../../contracts";
import { evaluateTrueFalse, probabilidadeDeChuteTrueFalse } from "./evaluate";
import {
  trueFalseAnswerSchema,
  trueFalseConfigSchema,
  type TrueFalseAnswer,
  type TrueFalseConfig,
} from "./schema";

/** Plugin de verdadeiro-ou-falso. */
export const trueFalsePlugin: ActivityPlugin<TrueFalseConfig, TrueFalseAnswer> = {
  type: "TRUE_FALSE",
  configSchema: trueFalseConfigSchema,
  answerSchema: trueFalseAnswerSchema,
  evaluate: evaluateTrueFalse,
  probabilidadeDeChute: probabilidadeDeChuteTrueFalse,
  rendererId: "true-false",
};

export {
  trueFalseConfigSchema,
  trueFalseAnswerSchema,
  type TrueFalseConfig,
  type TrueFalseAnswer,
};
