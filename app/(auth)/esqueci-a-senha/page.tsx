import type { Metadata } from "next";
import Link from "next/link";

import { EsqueciASenhaForm } from "./esqueci-a-senha-form";

export const metadata: Metadata = {
  title: "Esqueci minha senha — Crescendo e Aprendendo",
  robots: { index: false, follow: false },
};

export default function EsqueciASenhaPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-extrabold text-balance">
        Esqueci minha senha
      </h1>
      <p className="mt-3 mb-8 text-slate-300">
        Informe o e-mail da sua conta. Se ele estiver cadastrado, enviamos um
        link para você escolher uma senha nova.
      </p>

      <EsqueciASenhaForm />

      <p className="mt-8 text-center text-sm text-slate-400">
        Lembrou a senha?{" "}
        <Link href="/entrar" className="underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </section>
  );
}
