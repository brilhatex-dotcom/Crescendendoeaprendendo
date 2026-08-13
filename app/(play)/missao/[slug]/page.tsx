import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { carregarMissaoParaSessao } from "@/activities/content-bridge";
import { identityDeps } from "@/composition/identity";
import { resolverSessao } from "@/modules/identity";
import { lerTokenDeSessao } from "@/server/session";

import { MissaoRunner } from "./missao-runner";

export const metadata: Metadata = {
  title: "Missão — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

/**
 * Depende da sub-sessão de criança (checada no layout de `(play)`) e lê o
 * acervo do disco e o banco. Nunca estática.
 */
export const dynamic = "force-dynamic";

export default async function MissaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /*
   * O layout de `(play)` já garantiu que a sub-sessão existe; relemos aqui
   * pelo mesmo motivo de `/hub` — cada página resolve a própria sessão. O
   * `learnerId` importa além de autorização: é o que permite ao bridge
   * completar um slot dinâmico já resolvido (docs/08 §7) antes de entregar a
   * lista de atividades ao cliente.
   */
  const deps = identityDeps();
  const ator = await resolverSessao(deps, await lerTokenDeSessao());
  if (!ator?.activeLearnerId) redirect("/familia");

  const missao = await carregarMissaoParaSessao(slug, ator.activeLearnerId);

  if (!missao) notFound();

  return <MissaoRunner missao={missao} />;
}
