"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type { WordBuildAnswer, WordBuildConfig } from "../plugins/word-build";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de montar-a-palavra.
 *
 * Duas áreas: a palavra montada até agora (toca para desfazer) e o banco de
 * pedaços ainda disponíveis (toca para adicionar) — nada de arrastar, mesmo
 * raciocínio de acessibilidade de `OrderSequenceRenderer`. O banco pode conter
 * pedaços que nunca entram na resposta certa (iscas); a criança precisa
 * reconhecer quais usar, não só a ordem.
 */
export function WordBuildRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<WordBuildConfig, WordBuildAnswer>) {
  const [montada, setMontada] = useState<string[]>([]);

  const detalhes = resultado?.detalhes as { posicoesForaDeLugar?: number[] } | undefined;
  const foraDeLugar = new Set(detalhes?.posicoesForaDeLugar ?? []);
  const revelado = resultado !== undefined;

  const porId = new Map(config.pedacos.map((p) => [p.id, p.texto]));
  const usados = new Set(montada);
  const disponiveis = config.pedacos.filter((p) => !usados.has(p.id));

  function adicionar(id: string): void {
    setMontada((atual) => [...atual, id]);
  }

  function remover(indice: number): void {
    setMontada((atual) => atual.filter((_, i) => i !== indice));
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance md:text-3xl">
        {config.enunciado}
      </h2>

      {config.imagem ? (
        <figure className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--glass-border)] bg-white/5 px-6 py-5">
          <figcaption className="text-center text-lg text-slate-200">
            {config.imagem.textoAlternativo}
          </figcaption>
        </figure>
      ) : null}

      <div
        role="group"
        aria-label="Palavra montada até agora"
        className="flex min-h-[var(--touch-target-play)] flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--glass-border)] bg-[var(--color-play-raised)] px-4 py-3"
      >
        {montada.length === 0 ? (
          <span className="text-slate-400">Toque nos pedaços abaixo para montar a palavra.</span>
        ) : (
          montada.map((id, indice) => (
            <button
              key={`${id}-${indice}`}
              type="button"
              disabled={bloqueado || revelado}
              onClick={() => remover(indice)}
              aria-label={`Remover ${porId.get(id) ?? ""} da palavra`}
              className={cn(
                "font-display flex min-h-[var(--touch-target-play)] min-w-[var(--touch-target-play)] items-center justify-center",
                "rounded-[var(--radius-md)] border-2 px-3 text-xl font-bold uppercase",
                "disabled:cursor-not-allowed",
                revelado && foraDeLugar.has(indice)
                  ? "border-[var(--color-quase)] bg-[var(--color-quase)]/15"
                  : revelado
                    ? "border-[var(--color-folha)] bg-[var(--color-folha)]/15"
                    : "border-[var(--color-corrente)] bg-[var(--color-corrente)]/15",
              )}
            >
              {porId.get(id) ?? "?"}
            </button>
          ))
        )}
      </div>

      {!revelado ? (
        <div role="group" aria-label="Pedaços disponíveis" className="flex flex-wrap gap-3">
          {disponiveis.map((pedaco) => (
            <button
              key={pedaco.id}
              type="button"
              disabled={bloqueado}
              onClick={() => adicionar(pedaco.id)}
              className={cn(
                "font-display flex min-h-[var(--touch-target-play)] min-w-[var(--touch-target-play)] items-center justify-center",
                "rounded-[var(--radius-md)] border-2 border-[var(--glass-border)] bg-[var(--color-play-raised)] px-3",
                "text-xl font-bold uppercase transition-colors duration-[var(--duration-quick)]",
                "hover:border-[var(--color-corrente)]/60 disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              {pedaco.texto}
            </button>
          ))}
        </div>
      ) : null}

      {!revelado ? (
        <button
          type="button"
          disabled={bloqueado || montada.length === 0}
          onClick={() => aoResponder({ sequencia: montada })}
          className={cn(
            "font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)]",
            "bg-[var(--color-aurora)] px-8 text-lg font-bold text-white",
            "transition-transform duration-[var(--duration-quick)] hover:scale-[1.02] active:scale-[0.98]",
            "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          Conferir
        </button>
      ) : null}
    </div>
  );
}
