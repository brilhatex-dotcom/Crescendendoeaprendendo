import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { identityDeps } from "@/composition/identity";
import { resolverSessao } from "@/modules/identity";
import { lerSubSessaoDeCrianca, lerTokenDeSessao } from "@/server/session";

/**
 * Área da criança.
 *
 * A guarda aqui tem três perguntas, e as três precisam responder sim:
 *
 * 1. existe sessão adulta válida?
 * 2. o cookie de sub-sessão está assinado, dentro do prazo de 4h e amarrado a
 *    **esta** sessão adulta?
 * 3. o `activeLearnerId` no banco confirma essa mesma criança?
 *
 * A terceira é o que faz "trocar de criança" e "sair" surtirem efeito na hora,
 * mesmo com um cookie antigo ainda no navegador: o cookie sozinho não basta.
 *
 * Nenhum script de terceiro roda aqui. Sem analytics, sem publicidade, sem
 * rastreador — regra absoluta de docs/09 §6.
 */
export default async function PlayLayout({ children }: { children: ReactNode }) {
  const deps = identityDeps();
  const ator = await resolverSessao(deps, await lerTokenDeSessao());
  if (!ator) redirect("/entrar");

  const learnerIdDoCookie = await lerSubSessaoDeCrianca(
    ator.sessionId,
    deps.clock.now(),
  );

  if (!learnerIdDoCookie || learnerIdDoCookie !== ator.activeLearnerId) {
    redirect("/familia");
  }

  return <div className="min-h-dvh">{children}</div>;
}
