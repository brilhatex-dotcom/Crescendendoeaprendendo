"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type {
  MultipleChoiceAnswer,
  MultipleChoiceConfig,
} from "../plugins/multiple-choice";
import { ApoioVisualDaAtividade } from "./apoio-visual";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de múltipla escolha.
 *
 * Decisões de acessibilidade que não são opcionais (Bíblia Cap. 1 V6):
 * · a lista é um `radiogroup` de verdade — leitor de tela anuncia "opção 2 de 3";
 * · alvo de toque de 56px (`--touch-target-play`), medida de mão de criança;
 * · acerto e erro **nunca** se distinguem só pela cor: têm ícone e texto;
 * · nada de vermelho — o "quase" é coral (`--color-quase`).
 *
 * ── Sobre o apoio visual ──
 * Se o conteúdo declara `apoio`, ele aparece **antes das opções**. Não é
 * enfeite: numa pergunta como "quantas conchas são?", ele é a pergunta. Sem
 * ele, a criança só pode chutar — e foi exatamente assim que a primeira
 * atividade do acervo foi ao ar.
 */
export function MultipleChoiceRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<MultipleChoiceConfig, MultipleChoiceAnswer>) {
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const detalhes = resultado?.detalhes as
    | {
        opcaoEscolhida?: string;
        opcaoCorreta?: string | null;
        acertou?: boolean;
      }
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

  /*
   * Opções curtas — "3", "Sim", "Azul" — viram uma grade de cartões grandes.
   * Longas continuam empilhadas, porque texto de duas linhas dentro de um
   * cartão estreito é mais difícil de ler para quem está aprendendo a ler.
   */
  const curtas = opcoes.every((opcao) => opcao.texto.length <= 12);
  const revelada = resultado !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance md:text-3xl">
        {config.enunciado}
      </h2>

      {config.apoio ? <ApoioVisualDaAtividade apoio={config.apoio} /> : null}

      <div
        role="radiogroup"
        aria-label={config.enunciado}
        className={cn(
          "gap-3",
          curtas ? "grid grid-cols-2 sm:grid-cols-3" : "flex flex-col",
        )}
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
              disabled={bloqueado}
              onClick={() => setSelecionada(opcao.id)}
              className={cn(
                "flex min-h-[var(--touch-target-play)] items-center gap-3 rounded-[var(--radius-lg)]",
                "border-2 px-5 py-4 transition-all duration-[var(--duration-quick)]",
                "disabled:cursor-not-allowed",
                curtas
                  ? "font-display justify-center py-6 text-3xl font-bold"
                  : "text-left text-lg",
                // Não selecionada: preenchimento sólido, não contorno fino. Um
                // cartão que parece um cartão convida o toque.
                selecionada === opcao.id && !revelada
                  ? "border-[var(--color-corrente)] bg-[var(--color-corrente)]/15 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-corrente)_25%,transparent)]"
                  : "border-[var(--glass-border)] bg-[var(--color-play-raised)] hover:border-[var(--color-corrente)]/60",
                revelada &&
                  eraCorreta &&
                  "border-[var(--color-folha)] bg-[var(--color-folha)]/15",
                revelada &&
                  escolhida &&
                  !eraCorreta &&
                  "border-[var(--color-quase)] bg-[var(--color-quase)]/15",
                // Não escolhida e não correta, depois da devolutiva: recua para
                // o fundo. A atenção da criança precisa ir para as duas que
                // importam, não se dividir entre todas.
                revelada && !eraCorreta && !escolhida && "opacity-40",
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

              <span className={curtas ? "" : "flex-1"}>{opcao.texto}</span>

              {revelada && eraCorreta ? (
                <span className="sr-only">Resposta certa</span>
              ) : null}
              {revelada && escolhida && !eraCorreta ? (
                <span className="sr-only">Foi o que você escolheu</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/*
        Depois da devolutiva o "Responder" some. Ele não tem mais o que fazer, e
        um botão apagado ao lado do "Continuar" só divide a atenção de quem
        ainda está aprendendo a ler.
      */}
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
