import { describe, expect, it } from "vitest";

import { PlainPassword } from "./password";
import { isErr, unwrap } from "@/shared/kernel";

function codigoDoErro(input: string, email?: string): string | undefined {
  const resultado = PlainPassword.create(input, email);
  return isErr(resultado) ? resultado.error.code : undefined;
}

describe("PlainPassword", () => {
  it("aceita frase longa sem símbolo nem número", () => {
    expect(PlainPassword.create("a casa da vovo tem quintal").ok).toBe(true);
  });

  it("recusa senha curta mesmo com composição 'forte'", () => {
    expect(codigoDoErro("Aa1@bcd")).toBe("password.too_short");
  });

  it("recusa senha absurdamente longa (custo de hash)", () => {
    expect(codigoDoErro("x".repeat(200))).toBe("password.too_long");
  });

  it("recusa senha comum", () => {
    expect(codigoDoErro("senha123456")).toBe("password.too_common");
    expect(codigoDoErro("QWERTYUIOP")).toBe("password.too_common");
  });

  it("recusa um único caractere repetido", () => {
    expect(codigoDoErro("aaaaaaaaaaaa")).toBe("password.repeated_character");
  });

  it("recusa senha que contém o e-mail do dono", () => {
    expect(codigoDoErro("mariana-e-a-filha", "mariana@exemplo.com")).toBe(
      "password.contains_email",
    );
  });

  it("ignora parte local curta demais para ser sinal", () => {
    expect(PlainPassword.create("ab-uma-frase-longa", "ab@exemplo.com").ok).toBe(true);
  });

  it("nunca revela a senha ao serializar ou concatenar", () => {
    const senha = unwrap(PlainPassword.create("a casa da vovo tem quintal"));
    expect(JSON.stringify({ senha })).not.toContain("quintal");
    expect(`${senha}`).not.toContain("quintal");
    expect(senha.reveal()).toBe("a casa da vovo tem quintal");
  });
});
