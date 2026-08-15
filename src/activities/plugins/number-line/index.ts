import type { ActivityPlugin } from "../../contracts";
import { evaluateNumberLine, probabilidadeDeChuteNumberLine } from "./evaluate";
import {
  numberLineAnswerSchema,
  numberLineConfigSchema,
  type NumberLineAnswer,
  type NumberLineConfig,
} from "./schema";

/** Plugin de reta numérica — a criança toca a posição do valor correto numa faixa de inteiros. */
export const numberLinePlugin: ActivityPlugin<NumberLineConfig, NumberLineAnswer> = {
  type: "NUMBER_LINE",
  configSchema: numberLineConfigSchema,
  answerSchema: numberLineAnswerSchema,
  evaluate: evaluateNumberLine,
  probabilidadeDeChute: probabilidadeDeChuteNumberLine,
  rendererId: "number-line",
};

export {
  numberLineConfigSchema,
  numberLineAnswerSchema,
  type NumberLineConfig,
  type NumberLineAnswer,
};
