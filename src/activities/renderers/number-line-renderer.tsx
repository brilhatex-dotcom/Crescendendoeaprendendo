"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type { NumberLineAnswer, NumberLineConfig } from "../plugins/number-line";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de reta numérica.
 *
 * Um `radiogroup` de verdade, um botão por posição inteira — mesma disciplina
 * de acessibilidade de `FillBlankRenderer`: nada de arrastar um marcador ao
 * longo de uma linha, que seria armadilha para teclado, leitor de tela e
 * coordenação em desenvolvimento.
 */
export function NumberLineRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<NumberLineConfig, NumberLineAnswer>) {
  const [selecionado, setSelecionado] = useState<number | null>(null);

  const detalhes = resultado?.detalhes as
    | { valorEnviado?: number; valorCorreto?: number }
    | undefined;
  const revelado = resultado !== undefined;

  const posicoes = Array.from(
    { length: config.maximo - config.minimo + 1 },
    (_, i) => config.minimo + i,
  );

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance md:text-3xl">
        {config.enunciado}
      </h2>

      <div
        role="radiogroup"
        aria-label={config.enunciado}
        className="flex flex-wrap items-end gap-2 rounded-[var(--radius-lg)] border-2 border-[var(--glass-border)] bg-[var(--color-play-raised)] px-4 py-5"
      >
        {posicoes.map((valor) => {
          const ehCorreto = revelado && detalhes?.valorCorreto === valor;
          const foiEscolhido = revelado
            ? detalhes?.valorEnviado === valor
            : selecionado === valor;

          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={selecionado === valor}
              aria-label={`Número ${valor}`}
              disabled={bloqueado || revelado}
              onClick={() => setSelecionado(valor)}
              className={cn(
                "font-display flex min-h-[var(--touch-target-play)] min-w-[var(--touch-target-play)] items-center justify-center",
                "rounded-[var(--radius-md)] border-2 text-lg font-bold",
                "transition-colors duration-[var(--duration-quick)] disabled:cursor-not-allowed",
                revelado
                  ? ehCorreto
                    ? "border-[var(--color-folha)] bg-[var(--color-folha)]/15"
                    : foiEscolhido
                      ? "border-[var(--color-quase)] bg-[var(--color-quase)]/15"
                      : "border-[var(--glass-border)] bg-transparent opacity-40"
                  : foiEscolhido
                    ? "border-[var(--color-corrente)] bg-[var(--color-corrente)]/15"
                    : "border-[var(--glass-border)] bg-transparent hover:border-[var(--color-corrente)]/60",
              )}
            >
              {valor}
            </button>
          );
        })}
      </div>

      {!revelado ? (
        <button
          type="button"
          disabled={bloqueado || selecionado === null}
          onClick={() => aoResponder({ valor: selecionado })}
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
