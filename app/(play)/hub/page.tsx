import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { identityDeps } from "@/composition/identity";
import { listarFamilia, resolverSessao } from "@/modules/identity";
import { lerTokenDeSessao } from "@/server/session";

import { SairDaAreaForm } from "./sair-da-area-form";

export const metadata: Metadata = {
  title: "Sua base — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A base da criança.
 *
 * Nesta etapa a base ainda não tem mapa, missão nem Fôlego — o motor de
 * atividades é da Etapa 1. O que existe aqui é real: a criança entrou com o
 * próprio perfil, é reconhecida pelo apelido dela, e só sai com o PIN do
 * responsável.
 *
 * Não inventamos números de Luz nem Fagulhas para "encher a tela". Mostrar
 * progresso falso a uma criança ensina que os símbolos do produto não
 * significam nada — e é justamente o significado deles que faz o sistema
 * funcionar depois (Bíblia Cap. 6).
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

      <p className="max-w-lg text-lg text-slate-300 text-pretty">
        As sete ilhas ainda estão acordando. Quando a primeira acender, ela vai
        estar esperando por você bem aqui.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <SairDaAreaForm />
      </div>
    </main>
  );
}
