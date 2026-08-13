import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { galeriaDaCrianca } from "@/composition/collection";
import { identityDeps } from "@/composition/identity";
import { listarFamilia, resolverSessao } from "@/modules/identity";
import { lerTokenDeSessao } from "@/server/session";

import { Galeria } from "./galeria";

export const metadata: Metadata = {
  title: "Sua coleção — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * O álbum de figurinhas da criança.
 *
 * Mesma regra do resto do produto: número real, nunca inventado (docs/06 —
 * ver `hub/page.tsx`). Quem nunca ganhou figurinha nenhuma vê o álbum vazio
 * de verdade, não um álbum fingido para "encher a tela".
 */
export default async function ColecaoPage() {
  const deps = identityDeps();
  const ator = await resolverSessao(deps, await lerTokenDeSessao());
  if (!ator?.activeLearnerId) redirect("/familia");

  const familia = await listarFamilia(deps, ator);
  const crianca = familia.ok
    ? familia.value.find((perfil) => perfil.id === ator.activeLearnerId)
    : undefined;
  if (!crianca) redirect("/familia");

  const figurinhas = await galeriaDaCrianca(crianca.id);

  return (
    <main
      data-age-band={crianca.ageBand}
      className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-8 px-6 py-12 text-center"
    >
      <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]">
        O Arquipélago Crescente
      </p>

      <h1 className="font-display text-4xl font-extrabold text-balance md:text-5xl">
        A coleção de {crianca.displayName}
      </h1>

      <Galeria figurinhas={figurinhas} />

      <Link
        href="/hub"
        className="font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)] border-2 border-[var(--glass-border)] px-8 py-3 text-lg font-bold transition-colors duration-[var(--duration-quick)] hover:border-[var(--color-corrente)]"
      >
        Voltar para a base
      </Link>
    </main>
  );
}
