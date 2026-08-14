"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type { TrueFalseAnswer, TrueFalseConfig } from "../plugins/true-false";
import { ApoioVisualDaAtividade } from "./apoio-visual";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de verdadeiro-ou-falso.
 *
 * Só dois botões, sempre nos mesmos rótulos e no mesmo lugar — "Verdadeiro" e
 * "Falso" não vêm do conteúdo (`TrueFalseConfig` não declara texto de opção),
 * então não há embaralhamento a decidir nem grade a calcular como em
 * `MultipleChoiceRenderer`. Mesmo `role="radiogroup"`/`role="radio"` e as
 * mesmas regras de acessibilidade: nunca só cor para distinguir certo de
 * errado, alvo de toque de 56px.
 */
export function TrueFalseRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<TrueFalseConfig, TrueFalseAnswer>) {
  const [selecionada, setSelecionada] = useState<boolean | null>(null);

  const detalhes = resultado?.detalhes as
    | { respostaDada?: boolean; respostaCorreta?: boolean; acertou?: boolean }
    | undefined;

  const revelada = resultado !== undefined;

  const opcoes: readonly { valor: boolean; rotulo: string }[] = [
    { valor: true, rotulo: "Verdadeiro" },
    { valor: false, rotulo: "Falso" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance md:text-3xl">
        {config.enunciado}
      </h2>

      {config.apoio ? <ApoioVisualDaAtividade apoio={config.apoio} /> : null}

      <div
        role="radiogroup"
        aria-label={config.enunciado}
        className="grid grid-cols-2 gap-3"
      >
        {opcoes.map((opcao) => {
          const escolhida = detalhes?.respostaDada === opcao.valor;
          const eraCorreta = detalhes?.respostaCorreta === opcao.valor;

          return (
            <button
              key={opcao.rotulo}
              type="button"
              role="radio"
              aria-checked={selecionada === opcao.valor}
              disabled={bloqueado || revelada}
              onClick={() => setSelecionada(opcao.valor)}
              className={cn(
                "font-display flex min-h-[var(--touch-target-play)] flex-col items-center justify-center gap-2",
                "rounded-[var(--radius-lg)] border-2 px-5 py-6 text-2xl font-bold",
                "transition-all duration-[var(--duration-quick)] disabled:cursor-not-allowed",
                selecionada === opcao.valor && !revelada
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
              <span aria-hidden="true" className="text-3xl">
                {opcao.valor ? "✅" : "❌"}
              </span>
              <span>{opcao.rotulo}</span>

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
          onClick={() => aoResponder({ resposta: selecionada })}
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
