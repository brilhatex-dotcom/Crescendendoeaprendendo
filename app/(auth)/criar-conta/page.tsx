import type { Metadata } from "next";

import { CriarContaForm } from "./criar-conta-form";

export const metadata: Metadata = {
  title: "Criar conta — Crescendo e Aprendendo",
  description:
    "Crie a conta do responsável para acompanhar o que sua filha ou filho aprende no Arquipélago Crescente.",
  // Página de conta não pertence ao índice de busca.
  robots: { index: false, follow: false },
};

export default function CriarContaPage() {
  return (
    <section>
      <h1 className="font-display text-3xl font-extrabold text-balance">
        Criar conta de responsável
      </h1>
      <p className="mt-3 mb-8 text-slate-300">
        A conta é sua. A criança não tem login, não tem senha e não recebe
        mensagem de ninguém — ela entra pelo seu perfil.
      </p>

      <CriarContaForm />
    </section>
  );
}
