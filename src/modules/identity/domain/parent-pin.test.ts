import { describe, expect, it } from "vitest";

import { ParentPin } from "./parent-pin";
import { isErr, unwrap } from "@/shared/kernel";

function codigoDoErro(input: string): string | undefined {
  const resultado = ParentPin.create(input);
  return isErr(resultado) ? resultado.error.code : undefined;
}

describe("ParentPin", () => {
  it("aceita 4 a 6 dígitos não óbvios", () => {
    for (const pin of ["4827", "90513", "719284"]) {
      expect(ParentPin.create(pin).ok).toBe(true);
    }
  });

  it.each(["123", "1234567", "12a4", "", "  "])("recusa formato inválido %s", (pin) => {
    expect(codigoDoErro(pin)).toBe("pin.format");
  });

  it("recusa dígitos repetidos — é o primeiro palpite de uma criança", () => {
    expect(codigoDoErro("1111")).toBe("pin.repeated");
    expect(codigoDoErro("999999")).toBe("pin.repeated");
  });

  it("recusa sequência crescente e decrescente", () => {
    expect(codigoDoErro("1234")).toBe("pin.sequential");
    expect(codigoDoErro("4321")).toBe("pin.sequential");
    expect(codigoDoErro("456789")).toBe("pin.sequential");
  });

  it("aceita sequência com passo diferente de 1", () => {
    expect(ParentPin.create("2468").ok).toBe(true);
  });

  it("nunca revela o PIN ao serializar", () => {
    const pin = unwrap(ParentPin.create("4827"));
    expect(JSON.stringify({ pin })).not.toContain("4827");
    expect(pin.reveal()).toBe("4827");
  });
});
