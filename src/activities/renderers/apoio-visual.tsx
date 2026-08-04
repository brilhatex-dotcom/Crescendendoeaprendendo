import { cn } from "@/design-system/utils/cn";

import type { ApoioVisual, GrupoDeObjetos } from "../stimulus";

/**
 * A CENA — o que a criança olha para responder.
 *
 * ── A decisão de acessibilidade que define este componente ──
 * Cada objeto é anunciado **individualmente** pelo leitor de tela: "concha,
 * concha, concha, concha". Uma criança cega conta navegando de um para o
 * outro, exatamente como uma criança que enxerga conta com o dedo.
 *
 * O que **não** fazemos, e por quê:
 *
 * · não usamos `<ul>` — a maioria dos leitores anuncia "lista com 4 itens" ao
 *   entrar, e numa atividade de contagem isso é a resposta de graça;
 * · não pomos o número no rótulo do grupo ("quatro conchas"), pelo mesmo motivo;
 * · não escondemos os objetos com `aria-hidden`, que resolveria o vazamento e
 *   tornaria a atividade impossível — que é justamente o defeito que este
 *   componente veio corrigir.
 *
 * Sobra uma cena que dá para contar dos dois jeitos, sem entregar a conta.
 */
export function ApoioVisualDaAtividade({ apoio }: { apoio: ApoioVisual }) {
  if (apoio.tipo === "imagem") {
    /*
     * Imagem por `assetId` depende de upload para o Blob. Enquanto o pipeline
     * de mídia não existir, declarar o tipo e não desenhar nada seria repetir o
     * defeito original — então a alternativa textual aparece na tela, para
     * todo mundo. Texto que descreve a cena é pior que a cena, e é infinitamente
     * melhor que uma pergunta sem resposta.
     */
    return (
      <figure className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--glass-border)] bg-white/5 px-6 py-5">
        <figcaption className="text-center text-lg text-slate-200">
          {apoio.textoAlternativo}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="flex flex-col gap-4 rounded-[var(--radius-lg)] border-2 border-[var(--glass-border)] bg-gradient-to-b from-white/10 to-white/[0.02] px-5 py-6">
      {apoio.legenda ? (
        <figcaption className="text-center text-sm uppercase tracking-[0.15em] text-slate-400">
          {apoio.legenda}
        </figcaption>
      ) : null}

      {apoio.grupos.map((grupo, indice) => (
        <Grupo key={indice} grupo={grupo} comparando={apoio.grupos.length > 1} />
      ))}
    </figure>
  );
}

function Grupo({
  grupo,
  comparando,
}: {
  grupo: GrupoDeObjetos;
  /** `true` quando há mais de um grupo na cena. Muda o alinhamento — ver abaixo. */
  comparando: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {comparando && grupo.rotulo ? (
        <span className="text-sm text-slate-300">{grupo.rotulo}</span>
      ) : null}

      <div
        role="group"
        aria-label={grupo.rotulo ?? grupo.nome}
        /*
         * O alinhamento muda com a tarefa, e não é detalhe:
         *
         * · comparando dois grupos, `start` mantém as colunas casadas — é
         *   exatamente o que a dica da atividade pede ("junte uma concha com
         *   uma pedrinha, veja o que sobra"). Centralizar desmancharia o
         *   pareamento visual e tiraria da criança o jeito mais fácil de ver;
         * · com um grupo só, contar é a tarefa inteira, e a cena centrada é a
         *   que ocupa o lugar de assunto principal da tela.
         */
        className={cn(
          "flex flex-wrap gap-x-3 gap-y-2 leading-tight",
          comparando
            ? "justify-start text-4xl md:text-5xl"
            : "justify-center py-2 text-5xl md:text-6xl",
        )}
      >
        {Array.from({ length: grupo.quantidade }, (_, i) => (
          <span key={i} role="img" aria-label={grupo.nome} className="select-none">
            {grupo.simbolo}
          </span>
        ))}
      </div>
    </div>
  );
}
