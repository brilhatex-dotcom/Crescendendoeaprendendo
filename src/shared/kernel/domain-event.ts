/**
 * Eventos de domínio.
 *
 * Módulos não se chamam. Eles reagem (docs/01 §2). Adicionar um efeito novo
 * — "sugerir missão em família ao acertar 5 seguidas" — é um handler novo,
 * zero alteração no fluxo existente. Open/Closed na prática.
 *
 * Efeitos que precisam ser atômicos com a origem rodam in-process na mesma
 * transação; o resto sai pelo outbox (docs/08 §11).
 */

import type { Transacao } from "./unit-of-work";

export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  readonly name: TName;
  readonly payload: TPayload;
  readonly occurredAt: Date;
  /** Correlaciona todos os efeitos de uma mesma ação do usuário. */
  readonly traceId: string;
}

export function domainEvent<TName extends string, TPayload>(
  name: TName,
  payload: TPayload,
  traceId: string,
  occurredAt: Date,
): DomainEvent<TName, TPayload> {
  return { name, payload, occurredAt, traceId };
}

/**
 * Como um efeito chega ao seu manipulador.
 *
 * `inline` — roda **dentro da transação da origem**. É para o que não pode
 * divergir nem por um instante: creditar a Luz de uma tentativa que ficou
 * gravada, debitar a carteira de uma compra que aconteceu (docs/08 §11).
 *
 * `outbox` — a mensagem é gravada na mesma transação, mas o efeito roda depois,
 * em outro processo. É para o que pode esperar e para o que não pode derrubar a
 * resposta da criança se falhar: telemetria, relatório, notificação, IA.
 *
 * A escolha é do manipulador, não de quem publica. Quem publica um evento não
 * sabe — nem deve saber — quantos reagem a ele nem quando.
 */
export type DeliveryMode = "inline" | "outbox";

export interface EventHandler<E extends DomainEvent = DomainEvent> {
  /** Nome do evento que este manipulador trata. */
  readonly topico: E["name"];
  readonly modo: DeliveryMode;
  /**
   * A transação é parâmetro, e não algo que o manipulador abre por conta
   * própria. Um manipulador `inline` que abrisse a sua estaria fora da
   * atomicidade que ele existe para ter.
   */
  tratar(evento: E, tx: Transacao): Promise<void>;
}

export interface EventBus {
  /**
   * Publica dentro da transação em curso.
   *
   * Roda os manipuladores `inline` e grava a mensagem de outbox — as duas
   * coisas na mesma escrita. Nenhum evento sai pelos dois caminhos: quem
   * declara `outbox` não é chamado aqui, e quem declara `inline` não é chamado
   * pelo despachante. É o que impede crédito em dobro.
   */
  publicar(eventos: readonly DomainEvent[], tx: Transacao): Promise<void>;
}

/**
 * Agregado que acumula eventos e os libera ao ser persistido.
 * Nenhum agregado dispara efeito colateral por conta própria.
 */
export abstract class AggregateRoot {
  #events: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.#events.push(event);
  }

  pullEvents(): readonly DomainEvent[] {
    const drained = this.#events;
    this.#events = [];
    return drained;
  }

  get hasPendingEvents(): boolean {
    return this.#events.length > 0;
  }
}
