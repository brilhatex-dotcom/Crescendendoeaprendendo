import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { quadroDeConquistasDaCrianca } from "@/composition/achievement";
import { identityDeps } from "@/composition/identity";
import { listarFamilia, resolverSessao } from "@/modules/identity";
import { lerTokenDeSessao } from "@/server/session";

import { QuadroDeConquistas } from "./quadro";

export const metadata: Metadata = {
  title: "Suas conquistas — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * O quadro de conquistas da criança (Bíblia Vol. 1 Cap. 6 §6.15).
 *
 * Mesma regra do resto do produto: número real, nunca inventado. Ao contrário
 * da coleção de figurinhas, uma conquista **não oculta** o que falta por
 * padrão — mostra nome, descrição e progresso, porque o mesmo princípio de
 * `docs/08 §3` ("o mapa mostra o caminho, nunca só um cadeado") vale aqui.
 */
export default async function ConquistasPage() {
  const deps = identityDeps();
  const ator = await resolverSessao(deps, await lerTokenDeSessao());
  if (!ator?.activeLearnerId) redirect("/familia");

  const familia = await listarFamilia(deps, ator);
  const crianca = familia.ok
    ? familia.value.find((perfil) => perfil.id === ator.activeLearnerId)
    : undefined;
  if (!crianca) redirect("/familia");

  const conquistas = await quadroDeConquistasDaCrianca(crianca.id);

  return (
    <main
      data-age-band={crianca.ageBand}
      className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-8 px-6 py-12 text-center"
    >
      <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]">
        O Arquipélago Crescente
      </p>

      <h1 className="font-display text-4xl font-extrabold text-balance md:text-5xl">
        As conquistas de {crianca.displayName}
      </h1>

      <QuadroDeConquistas conquistas={conquistas} />

      <Link
        href="/hub"
        className="font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)] border-2 border-[var(--glass-border)] px-8 py-3 text-lg font-bold transition-colors duration-[var(--duration-quick)] hover:border-[var(--color-corrente)]"
      >
        Voltar para a base
      </Link>
    </main>
  );
}
