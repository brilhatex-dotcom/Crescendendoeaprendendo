"use client";

import { useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type { OrderSequenceAnswer, OrderSequenceConfig } from "../plugins/order-sequence";
import type { ActivityRendererProps } from "./types";

/**
 * Tela de ordenação.
 *
 * ── Por que botões "subir/descer" e não arrastar ──
 * Arrastar é bonito e é armadilha de acessibilidade: não funciona por teclado,
 * é sofrível com leitor de tela, e uma criança de 6 anos com coordenação em
 * desenvolvimento perde o item no meio do caminho. Mover por botão funciona
 * para todo mundo, inclusive para quem usa só o teclado.
 *
 * O arrastar pode ser adicionado depois **como alternativa**, nunca como único
 * caminho — acessibilidade é padrão, não recurso.
 */
export function OrderSequenceRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<OrderSequenceConfig, OrderSequenceAnswer>) {
  // Ordem inicial: a do conteúdo, que já vem embaralhada pelo autor.
  const [ordem, setOrdem] = useState<string[]>(() => config.itens.map((i) => i.id));

  const detalhes = resultado?.detalhes as
    | { posicoesForaDeLugar?: number[]; itensEmOrdem?: number; total?: number }
    | undefined;
  const foraDeLugar = new Set(detalhes?.posicoesForaDeLugar ?? []);
  const revelado = resultado !== undefined;

  function mover(de: number, para: number): void {
    if (para < 0 || para >= ordem.length) return;
    const nova = [...ordem];
    const [item] = nova.splice(de, 1);
    if (item !== undefined) nova.splice(para, 0, item);
    setOrdem(nova);
  }

  const porId = new Map(config.itens.map((i) => [i.id, i]));

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance md:text-3xl">
        {config.enunciado}
      </h2>

      <ol className="flex flex-col gap-3">
        {ordem.map((id, indice) => {
          const item = porId.get(id);
          if (!item) return null;

          return (
            <li
              key={id}
              className={cn(
                "flex min-h-[var(--touch-target-play)] items-center gap-3 rounded-[var(--radius-lg)]",
                "border-2 bg-[var(--color-play-raised)] px-4 py-3",
                revelado && foraDeLugar.has(indice)
                  ? "border-[var(--color-quase)]"
                  : revelado
                    ? "border-[var(--color-folha)]"
                    : "border-[var(--glass-border)]",
              )}
            >
              <span
                aria-hidden="true"
                className="font-display w-8 text-center text-sm text-slate-400"
              >
                {indice + 1}º
              </span>

              <span className="flex-1 text-lg">{item.texto}</span>

              <div className="flex gap-1">
                <BotaoDeMover
                  rotulo={`Mover ${item.texto} para cima`}
                  simbolo="↑"
                  desabilitado={bloqueado || indice === 0}
                  aoClicar={() => mover(indice, indice - 1)}
                />
                <BotaoDeMover
                  rotulo={`Mover ${item.texto} para baixo`}
                  simbolo="↓"
                  desabilitado={bloqueado || indice === ordem.length - 1}
                  aoClicar={() => mover(indice, indice + 1)}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        disabled={bloqueado}
        onClick={() => aoResponder({ ordem })}
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

function BotaoDeMover({
  rotulo,
  simbolo,
  desabilitado,
  aoClicar,
}: {
  rotulo: string;
  simbolo: string;
  desabilitado: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      // O rótulo descreve a ação E o item: "para cima" sozinho não diz nada a
      // quem navega por leitor de tela e ouve o botão fora de contexto.
      aria-label={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)]",
        "border border-[var(--glass-border)] text-lg text-slate-200",
        "transition-colors duration-[var(--duration-quick)] hover:bg-white/10",
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      <span aria-hidden="true">{simbolo}</span>
    </button>
  );
}
