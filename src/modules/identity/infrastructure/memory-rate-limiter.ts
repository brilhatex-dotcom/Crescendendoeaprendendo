import { err, ok, rateLimited, type Result } from "@/shared/kernel";
import type { Clock } from "@/shared/kernel";

import type { RateLimiter } from "../application/ports";

/**
 * Janela deslizante em memória do processo.
 *
 * ── Limitação que precisa estar escrita, não escondida ──
 * Na Vercel o app roda em várias instâncias, e cada uma tem o próprio mapa.
 * Com N instâncias quentes, o limite efetivo é até N × o configurado. Isto
 * segura o caso comum (o mesmo navegador martelando o formulário) e **não**
 * segura um ataque distribuído com paciência.
 *
 * O alvo final é a janela deslizante em Redis de docs/09 §5, que a porta
 * `RateLimiter` já comporta sem mudar nenhum caso de uso: quando `REDIS_URL`
 * existir, troca-se a implementação no composition root e nada mais.
 *
 * Guardamos os instantes das tentativas, não um contador com reset. Contador
 * que zera de hora em hora deixa passar uma rajada dupla na virada da janela.
 */
export class InMemoryRateLimiter implements RateLimiter {
  readonly #tentativas = new Map<string, number[]>();
  readonly #clock: Clock;
  /** Teto de chaves distintas: sem ele, o mapa é um vazamento de memória. */
  readonly #maxChaves: number;

  constructor(clock: Clock, maxChaves = 10_000) {
    this.#clock = clock;
    this.#maxChaves = maxChaves;
  }

  async consume(
    chave: string,
    limite: number,
    janelaMs: number,
  ): Promise<Result<void>> {
    const agora = this.#clock.now().getTime();
    const inicioDaJanela = agora - janelaMs;

    const anteriores = this.#tentativas.get(chave) ?? [];
    const dentroDaJanela = anteriores.filter((quando) => quando > inicioDaJanela);

    if (dentroDaJanela.length >= limite) {
      // A tentativa recusada não entra na lista: senão quem insiste sem parar
      // empurra a janela para frente e nunca sai do bloqueio.
      this.#tentativas.set(chave, dentroDaJanela);
      const maisAntiga = dentroDaJanela[0] ?? agora;
      return err(
        rateLimited("rate_limit.exceeded", "Limite de tentativas excedido.", {
          liberaEmMs: Math.max(maisAntiga + janelaMs - agora, 0),
        }),
      );
    }

    dentroDaJanela.push(agora);
    this.#tentativas.set(chave, dentroDaJanela);

    if (this.#tentativas.size > this.#maxChaves) this.#limpar(agora);

    return ok(undefined);
  }

  /** Remove chaves cujas tentativas já saíram de qualquer janela plausível. */
  #limpar(agora: number): void {
    const limiteDeIdade = agora - MAIOR_JANELA_MS;
    for (const [chave, instantes] of this.#tentativas) {
      const ultima = instantes.at(-1);
      if (ultima === undefined || ultima < limiteDeIdade) {
        this.#tentativas.delete(chave);
      }
    }
  }
}

/** Maior janela em uso hoje (1h, em `LIMITES`), com folga. */
const MAIOR_JANELA_MS = 2 * 60 * 60 * 1000;
