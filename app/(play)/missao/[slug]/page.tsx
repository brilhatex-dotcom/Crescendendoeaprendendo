import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { carregarMissaoParaSessao } from "@/activities/content-bridge";

import { MissaoRunner } from "./missao-runner";

export const metadata: Metadata = {
  title: "Missão — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

/**
 * Depende da sub-sessão de criança (checada no layout de `(play)`) e lê o
 * acervo do disco. Nunca estática.
 */
export const dynamic = "force-dynamic";

export default async function MissaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const missao = await carregarMissaoParaSessao(slug);

  if (!missao) notFound();

  return <MissaoRunner missao={missao} />;
}
