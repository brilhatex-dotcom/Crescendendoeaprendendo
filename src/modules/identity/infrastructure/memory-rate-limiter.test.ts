import { beforeEach, describe, expect, it } from "vitest";

import { FixedClock, isErr } from "@/shared/kernel";

import { InMemoryRateLimiter } from "./memory-rate-limiter";

describe("InMemoryRateLimiter", () => {
  let relogio: FixedClock;
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    relogio = new FixedClock(new Date("2026-08-03T12:00:00.000Z"));
    limiter = new InMemoryRateLimiter(relogio);
  });

  const UM_MINUTO = 60_000;

  it("permite até o limite e recusa a seguinte", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await limiter.consume("login:ip", 5, UM_MINUTO)).ok).toBe(true);
    }

    const excedida = await limiter.consume("login:ip", 5, UM_MINUTO);
    expect(isErr(excedida) && excedida.error.kind).toBe("RATE_LIMITED");
  });

  it("conta cada chave separadamente", async () => {
    for (let i = 0; i < 5; i += 1) await limiter.consume("login:ip-a", 5, UM_MINUTO);

    expect((await limiter.consume("login:ip-b", 5, UM_MINUTO)).ok).toBe(true);
  });

  it("libera conforme a janela desliza, não de uma vez", async () => {
    for (let i = 0; i < 5; i += 1) {
      await limiter.consume("login:ip", 5, UM_MINUTO);
      relogio.advanceMinutes(0.1); // tentativas espalhadas em 30s
    }
    expect((await limiter.consume("login:ip", 5, UM_MINUTO)).ok).toBe(false);

    // Meio minuto depois, só as mais antigas saíram da janela.
    relogio.advanceMinutes(0.75);
    expect((await limiter.consume("login:ip", 5, UM_MINUTO)).ok).toBe(true);
  });

  it("insistir sem parar não empurra a janela para frente", async () => {
    for (let i = 0; i < 5; i += 1) await limiter.consume("login:ip", 5, UM_MINUTO);

    // Vinte tentativas recusadas durante o bloqueio.
    for (let i = 0; i < 20; i += 1) {
      relogio.advanceMinutes(0.02);
      expect((await limiter.consume("login:ip", 5, UM_MINUTO)).ok).toBe(false);
    }

    // Passado o minuto desde as tentativas VÁLIDAS, libera.
    relogio.advanceMinutes(1);
    expect((await limiter.consume("login:ip", 5, UM_MINUTO)).ok).toBe(true);
  });

  it("informa quanto falta para liberar", async () => {
    for (let i = 0; i < 3; i += 1) await limiter.consume("pin:acc", 3, UM_MINUTO);
    relogio.advanceMinutes(0.25);

    const recusada = await limiter.consume("pin:acc", 3, UM_MINUTO);
    const detalhes = isErr(recusada) ? recusada.error.details : undefined;
    expect(detalhes?.liberaEmMs).toBe(45_000);
  });

  it("não cresce sem limite com chaves antigas", async () => {
    const pequeno = new InMemoryRateLimiter(relogio, 10);
    for (let i = 0; i < 12; i += 1) await pequeno.consume(`ip-${i}`, 5, UM_MINUTO);

    relogio.advanceMinutes(180); // além da maior janela em uso
    await pequeno.consume("gatilho-da-limpeza", 5, UM_MINUTO);

    // As chaves velhas saíram: a nova volta a começar do zero.
    for (let i = 0; i < 5; i += 1) {
      expect((await pequeno.consume("ip-0", 5, UM_MINUTO)).ok).toBe(true);
    }
  });
});
