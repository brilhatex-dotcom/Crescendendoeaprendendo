/**
 * Tempo é uma dependência, não uma chamada global.
 *
 * `new Date()` espalhado pelo domínio torna impossível testar regeneração de
 * Fôlego, revisão espaçada ou Trilha de Luz sem esperar de verdade.
 */

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** Relógio controlável para teste. */
export class FixedClock implements Clock {
  #current: Date;

  constructor(initial: Date) {
    this.#current = new Date(initial);
  }

  now(): Date {
    return new Date(this.#current);
  }

  advanceMinutes(minutes: number): void {
    this.#current = new Date(this.#current.getTime() + minutes * 60_000);
  }

  advanceDays(days: number): void {
    this.advanceMinutes(days * 24 * 60);
  }
}
