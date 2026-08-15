import type { ActivityPlugin } from "../../contracts";
import { evaluateWordBuild, probabilidadeDeChuteWordBuild } from "./evaluate";
import {
  wordBuildAnswerSchema,
  wordBuildConfigSchema,
  type WordBuildAnswer,
  type WordBuildConfig,
} from "./schema";

/** Plugin de montar-a-palavra — banco de letras/sílabas (com iscas opcionais), sequência montada por toque. */
export const wordBuildPlugin: ActivityPlugin<WordBuildConfig, WordBuildAnswer> = {
  type: "WORD_BUILD",
  configSchema: wordBuildConfigSchema,
  answerSchema: wordBuildAnswerSchema,
  evaluate: evaluateWordBuild,
  probabilidadeDeChute: probabilidadeDeChuteWordBuild,
  rendererId: "word-build",
};

export {
  wordBuildConfigSchema,
  wordBuildAnswerSchema,
  type WordBuildConfig,
  type WordBuildAnswer,
};
