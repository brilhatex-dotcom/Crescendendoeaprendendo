import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { identityDeps } from "@/composition/identity";
import { listarFamilia, resolverSessao, type PerfilDeCrianca } from "@/modules/identity";
import { lerTokenDeSessao } from "@/server/session";
import { Alert, Card } from "@/design-system/primitives";

import { AbrirAreaForm } from "./abrir-area-form";
import { CriarPerfilForm } from "./criar-perfil-form";
import { DefinirPinForm } from "./definir-pin-form";

export const metadata: Metadata = {
  title: "Minha família — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

/** Depende de sessão e de banco: nunca estática. */
export const dynamic = "force-dynamic";

const NOME_DA_FAIXA: Record<string, string> = {
  SPROUT: "A Semente · 6 a 8 anos",
  EXPLORER: "O Explorador · 9 a 12 anos",
  PIONEER: "O Pioneiro · 13 a 15 anos",
  VANGUARD: "A Vanguarda · 16 a 17 anos",
};

export default async function FamiliaPage() {
  const deps = identityDeps();
  const ator = await resolverSessao(deps, await lerTokenDeSessao());
  if (!ator) redirect("/entrar");

  // E-mail não verificado: a conta existe, mas nenhum dado de criança nasce
  // antes do consentimento parental estar provado (docs/09 §6).
  if (!ator.account.isEmailVerified) {
    return (
      <section>
        <h1 className="font-display text-3xl font-extrabold">Confirme seu e-mail</h1>
        <Alert tom="informacao" className="mt-6">
          Enviamos um link para <strong>{ator.account.email.masked}</strong>.
          Enquanto ele não for confirmado, não criamos nenhum perfil de criança.
        </Alert>
        <p className="mt-6 text-slate-300">
          <Link href="/verificar-email" className="underline underline-offset-4">
            Pedir um novo link
          </Link>
        </p>
      </section>
    );
  }

  const familia = await listarFamilia(deps, ator);
  const criancas: readonly PerfilDeCrianca[] = familia.ok ? familia.value : [];
  const temPin = ator.account.hasParentPin;
  const anoAtual = new Date().getUTCFullYear();

  return (
    <div className="flex flex-col gap-12">
      <section>
        <h1 className="font-display text-3xl font-extrabold">Minha família</h1>
        <p className="mt-3 text-slate-300">
          Cada criança tem um perfil dentro da sua conta. Nenhuma delas tem login
          próprio, senha ou contato com estranhos.
        </p>

        {criancas.length > 0 ? (
          <ul className="mt-8 flex flex-col gap-4">
            {criancas.map((crianca) => (
              <li key={crianca.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold">
                      {crianca.displayName}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {NOME_DA_FAIXA[crianca.ageBand] ?? crianca.ageBand}
                    </p>
                  </div>

                  {temPin ? (
                    <AbrirAreaForm
                      learnerId={crianca.id}
                      displayName={crianca.displayName}
                    />
                  ) : (
                    <p className="text-sm text-slate-400">
                      Defina o PIN abaixo para abrir a área infantil.
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Alert tom="informacao" className="mt-8">
            Você ainda não criou nenhum perfil. Comece pelo formulário abaixo.
          </Alert>
        )}
      </section>

      <section aria-labelledby="novo-perfil">
        <h2 id="novo-perfil" className="font-display text-2xl font-bold">
          Adicionar uma criança
        </h2>
        <Card className="mt-6">
          <CriarPerfilForm anoAtual={anoAtual} />
        </Card>
      </section>

      <section aria-labelledby="pin">
        <h2 id="pin" className="font-display text-2xl font-bold">
          {temPin ? "Trocar o PIN de responsável" : "Definir o PIN de responsável"}
        </h2>
        <p className="mt-3 text-slate-300">
          O PIN é pedido para <strong>sair</strong> da área infantil. É o que
          impede que a criança chegue sozinha a esta página enquanto brinca.
        </p>
        <Card className="mt-6">
          <DefinirPinForm jaTemPin={temPin} />
        </Card>
      </section>
    </div>
  );
}
