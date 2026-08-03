import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";

import { identityDeps } from "@/composition/identity";
import { verificarEmail } from "@/modules/identity";
import { Alert, buttonStyles } from "@/design-system/primitives";

import { ReenviarForm } from "./reenviar-form";

export const metadata: Metadata = {
  title: "Confirmar e-mail — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

/**
 * Esta rota nunca pode ser cacheada nem pré-renderizada: cada visita consome um
 * token de uso único e depende do banco.
 */
export const dynamic = "force-dynamic";

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Sem token na URL: quem chegou aqui quer um link novo.
  if (!token) {
    return (
      <section>
        <h1 className="font-display text-3xl font-extrabold">Confirmar e-mail</h1>
        <p className="mt-3 mb-8 text-slate-300">
          Enquanto o e-mail não estiver confirmado, você pode entrar na conta,
          mas ainda não criar o perfil de uma criança. Informe seu e-mail para
          receber um novo link.
        </p>
        <ReenviarForm />
      </section>
    );
  }

  const resultado = await verificarEmail(identityDeps(), token, {
    traceId: randomUUID(),
    ipHash: null,
    userAgent: null,
  });

  if (!resultado.ok) {
    return (
      <section>
        <h1 className="font-display text-3xl font-extrabold">Link expirado</h1>
        <Alert tom="erro" className="mt-6">
          {resultado.error.message}
        </Alert>
        <p className="mt-6 mb-6 text-slate-300">
          Links de confirmação valem por 24 horas e só podem ser usados uma vez.
          Peça um novo abaixo.
        </p>
        <ReenviarForm />
      </section>
    );
  }

  return (
    <section>
      <h1 className="font-display text-3xl font-extrabold">
        Tudo certo, {resultado.value.nome.split(" ")[0]}.
      </h1>
      <p className="mt-3 mb-8 text-slate-300">
        Seu e-mail está confirmado. Agora você pode criar o perfil da criança e
        definir o PIN que protege a saída da área infantil.
      </p>

      <Link href="/familia" className={buttonStyles()}>
        Ir para a minha família
      </Link>
    </section>
  );
}
