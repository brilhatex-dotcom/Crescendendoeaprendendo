import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Crescendo e Aprendendo — toda criança acende",
  description:
    "Uma aventura em sete ilhas onde a criança aprende Português, Matemática, lógica, dinheiro e habilidades para a vida — sem nunca sentir que está estudando.",
};

/** Renderizada estaticamente: SEO prioritário, custo zero (docs/01 §5). */
export const dynamic = "force-static";

const academias = [
  {
    nome: "Conhecimento",
    ilha: "Ilha das Mil Perguntas",
    guardia: "ORLA",
    resumo: "Português, Matemática, Ciências, História, Geografia — alinhado à BNCC.",
    gradiente: "from-[#4F46E5] to-[#22D3EE]",
  },
  {
    nome: "Inteligência",
    ilha: "Ilha dos Nós",
    guardia: "TRAMA",
    resumo: "Memória, atenção, lógica e estratégia. Sudoku, xadrez, labirintos.",
    gradiente: "from-[#7C5CFF] to-[#EC4899]",
  },
  {
    nome: "Prosperidade",
    ilha: "Ilha Pontal",
    guardia: "DONA CASTANHA",
    resumo: "Dinheiro, planejamento e consumo consciente — em ambiente simulado.",
    gradiente: "from-[#D97706] to-[#FBBF24]",
  },
  {
    nome: "Vida",
    ilha: "Ilha do Vilarejo",
    guardia: "DONA JUÁ",
    resumo: "Emoções, hábitos, comunicação e segurança digital.",
    gradiente: "from-[#10B981] to-[#84CC16]",
  },
  {
    nome: "Tecnologia",
    ilha: "Ilha Engrena",
    guardia: "PARAFUSA",
    resumo: "Programação, pensamento computacional e como a IA funciona.",
    gradiente: "from-[#06B6D4] to-[#3B82F6]",
  },
  {
    nome: "Criatividade",
    ilha: "Ilha Aquarela",
    guardia: "ÍRIS",
    resumo: "Desenho, música, escrita criativa e design.",
    gradiente: "from-[#FB923C] to-[#F472B6]",
  },
  {
    nome: "Descobertas",
    ilha: "Ilha Errante",
    guardia: "VENTANIA",
    resumo: "Projetos, experimentos e missões em família — fora da tela.",
    gradiente: "from-[#14B8A6] to-[#FDE047]",
  },
] as const;

const promessas = [
  {
    titulo: "Sem publicidade. Nunca.",
    texto:
      "Nenhum anúncio, nenhum patrocínio, nenhum rastreador de terceiro na área da criança. Quem paga é você — sua filha não é o produto.",
  },
  {
    titulo: "Sem chat com estranhos.",
    texto:
      "A criança não conversa com ninguém além do próprio companheiro. Sem mensagem, sem perfil público, sem contato de fora.",
  },
  {
    titulo: "Errar faz parte.",
    texto:
      "Nenhuma resposta é apenas “errado”. Todo erro vira uma explicação, uma dica e uma nova chance — e acertar depois de errar vale pontos.",
  },
  {
    titulo: "Você vê tudo.",
    texto:
      "O que ela aprendeu, onde travou, quanto tempo ficou e cada conversa com o tutor. Em uma tela, em trinta segundos.",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      {/* ── Herói ─────────────────────────────────────────────────────────── */}
      <section className="text-center">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]">
          O Arquipélago Crescente
        </p>

        <h1 className="font-display mt-4 text-4xl leading-tight font-extrabold text-balance md:text-6xl">
          Toda criança acende.
          <br />
          <span className="bg-gradient-to-r from-[var(--color-aurora)] to-[var(--color-corrente)] bg-clip-text text-transparent">
            É só ter quem pergunte junto.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 text-pretty">
          Um mundo de sete ilhas apagadas que voltam a ter cor a cada coisa que
          sua filha entende. Ela nunca sente que está estudando — mas aprende
          Português, Matemática, lógica, dinheiro e o resto de verdade.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/para-pais"
            className="font-display inline-flex min-h-[var(--touch-target-adult)] items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-aurora)] px-8 py-4 text-lg font-bold text-white shadow-[0_8px_24px_-6px_var(--academy-glow)] transition-transform duration-[var(--duration-quick)] ease-[var(--ease-aurora)] hover:scale-[1.03] active:scale-[0.98]"
          >
            Para pais e responsáveis
          </Link>

          <a
            href="#academias"
            className="inline-flex min-h-[var(--touch-target-adult)] items-center justify-center rounded-[var(--radius-xl)] border border-[var(--glass-border)] px-8 py-4 text-lg text-slate-200 transition-colors duration-[var(--duration-quick)] hover:bg-white/5"
          >
            Ver as sete ilhas
          </a>
        </div>
      </section>

      {/* ── As sete Academias ─────────────────────────────────────────────── */}
      <section className="mt-28" aria-labelledby="academias">
        <h2
          id="academias"
          className="font-display text-center text-3xl font-bold md:text-4xl"
        >
          Sete ilhas. Sete jeitos de perguntar.
        </h2>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {academias.map((academia) => (
            <li
              key={academia.nome}
              className="rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--color-play-raised)] p-6"
            >
              <div
                className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${academia.gradiente}`}
                aria-hidden="true"
              />
              <h3 className="font-display mt-4 text-xl font-bold">
                Academia da {academia.nome}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {academia.ilha} · guardiã {academia.guardia}
              </p>
              <p className="mt-3 text-slate-300">{academia.resumo}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Promessas aos responsáveis ────────────────────────────────────── */}
      <section className="mt-28" aria-labelledby="promessas">
        <h2
          id="promessas"
          className="font-display text-center text-3xl font-bold md:text-4xl"
        >
          O que prometemos a você
        </h2>

        <dl className="mt-12 grid gap-8 sm:grid-cols-2">
          {promessas.map((promessa) => (
            <div key={promessa.titulo}>
              <dt className="font-display text-lg font-bold text-[var(--color-fagulha)]">
                {promessa.titulo}
              </dt>
              <dd className="mt-2 text-slate-300">{promessa.texto}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="mt-28 border-t border-[var(--glass-border)] pt-8 text-center text-sm text-slate-500">
        <p>
          Crescendo e Aprendendo · feito para crianças de 6 a 12 anos, com
          arquitetura preparada até os 17.
        </p>
      </footer>
    </main>
  );
}
