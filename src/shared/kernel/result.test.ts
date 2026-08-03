import { describe, expect, it } from "vitest";

import { conflict, err, flatMap, isErr, isOk, map, ok, unwrap } from "./result";

describe("Result", () => {
  it("carrega o valor no caminho feliz", () => {
    const resultado = ok(42);

    expect(isOk(resultado)).toBe(true);
    expect(unwrap(resultado)).toBe(42);
  });

  it("carrega o erro sem lançar exceção", () => {
    const resultado = err(conflict("wallet.insufficient", "Saldo insuficiente"));

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.kind).toBe("CONFLICT");
      expect(resultado.error.code).toBe("wallet.insufficient");
    }
  });

  it("map transforma apenas o sucesso", () => {
    expect(unwrap(map(ok(10), (n) => n * 2))).toBe(20);

    const falho = map(err(conflict("x", "y")), (n: number) => n * 2);
    expect(isErr(falho)).toBe(true);
  });

  it("flatMap encadeia sem aninhar", () => {
    const dobrarSePositivo = (n: number) =>
      n > 0 ? ok(n * 2) : err(conflict("neg", "número negativo"));

    expect(unwrap(flatMap(ok(5), dobrarSePositivo))).toBe(10);
    expect(isErr(flatMap(ok(-1), dobrarSePositivo))).toBe(true);
  });

  it("unwrap de erro lança — é a única saída explosiva", () => {
    expect(() => unwrap(err(conflict("x", "y")))).toThrow();
  });
});
