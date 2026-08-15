"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import { MARCADOR_DE_LACUNA, type FillBlankAnswer, type FillBlankConfig } from "../plugins/fill-blank";
import { ApoioVisualDaAtividade } from "./apoio-visual";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de completar-a-lacuna.
 *
 * A frase aparece inteira, com a lacuna mostrada como uma caixa tracejada que
 * se preenche com a palavra escolhida — a criança lê a frase completa antes
 * de confirmar, o que `MULTIPLE_CHOICE` sozinho não oferece. A escolha em si
 * continua sendo um `radiogroup`/`radio` de verdade no banco de palavras, não
 * um campo de texto: nada de digitação livre (ver `schema.ts`).
 */
export function FillBlankRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<FillBlankConfig, FillBlankAnswer>) {
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const detalhes = resultado?.detalhes as
    | { opcaoEscolhida?: string; opcaoCorreta?: string | null; acertou?: boolean }
    | undefined;

  const opcoes = config.embaralharOpcoes
    ? [...config.opcoes].sort((a, b) => a.id.localeCompare(b.id))
    : config.opcoes;

  const revelada = resultado !== undefined;

  const [antes, depois] = config.enunciado.split(MARCADOR_DE_LACUNA);
  const idEscolhido = revelada ? (detalhes?.opcaoEscolhida ?? null) : selecionada;
  const textoNaLacuna = opcoes.find((o) => o.id === idEscolhido)?.texto ?? null;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance uppercase md:text-3xl">
        {antes}
        <span
          className={cn(
            "mx-1 inline-block min-w-[3ch] rounded-[var(--radius-sm)] border-b-4 px-2 text-center",
            textoNaLacuna
              ? "border-[var(--color-corrente)] text-[var(--color-corrente)]"
              : "border-dashed border-[var(--glass-border)] text-[var(--glass-border)]",
          )}
        >
          {textoNaLacuna ?? "___"}
        </span>
        {depois}
      </h2>

      {config.apoio ? <ApoioVisualDaAtividade apoio={config.apoio} /> : null}

      <div
        role="radiogroup"
        aria-label={config.enunciado}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {opcoes.map((opcao) => {
          const escolhida = detalhes?.opcaoEscolhida === opcao.id;
          const eraCorreta = detalhes?.opcaoCorreta === opcao.id;

          return (
            <button
              key={opcao.id}
              type="button"
              role="radio"
              aria-checked={selecionada === opcao.id}
              disabled={bloqueado || revelada}
              onClick={() => setSelecionada(opcao.id)}
              className={cn(
                "font-display flex min-h-[var(--touch-target-play)] items-center justify-center gap-2",
                "rounded-[var(--radius-lg)] border-2 px-5 py-4 text-lg font-bold",
                "transition-all duration-[var(--duration-quick)] disabled:cursor-not-allowed",
                selecionada === opcao.id && !revelada
                  ? "border-[var(--color-corrente)] bg-[var(--color-corrente)]/15 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-corrente)_25%,transparent)]"
                  : "border-[var(--glass-border)] bg-[var(--color-play-raised)] hover:border-[var(--color-corrente)]/60",
                revelada && eraCorreta && "border-[var(--color-folha)] bg-[var(--color-folha)]/15",
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

              <span className="uppercase">{opcao.texto}</span>

              {revelada && eraCorreta ? <span className="sr-only">Resposta certa</span> : null}
              {revelada && escolhida && !eraCorreta ? (
                <span className="sr-only">Foi o que você escolheu</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {!revelada ? (
        <button
          type="button"
          disabled={bloqueado || selecionada === null}
          onClick={() => aoResponder({ opcaoId: selecionada })}
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
