import type { ActivityPlugin } from "../../contracts";
import { evaluateDragMatch, probabilidadeDeChuteDragMatch } from "./evaluate";
import {
  dragMatchAnswerSchema,
  dragMatchConfigSchema,
  type DragMatchAnswer,
  type DragMatchConfig,
} from "./schema";

export const dragMatchPlugin: ActivityPlugin<DragMatchConfig, DragMatchAnswer> = {
  type: "DRAG_MATCH",
  configSchema: dragMatchConfigSchema,
  answerSchema: dragMatchAnswerSchema,
  evaluate: evaluateDragMatch,
  probabilidadeDeChute: probabilidadeDeChuteDragMatch,
  rendererId: "drag-match",
};

export {
  dragMatchConfigSchema,
  dragMatchAnswerSchema,
  type DragMatchConfig,
  type DragMatchAnswer,
};
