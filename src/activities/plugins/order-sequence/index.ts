import type { ActivityPlugin } from "../../contracts";
import {
  evaluateOrderSequence,
  probabilidadeDeChuteOrderSequence,
} from "./evaluate";
import {
  orderSequenceAnswerSchema,
  orderSequenceConfigSchema,
  type OrderSequenceAnswer,
  type OrderSequenceConfig,
} from "./schema";

export const orderSequencePlugin: ActivityPlugin<
  OrderSequenceConfig,
  OrderSequenceAnswer
> = {
  type: "ORDER_SEQUENCE",
  configSchema: orderSequenceConfigSchema,
  answerSchema: orderSequenceAnswerSchema,
  evaluate: evaluateOrderSequence,
  probabilidadeDeChute: probabilidadeDeChuteOrderSequence,
  rendererId: "order-sequence",
};

export {
  orderSequenceConfigSchema,
  orderSequenceAnswerSchema,
  type OrderSequenceConfig,
  type OrderSequenceAnswer,
};
