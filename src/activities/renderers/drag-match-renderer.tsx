"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type { DragMatchAnswer, DragMatchConfig } from "../plugins/drag-match";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de parear.
 *
 * ── Por que toque-e-toque, e não arrastar de verdade ──
 * Mesma decisão de `order-sequence-renderer.tsx`: arrastar não funciona por
 * teclado, é sofrível com leitor de tela, e uma criança de seis anos com
 * coordenação em desenvolvimento perde o item no meio do caminho. Tocar um
 * item da esquerda e depois um da direita forma o par — funciona com mouse,
 * toque, teclado (via foco) e leitor de tela igual.
 *
 * A direita é embaralhada; a esquerda fica na ordem do conteúdo. Só a direita
 * precisa embaralhar porque é ela que a criança precisa procurar.
 */
export function DragMatchRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<DragMatchConfig, DragMatchAnswer>) {
  const [direitaEmbaralhada] = useState<string[]>(() => embaralhar(config.pares.map((p) => p.id)));
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [pareamentos, setPareamentos] = useState<Record<string, string>>({});

  const revelado = resultado !== undefined;
  const detalhes = resultado?.detalhes as
    | { pares?: { id: string; correto: boolean }[] }
    | undefined;
  const corretoPorId = new Map((detalhes?.pares ?? []).map((p) => [p.id, p.correto]));

  const porId = new Map(config.pares.map((p) => [p.id, p]));
  const direitaUsadaPor = new Map(Object.entries(pareamentos).map(([e, d]) => [d, e]));

  function tocarEsquerda(id: string): void {
    if (bloqueado) return;

    if (pareamentos[id] !== undefined) {
      // Já pareado: toca de novo para desfazer e escolher outra vez.
      setPareamentos((atual) => {
        const { [id]: _remove, ...resto } = atual;
        return resto;
      });
      setSelecionada(id);
      return;
    }

    setSelecionada(id === selecionada ? null : id);
  }

  function tocarDireita(id: string): void {
    if (bloqueado || selecionada === null) return;

    setPareamentos((atual) => {
      // A criança pode reatribuir uma direita já usada por outro par.
      const semAntiga = Object.fromEntries(
        Object.entries(atual).filter(([, d]) => d !== id),
      );
      return { ...semAntiga, [selecionada]: id };
    });
    setSelecionada(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance uppercase md:text-3xl">
        {config.enunciado}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <ul className="flex flex-col gap-3">
          {config.pares.map((par) => {
            const pareada = pareamentos[par.id] !== undefined;
            const correto = revelado ? corretoPorId.get(par.id) : undefined;

            return (
              <li key={par.id}>
                <button
                  type="button"
                  disabled={bloqueado}
                  onClick={() => tocarEsquerda(par.id)}
                  aria-pressed={par.id === selecionada}
                  className={cn(
                    "flex min-h-[var(--touch-target-play)] w-full items-center justify-center rounded-[var(--radius-lg)] border-2 px-3 py-3 text-center text-lg",
                    revelado
                      ? correto
                        ? "border-[var(--color-folha)] bg-[var(--color-play-raised)]"
                        : "border-[var(--color-quase)] bg-[var(--color-play-raised)]"
                      : par.id === selecionada
                        ? "border-[var(--color-corrente)] bg-[var(--color-play-raised)]"
                        : pareada
                          ? "border-[var(--color-aurora)] bg-[var(--color-play-raised)]"
                          : "border-[var(--glass-border)] bg-transparent hover:border-[var(--color-corrente)]",
                    "disabled:pointer-events-none disabled:opacity-70",
                  )}
                >
                  {par.esquerda}
                </button>
              </li>
            );
          })}
        </ul>

        <ul className="flex flex-col gap-3">
          {direitaEmbaralhada.map((id) => {
            const par = porId.get(id);
            if (!par) return null;
            const usadaPor = direitaUsadaPor.get(id);
            const correto = revelado && usadaPor ? corretoPorId.get(usadaPor) : undefined;

            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={bloqueado}
                  onClick={() => tocarDireita(id)}
                  className={cn(
                    "flex min-h-[var(--touch-target-play)] w-full items-center justify-center rounded-[var(--radius-lg)] border-2 px-3 py-3 text-center text-lg",
                    revelado
                      ? correto
                        ? "border-[var(--color-folha)] bg-[var(--color-play-raised)]"
                        : usadaPor
                          ? "border-[var(--color-quase)] bg-[var(--color-play-raised)]"
                          : "border-[var(--glass-border)] bg-transparent"
                      : usadaPor
                        ? "border-[var(--color-aurora)] bg-[var(--color-play-raised)]"
                        : "border-[var(--glass-border)] bg-transparent hover:border-[var(--color-corrente)]",
                    "disabled:pointer-events-none disabled:opacity-70",
                  )}
                >
                  {par.direita}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        disabled={bloqueado}
        onClick={() => aoResponder({ pareamentos })}
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
    </div>
  );
}

/** Fisher-Yates. Só a coluna da direita embaralha — a esquerda segue o conteúdo. */
function embaralhar<T>(itens: readonly T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copia[i]!;
    copia[i] = copia[j]!;
    copia[j] = temp;
  }
  return copia;
}
