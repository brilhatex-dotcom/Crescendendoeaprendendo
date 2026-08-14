import type { SealedPlugin } from "../contracts";
import { selar } from "../registry";
import { dragMatchPlugin } from "./drag-match";
import { fillBlankPlugin } from "./fill-blank";
import { multipleChoicePlugin } from "./multiple-choice";
import { multiSelectPlugin } from "./multi-select";
import { orderSequencePlugin } from "./order-sequence";
import { trueFalsePlugin } from "./true-false";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MANIFESTO DE PLUGINS
 *
 *  Este é o ÚNICO arquivo que muda quando um tipo novo de atividade nasce.
 *  Duas linhas: o import e a entrada na lista.
 *
 *  O núcleo do motor (`contracts.ts`, `registry.ts`) não muda. Nunca mudou
 *  desde que foi escrito, e a prova disso é que `ORDER_SEQUENCE` — que tem
 *  resposta em lista e crédito parcial, nada parecido com múltipla escolha —
 *  entrou sem tocar em uma vírgula dele.
 *
 *  ── Por que um manifesto e não descoberta automática ──
 *  Varrer a pasta por `import.meta.glob` pareceria mais "automático", mas
 *  quebra o *tree-shaking* (todo plugin entra no bundle mesmo sem uso), é
 *  frágil entre bundlers, e transforma um erro de nome de pasta em um tipo que
 *  simplesmente não existe em produção, sem aviso. Uma linha explícita custa
 *  cinco segundos e é verificável em revisão de código.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const PLUGINS_REGISTRADOS: readonly SealedPlugin[] = [
  selar(multipleChoicePlugin),
  selar(orderSequencePlugin),
  selar(dragMatchPlugin),
  selar(multiSelectPlugin),
  selar(trueFalsePlugin),
  selar(fillBlankPlugin),
];

export { multipleChoicePlugin } from "./multiple-choice";
export { orderSequencePlugin } from "./order-sequence";
export { dragMatchPlugin } from "./drag-match";
export { multiSelectPlugin } from "./multi-select";
export { trueFalsePlugin } from "./true-false";
export { fillBlankPlugin } from "./fill-blank";
