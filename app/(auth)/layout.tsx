import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Área de conta do adulto.
 *
 * Sem HUD, sem mascote, sem léxico do Arquipélago. Quem está aqui é um
 * responsável decidindo se confia dados de uma criança a este produto — a
 * linguagem é honesta e direta (Bíblia Cap. 9).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8 text-center">
        <Link
          href="/"
          className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]"
        >
          Crescendo e Aprendendo
        </Link>
      </header>

      <main>{children}</main>

      <footer className="mt-10 text-center text-sm text-slate-500">
        <Link href="/para-pais" className="underline-offset-4 hover:underline">
          Como protegemos os dados da sua família
        </Link>
      </footer>
    </div>
  );
}
