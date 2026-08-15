"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type { MultiSelectAnswer, MultiSelectConfig } from "../plugins/multi-select";
import { ApoioVisualDaAtividade } from "./apoio-visual";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de múltipla seleção — "toque em todos os que servem".
 *
 * Mesmas decisões de acessibilidade de `MultipleChoiceRenderer`, com uma
 * mudança: o grupo é `role="group"` com `role="checkbox"` em cada opção, não
 * `radiogroup`/`radio` — o leitor de tela precisa anunciar "marcado"/"não
 * marcado" por opção, não "1 de N selecionada".
 */
export function MultiSelectRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<MultiSelectConfig, MultiSelectAnswer>) {
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set());

  const detalhes = resultado?.detalhes as
    | { opcoes?: { id: string; escolhida: boolean; correta: boolean }[] }
    | undefined;
  const porId = new Map((detalhes?.opcoes ?? []).map((o) => [o.id, o]));

  const opcoes = config.embaralharOpcoes
    ? [...config.opcoes].sort((a, b) => a.id.localeCompare(b.id))
    : config.opcoes;

  const curtas = opcoes.every((opcao) => opcao.texto.length <= 12);
  const revelada = resultado !== undefined;

  function alternar(id: string): void {
    if (bloqueado || revelada) return;
    setMarcadas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance uppercase md:text-3xl">
        {config.enunciado}
      </h2>

      {config.apoio ? <ApoioVisualDaAtividade apoio={config.apoio} /> : null}

      <div
        role="group"
        aria-label={config.enunciado}
        className={cn("gap-3", curtas ? "grid grid-cols-2 sm:grid-cols-3" : "flex flex-col")}
      >
        {opcoes.map((opcao) => {
          const marcada = marcadas.has(opcao.id);
          const info = porId.get(opcao.id);
          const escolhida = revelada ? (info?.escolhida ?? false) : marcada;
          const eraCorreta = revelada ? (info?.correta ?? false) : false;

          return (
            <button
              key={opcao.id}
              type="button"
              role="checkbox"
              aria-checked={marcada}
              disabled={bloqueado || revelada}
              onClick={() => alternar(opcao.id)}
              className={cn(
                "flex min-h-[var(--touch-target-play)] items-center gap-3 rounded-[var(--radius-lg)]",
                "border-2 px-5 py-4 transition-all duration-[var(--duration-quick)]",
                "disabled:cursor-not-allowed",
                curtas
                  ? "font-display justify-center py-6 text-3xl font-bold"
                  : "text-left text-lg",
                marcada && !revelada
                  ? "border-[var(--color-corrente)] bg-[var(--color-corrente)]/15 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-corrente)_25%,transparent)]"
                  : "border-[var(--glass-border)] bg-[var(--color-play-raised)] hover:border-[var(--color-corrente)]/60",
                revelada &&
                  eraCorreta &&
                  "border-[var(--color-folha)] bg-[var(--color-folha)]/15",
                revelada &&
                  escolhida &&
                  !eraCorreta &&
                  "border-[var(--color-quase)] bg-[var(--color-quase)]/15",
                revelada && !eraCorreta && !escolhida && "opacity-40",
              )}
            >
              {revelada && eraCorreta ? (
                <span aria-hidden="true" className="text-[var(--color-folha)]">
                  ✓
                </span>
              ) : null}
              {revelada && escolhida && !eraCorreta ? (
                <span aria-hidden="true" className="text-[var(--color-quase)]">
                  ↺
                </span>
              ) : null}
              {!revelada && marcada ? (
                <span aria-hidden="true" className="text-[var(--color-corrente)]">
                  ✓
                </span>
              ) : null}

              <span className={curtas ? "" : "flex-1"}>{opcao.texto}</span>

              {revelada && eraCorreta ? <span className="sr-only">Resposta certa</span> : null}
              {revelada && escolhida && !eraCorreta ? (
                <span className="sr-only">Foi o que você marcou</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {!revelada ? (
        <button
          type="button"
          disabled={bloqueado || marcadas.size === 0}
          onClick={() => aoResponder({ opcaoIds: [...marcadas] })}
          className={cn(
            "font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)] py-4",
            "bg-gradient-to-r from-[var(--color-aurora)] to-[var(--color-corrente)]",
            "px-8 text-lg font-bold text-white",
            "transition-transform duration-[var(--duration-quick)] hover:scale-[1.02] active:scale-[0.98]",
            "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          Responder
        </button>
      ) : null}
    </div>
  );
}
