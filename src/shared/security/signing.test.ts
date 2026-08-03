import { describe, expect, it } from "vitest";

import { sign, verify } from "./signing";

const SEGREDO = "um-segredo-de-teste-com-mais-de-32-caracteres";

describe("assinatura HMAC", () => {
  const carga = JSON.stringify({ s: "ses_1", l: "lea_1", exp: 1_800_000_000 });

  it("assina e recupera a carga original", () => {
    expect(verify(sign(carga, SEGREDO), SEGREDO)).toBe(carga);
  });

  it("recusa carga adulterada", () => {
    const assinado = sign(carga, SEGREDO);
    const adulterado = Buffer.from(
      JSON.stringify({ s: "ses_1", l: "lea_OUTRA", exp: 1_800_000_000 }),
      "utf8",
    ).toString("base64url");

    expect(verify(`${adulterado}.${assinado.split(".")[1]}`, SEGREDO)).toBeNull();
  });

  it("recusa assinatura de outro segredo", () => {
    expect(verify(sign(carga, SEGREDO), "outro-segredo-igualmente-longo-aqui")).toBeNull();
  });

  it("recusa formato inesperado sem lançar", () => {
    for (const entrada of ["", "sem-ponto", "a.b.c", ".", "a."]) {
      expect(verify(entrada, SEGREDO)).toBeNull();
    }
  });

  it("é determinístico para a mesma carga e segredo", () => {
    expect(sign(carga, SEGREDO)).toBe(sign(carga, SEGREDO));
  });
});
