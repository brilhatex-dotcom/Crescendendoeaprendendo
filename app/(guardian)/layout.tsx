import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { identityDeps } from "@/composition/identity";
import { resolverSessao } from "@/modules/identity";
import { sairAction } from "@/modules/identity/presentation/actions";
import { lerTokenDeSessao } from "@/server/session";
import { Button } from "@/design-system/primitives";

/**
 * Área do responsável — exige sessão adulta.
 *
 * A checagem vive aqui **e** dentro de cada caso de uso. Não é redundância
 * desperdiçada: o layout evita renderizar uma tela que o visitante não pode
 * ver, e a política no caso de uso é o que realmente protege o dado, porque
 * uma Server Action pode ser chamada sem passar por layout nenhum
 * (docs/09 §3).
 */
export default async function GuardianLayout({ children }: { children: ReactNode }) {
  const ator = await resolverSessao(identityDeps(), await lerTokenDeSessao());
  if (!ator) redirect("/entrar");

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-10">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Link
          href="/familia"
          className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]"
        >
          Crescendo e Aprendendo
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-400 sm:inline">
            {ator.account.name}
          </span>
          <form action={sairAction}>
            <Button type="submit" variante="fantasma" className="text-sm">
              Sair
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
