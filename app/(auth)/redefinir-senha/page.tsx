import type { Metadata } from "next";
import Link from "next/link";

import { buttonStyles } from "@/design-system/primitives";

import { RedefinirSenhaForm } from "./redefinir-senha-form";

export const metadata: Metadata = {
  title: "Redefinir senha — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

/**
 * Cada visita depende do token da URL — nada aqui pode ser pré-renderizado.
 */
export const dynamic = "force-dynamic";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <section>
        <h1 className="font-display text-3xl font-extrabold">Link inválido</h1>
        <p className="mt-3 mb-8 text-slate-300">
          Este link de redefinição de senha está incompleto. Peça um novo.
        </p>
        <Link href="/esqueci-a-senha" className={buttonStyles()}>
          Pedir novo link
        </Link>
      </section>
    );
  }

  return (
    <section>
      <h1 className="font-display text-3xl font-extrabold text-balance">
        Escolha uma senha nova
      </h1>
      <p className="mt-3 mb-8 text-slate-300">
        Ao salvar, todas as sessões abertas desta conta são encerradas — você
        precisará entrar de novo com a senha nova.
      </p>

      <RedefinirSenhaForm token={token} />
    </section>
  );
}
