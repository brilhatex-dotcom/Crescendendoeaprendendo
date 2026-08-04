import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listarMissoes } from "@/activities/content-bridge";

import { identityDeps } from "@/composition/identity";
import { painelDaCrianca } from "@/composition/progression";
import { listarFamilia, resolverSessao } from "@/modules/identity";
import { lerTokenDeSessao } from "@/server/session";

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
 * A base ainda não tem mapa do mundo, mas os números agora são reais: a Luz que
 * aparece aqui foi creditada na mesma transação da resposta que a gerou, e as
 * Fagulhas têm lançamento em razão contábil por trás.
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

  const [missoes, painel] = await Promise.all([
    listarMissoes(),
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

      {missoes.length > 0 ? (
        <>
          <p className="max-w-lg text-lg text-slate-300 text-pretty">
            A Ilha das Mil Perguntas está acordando. ORLA precisa de ajuda.
          </p>

          <ul className="flex w-full max-w-md flex-col gap-3">
            {missoes.map((missao) => (
              <li key={missao.slug}>
                <Link
                  /*
                   * `typedRoutes` valida rota literal em tempo de compilação; o
                   * slug aqui vem do acervo, que é dado. A conversão é o escape
                   * previsto para rota dinâmica — e o `notFound()` da página de
                   * missão é quem trata slug que não existe.
                   */
                  href={`/missao/${missao.slug}` as Route}
                  className="flex min-h-[var(--touch-target-play)] items-center justify-between gap-4 rounded-[var(--radius-lg)] border-2 border-[var(--glass-border)] bg-[var(--color-play-raised)] px-6 py-4 text-left transition-colors duration-[var(--duration-quick)] hover:border-[var(--color-corrente)]"
                >
                  <span className="font-display text-lg font-bold">{missao.nome}</span>
                  <span className="text-sm text-slate-400">
                    {missao.atividades} desafios
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="max-w-lg text-lg text-slate-300 text-pretty">
          As sete ilhas ainda estão acordando. Quando a primeira acender, ela vai
          estar esperando por você bem aqui.
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <SairDaAreaForm />
      </div>
    </main>
  );
}
