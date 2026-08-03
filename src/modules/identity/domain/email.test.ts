import { describe, expect, it } from "vitest";

import { Email } from "./email";
import { unwrap } from "@/shared/kernel";

describe("Email", () => {
  it("normaliza caixa e espaços da borda", () => {
    expect(unwrap(Email.create("  Maria.Silva@Exemplo.COM  ")).value).toBe(
      "maria.silva@exemplo.com",
    );
  });

  it.each([
    ["sem arroba", "mariaexemplo.com"],
    ["sem domínio", "maria@"],
    ["sem ponto no domínio", "maria@exemplo"],
    ["vazio", "   "],
    ["com espaço no meio", "maria silva@exemplo.com"],
  ])("recusa e-mail %s", (_caso, entrada) => {
    const resultado = Email.create(entrada);
    expect(resultado.ok).toBe(false);
  });

  it("aceita endereços legítimos e incomuns", () => {
    for (const valido of [
      "a@b.co",
      "maria+filha@exemplo.com.br",
      "maria_silva-99@sub.dominio.org",
    ]) {
      expect(Email.create(valido).ok).toBe(true);
    }
  });

  it("mascara a parte local preservando o domínio", () => {
    const email = unwrap(Email.create("mariana@exemplo.com"));
    expect(email.masked).toBe("ma•••••@exemplo.com");
  });

  it("compara por valor, não por identidade", () => {
    const a = unwrap(Email.create("maria@exemplo.com"));
    const b = unwrap(Email.create("MARIA@exemplo.com"));
    expect(a.equals(b)).toBe(true);
  });
});
