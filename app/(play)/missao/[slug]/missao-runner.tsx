"use client";

import { useState, useTransition } from "react";

import {
  atividadeEm,
  indiceAbsoluto,
  primeiraPosicao,
  proximaPosicao,
  totalDeAtividades,
  type EvaluationResult,
  type MissaoNaSessao,
  type PosicaoNaMissao,
  type Premio,
} from "@/activities";
import { obterRenderer } from "@/activities/renderers";
import { cn } from "@/design-system/utils/cn";

import { responderAtividadeAction } from "./actions";

/**
 * EXECUTOR DE MISSÃO.
 *
 * Repare no que este componente **não** sabe: o que é múltipla escolha, o que é
 * ordenação, como se corrige qualquer coisa. Ele conhece o formato de uma
 * atividade e o formato de uma devolutiva. É por isso que o 30º tipo não vai
 * exigir uma linha aqui.
 */
export function MissaoRunner({ missao }: { missao: MissaoNaSessao }) {
  const [posicao, setPosicao] = useState<PosicaoNaMissao>(primeiraPosicao);
  const [resultado, setResultado] = useState<EvaluationResult | undefined>();
  const [premio, setPremio] = useState<Premio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(1);
  const [terminou, setTerminou] = useState(false);
  const [inicioMs, setInicioMs] = useState(() => Date.now());
  const [pendente, iniciarTransicao] = useTransition();

  const atividade = atividadeEm(missao, posicao);
  const total = totalDeAtividades(missao);
  const numero = indiceAbsoluto(missao, posicao) + 1;

  if (terminou) {
    return <TelaFinal missao={missao} />;
  }

  if (!atividade) {
    return <TelaFinal missao={missao} />;
  }

  const Renderer = obterRenderer(rendererDoTipo(atividade.tipo));

  function responder(resposta: unknown): void {
    if (!atividade) return;
    setErro(null);

    const dados = new FormData();
    dados.set("missaoSlug", missao.slug);
    dados.set("atividadeSlug", atividade.slug);
    dados.set("resposta", JSON.stringify(resposta));
    dados.set("tentativa", String(tentativa));
    dados.set("duracaoMs", String(Date.now() - inicioMs));

    iniciarTransicao(async () => {
      const estado = await responderAtividadeAction({ status: "inicial" }, dados);

      if (estado.status === "sucesso") {
        setResultado(estado.dados.resultado);
        setPremio(estado.dados.premio);
      } else if (estado.status === "erro") {
        setErro(estado.mensagem);
      }
    });
  }

  function avancar(): void {
    const proxima = proximaPosicao(missao, posicao);
    setResultado(undefined);
    setPremio(null);
    setTentativa(1);
    setInicioMs(Date.now());

    if (proxima) setPosicao(proxima);
    else setTerminou(true);
  }

  function tentarDeNovo(): void {
    setResultado(undefined);
    setPremio(null);
    setTentativa((n) => n + 1);
    setInicioMs(Date.now());
  }

  const acertou = resultado?.outcome === "CORRECT";
  const podeAvancar = resultado !== undefined && (acertou || resultado.outcome === "PARTIAL");

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span className="font-display uppercase tracking-[0.15em]">{missao.nome}</span>
          <span>
            {numero} de {total}
          </span>
        </div>

        {/* Progresso com valor acessível: barra sozinha não informa quem não a vê. */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={numero}
          aria-label={`Atividade ${numero} de ${total}`}
          className="h-2 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-aurora)] to-[var(--color-corrente)] transition-[width] duration-[var(--duration-base)]"
            style={{ width: `${(numero / total) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1">
        {Renderer ? (
          <Renderer
            config={atividade.config}
            aoResponder={responder}
            resultado={resultado}
            bloqueado={pendente || resultado !== undefined}
          />
        ) : (
          <p className="text-[var(--color-quase)]">
            Esta atividade ainda não tem tela. Avise um adulto.
          </p>
        )}

        {erro ? (
          <p role="alert" className="mt-6 text-[var(--color-quase)]">
            {erro}
          </p>
        ) : null}
      </main>

      {resultado ? (
        <Devolutiva
          resultado={resultado}
          premio={premio}
          podeAvancar={podeAvancar}
          aoAvancar={avancar}
          aoTentarDeNovo={tentarDeNovo}
        />
      ) : null}
    </div>
  );
}

function Devolutiva({
  resultado,
  premio,
  podeAvancar,
  aoAvancar,
  aoTentarDeNovo,
}: {
  resultado: EvaluationResult;
  premio: Premio | null;
  podeAvancar: boolean;
  aoAvancar: () => void;
  aoTentarDeNovo: () => void;
}) {
  const feedback = resultado.feedback;
  if (!feedback) return null;

  const celebra = feedback.tom === "CELEBRA";

  return (
    <section
      // "status" e não "alert": errar não é emergência, e interromper a leitura
      // da criança com urgência é exatamente o tom que não queremos.
      role="status"
      className={cn(
        "rounded-[var(--radius-lg)] border-2 p-6",
        celebra
          ? "border-[var(--color-folha)] bg-[var(--color-folha)]/10"
          : "border-[var(--color-quase)] bg-[var(--color-quase)]/10",
      )}
    >
      <p
        className={cn(
          "font-display text-xl font-bold",
          celebra ? "text-[var(--color-folha)]" : "text-[var(--color-quase)]",
        )}
      >
        {feedback.mensagem}
      </p>

      {/* O ensino é o motivo de a devolutiva existir. Nunca é escondido. */}
      {"ensino" in feedback ? (
        <p className="mt-3 text-lg text-slate-100">{feedback.ensino}</p>
      ) : null}

      {feedback.dica ? (
        <p className="mt-3 text-slate-300">
          <span className="font-display font-bold">Dica: </span>
          {feedback.dica}
        </p>
      ) : null}

      {premio && premio.xp > 0 ? (
        <p className="font-display mt-4 text-[var(--color-fagulha)]">
          +{premio.xp} de Luz
          {premio.moedas > 0 ? ` · +${premio.moedas} Fagulhas` : ""}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {podeAvancar ? (
          <BotaoGrande onClick={aoAvancar}>Continuar</BotaoGrande>
        ) : (
          <>
            <BotaoGrande onClick={aoTentarDeNovo}>Tentar de novo</BotaoGrande>
            {/* Seguir em frente é sempre possível: travar a criança numa
                atividade que ela não consegue é o oposto de ensinar. */}
            <BotaoGrande variante="discreto" onClick={aoAvancar}>
              Seguir em frente
            </BotaoGrande>
          </>
        )}
      </div>
    </section>
  );
}

function TelaFinal({ missao }: { missao: MissaoNaSessao }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--color-corrente)]">
        Missão concluída
      </p>
      <h1 className="font-display text-3xl font-extrabold text-balance md:text-4xl">
        {missao.nome}
      </h1>
      <p className="max-w-lg text-lg text-slate-300 text-pretty">{missao.conclusao}</p>
      <a
        href="/hub"
        className="font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)] bg-[var(--color-aurora)] px-8 py-4 text-lg font-bold text-white"
      >
        Voltar para a base
      </a>
    </div>
  );
}

function BotaoGrande({
  children,
  onClick,
  variante = "principal",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variante?: "principal" | "discreto";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)] px-8 text-lg font-bold",
        "transition-transform duration-[var(--duration-quick)] hover:scale-[1.02] active:scale-[0.98]",
        "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
        variante === "principal"
          ? "bg-[var(--color-aurora)] text-white"
          : "border border-[var(--glass-border)] text-slate-200",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Mapeia o tipo de atividade para o id do renderer.
 *
 * Vive aqui, e não no plugin, porque o executor é cliente e o plugin é
 * isomórfico — importar o manifesto de plugins aqui arrastaria todos os
 * `evaluate` para o bundle do navegador, que é justo o que o carregamento sob
 * demanda existe para evitar.
 */
function rendererDoTipo(tipo: string): string {
  return tipo.toLowerCase().replace(/_/g, "-");
}
