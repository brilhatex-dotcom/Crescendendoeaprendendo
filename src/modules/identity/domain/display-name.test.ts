import { describe, expect, it } from "vitest";

import { DisplayName, GuardianName } from "./display-name";
import { isErr, unwrap } from "@/shared/kernel";

function erroDoApelido(input: string): string | undefined {
  const resultado = DisplayName.create(input);
  return isErr(resultado) ? resultado.error.code : undefined;
}

describe("DisplayName — apelido da criança", () => {
  it("colapsa espaços internos", () => {
    expect(unwrap(DisplayName.create("  Ana   Luz  ")).value).toBe("Ana Luz");
  });

  it("aceita acento, hífen e apóstrofo", () => {
    for (const apelido of ["Cecília", "Ana-Clara", "D'Ávila", "Jô"]) {
      expect(DisplayName.create(apelido).ok).toBe(true);
    }
  });

  it("recusa apelido curto ou longo demais", () => {
    expect(erroDoApelido("A")).toBe("display_name.too_short");
    expect(erroDoApelido("A".repeat(25))).toBe("display_name.too_long");
  });

  it("recusa tentativa de esconder contato no apelido", () => {
    expect(erroDoApelido("ana@exemplo.com")).toBe("display_name.looks_like_contact");
    expect(erroDoApelido("veja https")).toBe("display_name.looks_like_contact");
  });

  it("recusa dígitos — apelido não é login", () => {
    expect(erroDoApelido("Ana123")).toBe("display_name.invalid_characters");
  });
});

describe("GuardianName — nome do responsável", () => {
  it("aceita nome com numeral e sobrenome composto", () => {
    expect(GuardianName.create("Mariana Silva de Souza").ok).toBe(true);
  });

  it("expõe o primeiro nome para tratamento na interface", () => {
    expect(unwrap(GuardianName.create("Mariana Silva")).firstName).toBe("Mariana");
  });

  it("recusa nome vazio e link", () => {
    expect(GuardianName.create(" ").ok).toBe(false);
    expect(GuardianName.create("http://spam.com").ok).toBe(false);
  });
});
