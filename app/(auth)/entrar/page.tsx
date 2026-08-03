import type { Metadata } from "next";

import { EntrarForm } from "./entrar-form";

export const metadata: Metadata = {
  title: "Entrar — Crescendo e Aprendendo",
  description: "Acesse a conta do responsável.",
  robots: { index: false, follow: false },
};

export default function EntrarPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-extrabold">Entrar</h1>
      <p className="mt-3 mb-8 text-slate-300">
        Acesse com a conta do responsável.
      </p>

      <EntrarForm />
    </section>
  );
}
