import type { RegraDeSlot } from "../domain/slot-rule";
import { regraDeSlotSchema } from "../domain/slot-rule";

/**
 * Regra de slot guardada em `Json` → regra tipada.
 *
 * Espelha `lerRegraDeDesbloqueio`, mas a direção do erro é a oposta: lá,
 * regra irreconhecível libera a missão; aqui, slot irreconhecível **não pode
 * ser preenchido** — não há nada seguro para inventar no lugar de "qual
 * objetivo?". O slot some da missão (`mesclarAtividades` o descarta), o mesmo
 * destino de sempre para um slot sem `activityId` conhecido.
 */
export function lerRegraDeSlot(bruta: unknown): RegraDeSlot | null {
  if (!bruta || typeof bruta !== "object" || Object.keys(bruta).length === 0) return null;

  const analise = regraDeSlotSchema.safeParse(bruta);
  if (analise.success) return analise.data;

  console.warn("[quest] regra de slot irreconhecível, slot descartado", { regra: bruta });
  return null;
}
