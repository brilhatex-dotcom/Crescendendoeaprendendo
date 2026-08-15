"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/design-system/utils/cn";

import type { MemoryPairsAnswer, MemoryPairsConfig } from "../plugins/memory-pairs";
import type { ActivityRendererProps } from "./types";

interface Carta {
  readonly cartaId: string;
  readonly parId: string;
  readonly valor: string;
}

/**
 * Tela do jogo da memória.
 *
 * ── Por que não existe cronômetro de virar-de-volta ──
 * O jogo clássico vira as cartas erradas de novo sozinho, depois de um
 * tempinho. Aqui, quem decide quando fechar um par errado é a própria
 * criança, tocando "Continuar" — nada nesta plataforma é acionado por
 * pressão de tempo (mesmo raciocínio de `segurarSegundos`: a devolutiva só
 * avança quando a criança está pronta). O jogo inteiro roda no cliente; só
 * quando o último par é encontrado a resposta (`tentativas`) é enviada.
 */
export function MemoryPairsRenderer({
  config,
  aoResponder,
  resultado,
  bloqueado,
}: ActivityRendererProps<MemoryPairsConfig, MemoryPairsAnswer>) {
  const [cartas] = useState<Carta[]>(() => embaralhar(config.pares));
  const [viradas, setViradas] = useState<string[]>([]);
  const [combinadas, setCombinadas] = useState<Set<string>>(new Set());
  const [tentativas, setTentativas] = useState(0);
  const [aguardandoFechar, setAguardandoFechar] = useState(false);
  const enviada = useRef(false);

  const revelado = resultado !== undefined;
  const totalPares = config.pares.length;

  useEffect(() => {
    if (combinadas.size === totalPares && !enviada.current) {
      enviada.current = true;
      aoResponder({ tentativas });
    }
  }, [combinadas, totalPares, tentativas, aoResponder]);

  function tocarCarta(carta: Carta): void {
    if (bloqueado || revelado || aguardandoFechar) return;
    if (viradas.includes(carta.cartaId) || combinadas.has(carta.parId)) return;

    if (viradas.length === 0) {
      setViradas([carta.cartaId]);
      return;
    }

    const primeira = cartas.find((c) => c.cartaId === viradas[0]);
    setViradas([...viradas, carta.cartaId]);
    setTentativas((t) => t + 1);

    if (primeira?.parId === carta.parId) {
      setCombinadas((atual) => new Set(atual).add(carta.parId));
      setViradas([]);
    } else {
      setAguardandoFechar(true);
    }
  }

  function continuar(): void {
    setViradas([]);
    setAguardandoFechar(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold text-balance md:text-3xl">
        {config.enunciado}
      </h2>

      <div
        role="group"
        aria-label="Tabuleiro do jogo da memória"
        className="grid grid-cols-3 gap-3 sm:grid-cols-4"
      >
        {cartas.map((carta) => {
          const combinada = combinadas.has(carta.parId);
          const virada = combinada || viradas.includes(carta.cartaId);

          return (
            <button
              key={carta.cartaId}
              type="button"
              disabled={bloqueado || revelado || combinada}
              onClick={() => tocarCarta(carta)}
              aria-label={virada ? `Carta: ${carta.valor}` : "Carta virada para baixo"}
              className={cn(
                "flex aspect-square min-h-[var(--touch-target-play)] items-center justify-center",
                "rounded-[var(--radius-lg)] border-2 text-3xl font-bold",
                "transition-colors duration-[var(--duration-quick)] disabled:cursor-not-allowed",
                combinada
                  ? "border-[var(--color-folha)] bg-[var(--color-folha)]/15"
                  : virada
                    ? "border-[var(--color-corrente)] bg-[var(--color-corrente)]/15"
                    : "border-[var(--glass-border)] bg-[var(--color-play-raised)] hover:border-[var(--color-corrente)]/60",
              )}
            >
              {virada ? carta.valor : <span aria-hidden="true">?</span>}
            </button>
          );
        })}
      </div>

      {aguardandoFechar && !revelado ? (
        <button
          type="button"
          onClick={continuar}
          className={cn(
            "font-display min-h-[var(--touch-target-play)] self-start rounded-[var(--radius-xl)]",
            "bg-[var(--color-aurora)] px-8 text-lg font-bold text-white",
            "transition-transform duration-[var(--duration-quick)] hover:scale-[1.02] active:scale-[0.98]",
            "motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          )}
        >
          Continuar
        </button>
      ) : null}
    </div>
  );
}

function embaralhar(pares: MemoryPairsConfig["pares"]): Carta[] {
  const cartas: Carta[] = pares.flatMap((par) => [
    { cartaId: `${par.id}-a`, parId: par.id, valor: par.valor },
    { cartaId: `${par.id}-b`, parId: par.id, valor: par.valor },
  ]);

  for (let i = cartas.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cartas[i], cartas[j]] = [cartas[j]!, cartas[i]!];
  }

  return cartas;
}
