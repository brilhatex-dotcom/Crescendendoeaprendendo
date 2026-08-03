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

/** Entrega assíncrona e durável — gravada na mesma transação da origem. */
export type DeliveryMode = "inline" | "outbox";

export interface EventHandler<E extends DomainEvent = DomainEvent> {
  readonly handles: E["name"];
  readonly mode: DeliveryMode;
  handle(event: E): Promise<void>;
}

export interface EventBus {
  /** Publica dentro da transação em curso. */
  publish(events: readonly DomainEvent[]): Promise<void>;
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
