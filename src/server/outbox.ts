import type { PrismaClient } from "@prisma/client";

import { domainEvent, type EventHandler } from "@/shared/kernel";

import { clienteDaTransacao, criarUnidadeDeTrabalho } from "./unit-of-work";

/**
 * DESPACHANTE DO OUTBOX.
 *
 * Lê as mensagens pendentes e entrega aos manipuladores `outbox` — telemetria,
 * relatório, notificação, IA. O que precisa ser atômico com a origem não passa
 * por aqui: aquilo roda `inline`, dentro da transação que o gerou (docs/08 §11).
 *
 * ── At-least-once, e não exactly-once ──
 * Exactly-once não existe num sistema distribuído sem cooperação do consumidor.
 * O que existe é entrega garantida **pelo menos** uma vez, com manipuladores que
 * podem rodar de novo sem estragar nada. É por isso que a `idempotencyKey` da
 * origem viaja no payload: cada consumidor deriva a sua a partir dela.
 *
 * ── Sem processo longo ──
 * Na Vercel não há daemon. Este despachante é feito para rodar em pulsos — por
 * Cron Job ou chamado logo depois de uma ação — e por isso pega um lote,
 * trabalha e devolve o que fez. Nunca fica em laço esperando trabalho.
 */

export interface RelatorioDoDespacho {
  readonly lidas: number;
  readonly processadas: number;
  readonly falhadas: number;
}

/**
 * Espera antes de tentar de novo, por número de tentativas.
 *
 * Cresce depressa porque a causa quase sempre é uma dependência fora do ar, e
 * insistir de segundo em segundo só aumenta a fila dela. A última é longa o
 * bastante para dar tempo de alguém consertar.
 */
const ESPERA_POR_TENTATIVA_MS = [
  30_000, // 30s
  120_000, // 2min
  600_000, // 10min
  3_600_000, // 1h
] as const;

/**
 * Depois disto a mensagem para de ser reagendada e fica visível para inspeção.
 *
 * Não é descarte: a linha continua lá, com `lastError` preenchido e
 * `processedAt` nulo. Uma mensagem que some é um efeito que ninguém sabe que
 * faltou.
 */
const MAXIMO_DE_TENTATIVAS = ESPERA_POR_TENTATIVA_MS.length + 1;

export interface DespachanteDoOutbox {
  despachar(lote?: number): Promise<RelatorioDoDespacho>;
}

export function criarDespachanteDoOutbox(
  db: PrismaClient,
  manipuladores: readonly EventHandler[],
): DespachanteDoOutbox {
  const unidadeDeTrabalho = criarUnidadeDeTrabalho(db);

  const porTopico = new Map<string, EventHandler[]>();
  for (const manipulador of manipuladores) {
    if (manipulador.modo !== "outbox") continue;
    const atual = porTopico.get(manipulador.topico) ?? [];
    atual.push(manipulador);
    porTopico.set(manipulador.topico, atual);
  }

  return {
    async despachar(lote = 50): Promise<RelatorioDoDespacho> {
      const pendentes = await db.outboxMessage.findMany({
        where: {
          processedAt: null,
          availableAt: { lte: new Date() },
          attempts: { lt: MAXIMO_DE_TENTATIVAS },
        },
        orderBy: { id: "asc" },
        take: lote,
      });

      let processadas = 0;
      let falhadas = 0;

      for (const mensagem of pendentes) {
        const inscritos = porTopico.get(mensagem.topic) ?? [];

        try {
          /*
           * O trabalho do manipulador e a marca de processada saem na mesma
           * transação. Separá-las abriria a janela clássica: efeito aplicado,
           * processo cai, mensagem volta à fila, efeito aplicado de novo — e
           * aí a idempotência do consumidor passa a ser a única defesa, em vez
           * de ser a segunda.
           */
          await unidadeDeTrabalho.executar(async (tx) => {
            for (const manipulador of inscritos) {
              await manipulador.tratar(reidratar(mensagem), tx);
            }
            await clienteDaTransacao(tx).outboxMessage.update({
              where: { id: mensagem.id },
              data: { processedAt: new Date(), attempts: mensagem.attempts + 1 },
            });
          });

          processadas += 1;
        } catch (causa) {
          falhadas += 1;
          await reagendar(db, mensagem.id, mensagem.attempts + 1, causa);
        }
      }

      return { lidas: pendentes.length, processadas, falhadas };
    },
  };
}

/** Linha do outbox → evento de domínio, na forma que o manipulador espera. */
function reidratar(mensagem: { topic: string; payload: unknown; createdAt: Date }) {
  const envelope = (mensagem.payload ?? {}) as {
    traceId?: unknown;
    occurredAt?: unknown;
    dados?: unknown;
  };

  const ocorridoEm =
    typeof envelope.occurredAt === "string" ? new Date(envelope.occurredAt) : mensagem.createdAt;

  return domainEvent(
    mensagem.topic,
    envelope.dados,
    typeof envelope.traceId === "string" ? envelope.traceId : "",
    ocorridoEm,
  );
}

async function reagendar(
  db: PrismaClient,
  id: bigint,
  tentativas: number,
  causa: unknown,
): Promise<void> {
  const espera = ESPERA_POR_TENTATIVA_MS[tentativas - 1] ?? 0;

  await db.outboxMessage.update({
    where: { id },
    data: {
      attempts: tentativas,
      availableAt: new Date(Date.now() + espera),
      // Truncado: o campo é para diagnóstico, não para guardar stack inteira.
      lastError: (causa instanceof Error ? causa.message : String(causa)).slice(0, 500),
    },
  });
}
