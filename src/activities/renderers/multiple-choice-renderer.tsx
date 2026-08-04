"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type { MultipleChoiceAnswer, MultipleChoiceConfig } from "../plugins/multiple-choice";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de múltipla escolha.
 *
 * Decisões de acessibilidade que não são opcionais (Bíblia Cap. 1 V6):
 * · a lista é um `radiogroup` de verdade — leitor de tela anuncia "opção 2 de 3";
 * · alvo de toque de 56px (`--touch-target-play`), medida de mão de criança;
 * · acerto e erro **nunca** se distinguem só pela cor: têm ícone e texto;
 * · nada de vermelho — o "quase" é coral (`--color-quase`).
 */
export function MultipleChoiceRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<MultipleChoiceConfig, MultipleChoiceAnswer>) {
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const detalhes = resultado?.detalhes as
    | { opcaoEscolhida?: string; opcaoCorreta?: string | null; acertou?: boolean }
    | undefined;

  /*
   * Embaralhar é decisão do conteúdo (`embaralharOpcoes`), porque em algumas
   * atividades a ordem carrega significado — "qual vem primeiro?" não pode ter
   * as opções sorteadas. A ordem derivada do id mantém a mesma disposição entre
   * recarregamentos da página: um embaralhamento novo a cada render moveria as
   * opções debaixo do dedo da criança.
   */
  const opcoes = config.embaralharOpcoes
    ? [...config.opcoes].sort((a, b) => a.id.localeCompare(b.id))
    : config.opcoes;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance md:text-3xl">
        {config.enunciado}
      </h2>

      <div role="radiogroup" aria-label={config.enunciado} className="flex flex-col gap-3">
        {opcoes.map((opcao) => {
          const escolhida = detalhes?.opcaoEscolhida === opcao.id;
          const eraCorreta = detalhes?.opcaoCorreta === opcao.id;
          const revelada = resultado !== undefined;

          return (
            <button
              key={opcao.id}
              type="button"
              role="radio"
              aria-checked={selecionada === opcao.id}
              disabled={bloqueado}
              onClick={() => setSelecionada(opcao.id)}
              className={cn(
                "flex min-h-[var(--touch-target-play)] items-center gap-3 rounded-[var(--radius-lg)]",
                "border-2 px-5 py-4 text-left text-lg transition-colors duration-[var(--duration-quick)]",
                "disabled:cursor-not-allowed",
                selecionada === opcao.id && !revelada
                  ? "border-[var(--color-corrente)] bg-white/10"
                  : "border-[var(--glass-border)] bg-[var(--color-play-raised)]",
                revelada && eraCorreta && "border-[var(--color-folha)] bg-[var(--color-folha)]/10",
                revelada && escolhida && !eraCorreta && "border-[var(--color-quase)] bg-[var(--color-quase)]/10",
              )}
            >
              {/* Ícone + texto: a informação nunca depende só da cor. */}
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

              <span className="flex-1">{opcao.texto}</span>

              {revelada && eraCorreta ? <span className="sr-only">Resposta certa</span> : null}
              {revelada && escolhida && !eraCorreta ? (
                <span className="sr-only">Foi o que você escolheu</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={bloqueado || selecionada === null}
        onClick={() => aoResponder({ opcaoId: selecionada })}
        className={cn(
          "font-display min-h-[var(--touch-target-play)] rounded-[var(--radius-xl)]",
          "bg-[var(--color-aurora)] px-8 text-lg font-bold text-white",
          "transition-transform duration-[var(--duration-quick)] hover:scale-[1.02] active:scale-[0.98]",
          "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        Responder
      </button>
    </div>
  );
}
