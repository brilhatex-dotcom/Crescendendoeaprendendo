import type { CriterioDeConquista } from "../domain/criteria";
import { criterioDeConquistaSchema } from "../domain/criteria";

/**
 * Critério guardado em `Json` → critério tipado.
 *
 * Mesmo raciocínio de `lerRegraDeDesbloqueio` (módulo quest) e
 * `lerLayoutDoMapa` (módulo quest): critério irreconhecível não trava nada,
 * só faz essa conquista ser ignorada na hora de avançar progresso — ela some
 * do avanço automático, mas continua existindo no catálogo (o dono corrige o
 * conteúdo e ela volta a evoluir no próximo evento).
 */
export function lerCriterioDeConquista(bruto: unknown): CriterioDeConquista | null {
  if (!bruto || typeof bruto !== "object") return null;

  const analise = criterioDeConquistaSchema.safeParse(bruto);
  if (analise.success) return analise.data;

  console.warn("[achievement] critério de conquista irreconhecível, ignorado", { criterio: bruto });
  return null;
}
