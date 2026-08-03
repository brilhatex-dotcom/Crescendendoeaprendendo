import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Para pais e responsáveis",
  description:
    "O que acontece dentro da plataforma, quem fala com seu filho, que dados coletamos e como você acompanha a evolução dele.",
};

export const dynamic = "force-static";

/**
 * Página de confiança. As três perguntas do responsável, na ordem em que ele
 * as faz (Bíblia Vol. 1 Cap. 9 §9.2): está aprendendo? está seguro? está bem?
 */
const perguntas = [
  {
    pergunta: "Com quem meu filho fala aí dentro?",
    resposta:
      "Com ninguém, além do próprio companheiro — o Fagulha, que é a inteligência artificial da plataforma. Não existe chat, nem mensagem direta, nem perfil público, nem contato com outras crianças ou com adultos de fora. Toda conversa com o tutor fica gravada e visível para você, do começo ao fim.",
  },
  {
    pergunta: "Que dados vocês coletam?",
    resposta:
      "Um apelido e o ano de nascimento. Só isso. Sem nome completo obrigatório, sem documento, sem endereço, sem localização, sem lista de contatos, sem biometria. A inteligência artificial recebe um pseudônimo — ela não sabe quem é a criança.",
  },
  {
    pergunta: "Tem propaganda?",
    resposta:
      "Nenhuma, de ninguém, nunca. Nenhum script de terceiro roda na área da criança. Também não vendemos nem compartilhamos dados — nosso dinheiro vem da assinatura. Quem paga é você, então sua filha não precisa ser o produto.",
  },
  {
    pergunta: "Ela vai querer gastar dinheiro?",
    resposta:
      "Não tem como. Nenhuma tela infantil pede dinheiro, mostra preço em real ou sugere pedir compra a um adulto. As moedas do jogo não se compram — só se ganham jogando — e nada do que se compra com elas ajuda a aprender mais rápido. É tudo enfeite.",
  },
  {
    pergunta: "E o tempo de tela?",
    resposta:
      "Você define o limite diário e os horários. Quando o tempo acaba, a plataforma não bate a porta na cara dela: espera a atividade atual terminar, mostra o que ela conquistou hoje e sugere algo para fazer longe da tela. A briga em casa é sua, e a gente trabalha para diminuí-la.",
  },
  {
    pergunta: "Posso apagar tudo?",
    resposta:
      "Sim, de verdade, em até 30 dias, com confirmação por e-mail. Também pode exportar tudo em formato legível e revogar consentimentos item a item — sem perder o essencial do produto.",
  },
] as const;

export default function ParaPaisPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]">
        Para quem cuida
      </p>

      <h1 className="font-display mt-4 text-4xl leading-tight font-extrabold text-balance md:text-5xl">
        Você vai saber exatamente o que acontece aqui dentro.
      </h1>

      <p className="mt-6 text-lg text-slate-300 text-pretty">
        Você está entregando algo muito grande: o tempo e a cabeça do seu filho.
        Estas são as respostas que a gente daria se você perguntasse
        pessoalmente — sem rodeio e sem letra miúda.
      </p>

      <dl className="mt-14 space-y-10">
        {perguntas.map((item) => (
          <div key={item.pergunta}>
            <dt className="font-display text-xl font-bold text-[var(--color-fagulha)]">
              {item.pergunta}
            </dt>
            <dd className="mt-3 text-slate-300 text-pretty">{item.resposta}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-16 rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--color-play-raised)] p-8">
        <h2 className="font-display text-2xl font-bold">
          O que a gente devolve para você
        </h2>
        <p className="mt-3 text-slate-300 text-pretty">
          Um resumo por semana com quatro coisas: o que ela aprendeu, onde
          travou, quanto tempo ficou, e um momento bom da semana. Junto vai uma
          sugestão de dez minutos para fazer com ela — sem comprar nada, ligada
          ao que ela está aprendendo agora.
        </p>
        <p className="mt-4 text-slate-400">
          A plataforma não compete com a família. Ela devolve sua filha para
          você, com assunto novo.
        </p>
      </section>

      <div className="mt-14">
        <Link
          href="/"
          className="inline-flex min-h-[var(--touch-target-adult)] items-center justify-center rounded-[var(--radius-xl)] border border-[var(--glass-border)] px-8 py-4 text-slate-200 transition-colors duration-[var(--duration-quick)] hover:bg-white/5"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
