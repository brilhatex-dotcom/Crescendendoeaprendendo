import { describe, expect, it } from "vitest";

import {
  generateShortCode,
  generateToken,
  hashIp,
  hashToken,
  tokensMatch,
} from "./tokens";

describe("tokens", () => {
  it("gera tokens distintos a cada chamada", () => {
    const amostra = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(amostra.size).toBe(200);
  });

  it("gera token com 256 bits de entropia", () => {
    // base64url de 32 bytes = 43 caracteres, sem padding.
    expect(generateToken()).toHaveLength(43);
  });

  it("nunca produz caracteres ambíguos no código curto", () => {
    const codigos = Array.from({ length: 300 }, () => generateShortCode()).join("");
    expect(codigos).not.toMatch(/[01OI]/);
  });

  it("hash é determinístico e some com o token original", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });

  it("reconhece o par correto e recusa o errado", () => {
    const token = generateToken();
    expect(tokensMatch(hashToken(token), hashToken(token))).toBe(true);
    expect(tokensMatch(hashToken(token), hashToken(generateToken()))).toBe(false);
  });

  it("compara comprimentos diferentes sem estourar", () => {
    expect(tokensMatch("abc", "abcdef")).toBe(false);
  });

  it("pseudonimiza IP e depende do sal", () => {
    const ip = "203.0.113.7";
    expect(hashIp(ip, "sal-a")).not.toBe(ip);
    expect(hashIp(ip, "sal-a")).toBe(hashIp(ip, "sal-a"));
    expect(hashIp(ip, "sal-a")).not.toBe(hashIp(ip, "sal-b"));
  });
});
