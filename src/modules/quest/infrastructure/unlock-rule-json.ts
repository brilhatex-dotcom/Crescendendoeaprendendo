import type { RegraDeDesbloqueio } from "../domain/unlock-rule";
import { regraDeDesbloqueioSchema } from "../domain/unlock-rule";

/**
 * Regra guardada em `Json` → regra tipada.
 *
 * Validada **na leitura**, e não só na autoria. Conteúdo antigo com formato
 * defasado existe, e o custo de não validar aqui é a criança encontrar um
 * cadeado que o motor não sabe abrir.
 *
 * Regra irreconhecível vira `null`, que significa **jogável**. Na dúvida entre
 * travar e liberar, liberar erra menos: um conteúdo liberado cedo demais custa
 * uma missão fora de hora; um travado por engano custa uma criança parada sem
 * saber por quê, e sem ninguém para perguntar.
 */
export function lerRegraDeDesbloqueio(bruta: unknown): RegraDeDesbloqueio | null {
  if (!bruta || typeof bruta !== "object" || Object.keys(bruta).length === 0) return null;

  const analise = regraDeDesbloqueioSchema.safeParse(bruta);
  if (analise.success) return analise.data;

  console.warn("[quest] regra de desbloqueio irreconhecível, missão liberada", {
    regra: bruta,
  });
  return null;
}
