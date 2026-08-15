import type { ActivityPlugin } from "../../contracts";
import { evaluateMemoryPairs, probabilidadeDeChuteMemoryPairs } from "./evaluate";
import {
  memoryPairsAnswerSchema,
  memoryPairsConfigSchema,
  type MemoryPairsAnswer,
  type MemoryPairsConfig,
} from "./schema";

/** Plugin de jogo da memória — a criança vira cartas duas a duas até achar todos os pares. */
export const memoryPairsPlugin: ActivityPlugin<MemoryPairsConfig, MemoryPairsAnswer> = {
  type: "MEMORY_PAIRS",
  configSchema: memoryPairsConfigSchema,
  answerSchema: memoryPairsAnswerSchema,
  evaluate: evaluateMemoryPairs,
  probabilidadeDeChute: probabilidadeDeChuteMemoryPairs,
  rendererId: "memory-pairs",
};

export {
  memoryPairsConfigSchema,
  memoryPairsAnswerSchema,
  type MemoryPairsConfig,
  type MemoryPairsAnswer,
};
