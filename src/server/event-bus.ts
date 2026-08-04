import type { Prisma } from "@prisma/client";

import type { DomainEvent, EventBus, EventHandler, Transacao } from "@/shared/kernel";

import { clienteDaTransacao } from "./unit-of-work";

/**
 * BARRAMENTO DE EVENTOS.
 *
 * Duas entregas, uma escrita. Para cada evento publicado:
 *
 *  · roda os manipuladores `inline`, **dentro da transação da origem** — é
 *    assim que a Luz aparece no mesmo instante em que a tentativa é gravada;
 *  · grava a mensagem de outbox, também dentro dela — é assim que nenhum efeito
 *    assíncrono se perde se o processo cair no segundo seguinte.
 *
 * Nenhum evento sai pelos dois caminhos. Um manipulador declara um modo só, e o
 * despachante do outbox ignora os `inline`. Sem essa regra, um crédito de moeda
 * aconteceria duas vezes e a diferença apareceria semanas depois, na
 * reconciliação da carteira.
 *
 * Quem publica não sabe quantos reagem. Adicionar "sugerir missão em família ao
 * dominar uma competência" é registrar um manipulador no composition root —
 * zero alteração em `assessment` (docs/01 §2).
 */
export function criarBarramento(manipuladores: readonly EventHandler[]): EventBus {
  const porTopico = agrupar(manipuladores);

  return {
    async publicar(eventos: readonly DomainEvent[], tx: Transacao): Promise<void> {
      const db = clienteDaTransacao(tx);

      for (const evento of eventos) {
        const inscritos = porTopico.get(evento.name);

        /*
         * Sequencial, e não `Promise.all`.
         *
         * Os manipuladores compartilham a mesma transação; disparar em paralelo
         * sobre um único cliente Prisma intercala comandos numa conexão só, e o
         * primeiro erro deixaria os outros escrevendo numa transação já
         * abortada. Aqui a ordem também é barata: são dois ou três por evento.
         */
        for (const manipulador of inscritos?.inline ?? []) {
          await manipulador.tratar(evento, tx);
        }

        /*
         * A linha de outbox só é gravada quando existe alguém para consumi-la.
         * Gravar mensagem que ninguém lê encheria a tabela de linhas com
         * `processedAt` nulo para sempre — e a métrica "quantas mensagens estão
         * pendentes", que é como se percebe que o despachante parou, deixaria
         * de significar qualquer coisa.
         */
        if (inscritos?.temOutbox) {
          await db.outboxMessage.create({
            data: {
              topic: evento.name,
              payload: envelope(evento),
              availableAt: evento.occurredAt,
            },
          });
        }
      }
    },
  };
}

interface Inscritos {
  readonly inline: readonly EventHandler[];
  readonly temOutbox: boolean;
}

function agrupar(manipuladores: readonly EventHandler[]): Map<string, Inscritos> {
  const mapa = new Map<string, { inline: EventHandler[]; temOutbox: boolean }>();

  for (const manipulador of manipuladores) {
    const atual = mapa.get(manipulador.topico) ?? { inline: [], temOutbox: false };
    if (manipulador.modo === "inline") atual.inline.push(manipulador);
    else atual.temOutbox = true;
    mapa.set(manipulador.topico, atual);
  }

  return mapa;
}

/**
 * Evento → linha do outbox.
 *
 * O `JSON.parse(JSON.stringify(...))` não é cerimônia: o payload carrega `Date`
 * e o outbox é formato de fio. Quem consumir a mensagem daqui a uma hora, em
 * outro processo, recebe texto — converter na saída deixaria cada consumidor
 * descobrir sozinho quais campos eram datas.
 *
 * O envelope é uniforme para que o despachante roteie sem conhecer payload
 * nenhum.
 */
function envelope(evento: DomainEvent): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      traceId: evento.traceId,
      occurredAt: evento.occurredAt.toISOString(),
      dados: evento.payload,
    }),
  ) as Prisma.InputJsonValue;
}
