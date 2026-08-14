import type { LayoutDoMapa } from "../domain/map-layout";
import { LAYOUT_VAZIO, layoutDoMapaSchema } from "../domain/map-layout";

/**
 * Layout guardado em `Json` → layout tipado.
 *
 * Validado **na leitura**, e não só na autoria — mesmo raciocínio de
 * `lerRegraDeDesbloqueio`. Layout irreconhecível ou vazio vira
 * `LAYOUT_VAZIO`, que significa **sem mapa desenhado ainda**: a tela cai de
 * volta na lista, nunca numa página quebrada.
 */
export function lerLayoutDoMapa(bruto: unknown): LayoutDoMapa {
  if (!bruto || typeof bruto !== "object") return LAYOUT_VAZIO;

  const analise = layoutDoMapaSchema.safeParse(bruto);
  if (analise.success) return analise.data;

  // Objeto vazio ({ nos: [] }) é o placeholder do importador — não é erro,
  // não precisa de log. Qualquer outra coisa irreconhecível merece aviso.
  const temNos = "nos" in bruto && Array.isArray((bruto as { nos?: unknown }).nos);
  if (!temNos || (bruto as { nos: unknown[] }).nos.length > 0) {
    console.warn("[quest] mapLayout irreconhecível, mundo cai na lista", { layout: bruto });
  }
  return LAYOUT_VAZIO;
}
