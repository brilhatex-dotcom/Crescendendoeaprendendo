import type { Route } from "next";
import Link from "next/link";

import type { MissaoDoMapa, MundoDoMapa, Pendencia } from "@/modules/quest";
import { cn } from "@/design-system/utils/cn";

/**
 * O MAPA — o arquipélago como a criança o vê.
 *
 * ── A regra que define esta tela ──
 * `docs/08 §3`: **o mapa mostra o caminho, nunca só um cadeado.** Uma missão
 * que ela ainda não pode jogar aparece com o que falta escrito por extenso —
 * "Termine A Contagem da Orla", "Chegue ao nível 12" —, porque um cadeado sem
 * explicação é uma parede sem porta: a criança não sabe o que fazer e conclui
 * que o jogo decidiu que ela não pode.
 *
 * As frases nascem aqui, e não no domínio. O domínio diz *o que* falta; esta
 * camada sabe para quem está falando, e é ela que conhece o léxico
 * (Bíblia Cap. 3 §3.5) e a idade de quem lê.
 *
 * Componente de servidor: só recebe dados e desenha.
 */
export function Mapa({ mundos }: { mundos: readonly MundoDoMapa[] }) {
  const comConteudo = mundos.filter((mundo) =>
    mundo.capitulos.some((capitulo) => capitulo.missoes.length > 0),
  );

  if (comConteudo.length === 0) {
    return (
      <p className="max-w-lg text-lg text-slate-300 text-pretty">
        As sete ilhas ainda estão acordando. Quando a primeira acender, ela vai
        estar esperando por você bem aqui.
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      {comConteudo.map((mundo) => (
        <section key={mundo.slug} className="flex flex-col gap-4">
          <header className="text-left">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-corrente)]">
              {mundo.academia}
            </p>
            <h2 className="font-display text-xl font-bold">{mundo.nome}</h2>
            {!mundo.disponivel ? (
              <p className="mt-1 text-sm text-slate-400">
                Esta ilha acende no nível {mundo.nivelMinimo}.
              </p>
            ) : null}
          </header>

          {mundo.capitulos.map((capitulo) => (
            <div key={capitulo.nome} className="flex flex-col gap-3">
              {/*
                O nome do capítulo só aparece quando há mais de um. Com um só,
                ele repetiria o nome da ilha e ocuparia espaço sem informar.
              */}
              {mundo.capitulos.length > 1 ? (
                <h3 className="text-left text-sm font-semibold text-slate-300">
                  {capitulo.nome}
                </h3>
              ) : null}

              <ul className="flex flex-col gap-3">
                {capitulo.missoes.map((missao) => (
                  <li key={missao.ref}>
                    <CartaoDaMissao missao={missao} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function CartaoDaMissao({ missao }: { missao: MissaoDoMapa }) {
  const jogavel = missao.jogabilidade.jogavel;

  const corpo = (
    <>
      <div className="flex flex-col gap-1 text-left">
        <span className="font-display text-lg font-bold">{missao.nome}</span>
        <span className="text-sm text-slate-400">
          {missao.atividades} {missao.atividades === 1 ? "desafio" : "desafios"}
          {missao.emAndamento ? " · você parou no meio" : ""}
          {!missao.emAndamento && missao.concluida ? " · já concluída" : ""}
        </span>
      </div>

      {/*
        O caminho, e não um cadeado. Cada pendência vira uma frase que diz o
        que fazer — é a diferença entre "você não pode" e "falta isto".
      */}
      {!jogavel ? (
        <ul className="mt-3 flex flex-col gap-1 text-left text-sm text-[var(--color-quase)]">
          {missao.jogabilidade.pendencias.map((pendencia, indice) => (
            <li key={indice}>{descrever(pendencia)}</li>
          ))}
        </ul>
      ) : null}
    </>
  );

  const estilo = cn(
    "flex min-h-[var(--touch-target-play)] w-full flex-col justify-center rounded-[var(--radius-lg)] border-2 px-6 py-4",
    jogavel
      ? "border-[var(--glass-border)] bg-[var(--color-play-raised)] transition-colors duration-[var(--duration-quick)] hover:border-[var(--color-corrente)]"
      : "border-dashed border-[var(--glass-border)] bg-transparent",
  );

  if (!jogavel) {
    /*
     * Sem link, e sem `disabled`: não é um botão quebrado, é um lugar que
     * ainda não abriu. A leitura por leitor de tela precisa dizer isso, e é o
     * que `aria-disabled` com o texto do caminho junto entrega.
     */
    return (
      <div aria-disabled className={estilo}>
        {corpo}
      </div>
    );
  }

  return (
    <Link
      /*
       * `typedRoutes` valida rota literal em tempo de compilação; o slug vem do
       * banco, que é dado. A conversão é o escape previsto para rota dinâmica.
       */
      href={`/missao/${missao.slug}` as Route}
      className={estilo}
    >
      {corpo}
    </Link>
  );
}

/**
 * Pendência → frase.
 *
 * Sem números de domínio na tela: "0.42 de 0.75" não significa nada para quem
 * tem sete anos, e o que ela precisa saber é o que **fazer**, não o quanto o
 * modelo acredita nela.
 */
function descrever(pendencia: Pendencia): string {
  switch (pendencia.tipo) {
    case "NIVEL":
      return `Chegue ao nível ${pendencia.exigido} — você está no ${pendencia.atual}.`;
    case "MISSAO":
      return `Termine antes: ${nomeLegivel(pendencia.ref)}.`;
    case "DOMINIO":
      return pendencia.competencias.length === 1
        ? `Treine mais um pouco: ${nomeLegivel(pendencia.competencias[0] ?? "")}.`
        : `Treine mais um pouco: ${pendencia.competencias.map(nomeLegivel).join(", ")}.`;
  }
}

/** `contar-ate-10` → "contar ate 10". Slug de arquivo não é texto de criança. */
function nomeLegivel(referencia: string): string {
  const ultimo = referencia.slice(referencia.lastIndexOf("/") + 1);
  return ultimo.replace(/-/g, " ");
}
