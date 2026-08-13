import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { containerDeAvaliacao } from "@/composition/assessment";
import { identityDeps } from "@/composition/identity";
import { painelDaCrianca } from "@/composition/progression";
import { listarFamilia, resolverSessao } from "@/modules/identity";
import { lerTokenDeSessao } from "@/server/session";

import { Mapa } from "./mapa";
import { PainelDeProgresso } from "./painel-de-progresso";
import { SairDaAreaForm } from "./sair-da-area-form";

export const metadata: Metadata = {
  title: "Sua base — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A base da criança.
 *
 * O mapa agora vem do banco, não do disco — e com ele a regra de desbloqueio
 * de `docs/08 §3`: cada missão sabe dizer se pode ser jogada e, quando não
 * pode, **o que falta**. Os números são reais: a Luz foi creditada na mesma
 * transação da resposta que a gerou, e as Fagulhas têm lançamento em razão
 * contábil por trás.
 *
 * Isso importa mais do que parece. Nunca inventamos progresso para "encher a
 * tela" — mostrar número falso a uma criança ensina que os símbolos do produto
 * não significam nada, e é justamente o significado deles que faz o sistema
 * funcionar (Bíblia Cap. 6). Quem nunca jogou vê zero, e zero é a verdade.
 *
 * Léxico obrigatório (Bíblia Cap. 3 §3.5): aqui não existe "estudar",
 * "exercício" nem "pontos".
 */
export default async function HubPage() {
  const deps = identityDeps();
  const ator = await resolverSessao(deps, await lerTokenDeSessao());
  if (!ator?.activeLearnerId) redirect("/familia");

  const familia = await listarFamilia(deps, ator);
  const crianca = familia.ok
    ? familia.value.find((perfil) => perfil.id === ator.activeLearnerId)
    : undefined;
  if (!crianca) redirect("/familia");

  const { montarMapa } = containerDeAvaliacao();

  const [mundos, painel] = await Promise.all([
    montarMapa(crianca.id),
    painelDaCrianca(crianca.id),
  ]);

  return (
    <main
      data-age-band={crianca.ageBand}
      className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-8 px-6 py-12 text-center"
    >
      <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]">
        O Arquipélago Crescente
      </p>

      <h1 className="font-display text-4xl font-extrabold text-balance md:text-5xl">
        Oi, {crianca.displayName}.
        <br />
        <span className="bg-gradient-to-r from-[var(--color-aurora)] to-[var(--color-corrente)] bg-clip-text text-transparent">
          Esta base é sua.
        </span>
      </h1>

      <PainelDeProgresso progresso={painel.progresso} carteira={painel.carteira} />

      <Mapa mundos={mundos} />

      <Link
        href="/colecao"
        className="font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)] border-2 border-[var(--glass-border)] px-8 py-3 text-lg font-bold transition-colors duration-[var(--duration-quick)] hover:border-[var(--color-corrente)]"
      >
        Sua coleção
      </Link>

      <div className="mt-6 flex flex-col items-center gap-3">
        <SairDaAreaForm />
      </div>
    </main>
  );
}
