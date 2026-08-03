import { describe, expect, it } from "vitest";

import { Argon2Hasher } from "./argon2-hasher";

/**
 * Testa o hasher de verdade, não um dublê. É lento de propósito — se estes
 * testes ficarem rápidos, é porque alguém baixou os parâmetros do Argon2.
 */
describe("Argon2Hasher", () => {
  const hasher = new Argon2Hasher();
  const SENHA = "a casa da vovo tem quintal";

  it("produz hash que não contém a senha e confere de volta", async () => {
    const guardado = await hasher.hash(SENHA);

    expect(guardado).not.toContain("quintal");
    expect(guardado).not.toContain(SENHA);
    expect(await hasher.verify(guardado, SENHA)).toBe(true);
  });

  it("usa Argon2id com os parâmetros do OWASP", async () => {
    expect(await hasher.hash(SENHA)).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it("gera hashes diferentes para a mesma senha — o sal está embutido", async () => {
    const [a, b] = await Promise.all([hasher.hash(SENHA), hasher.hash(SENHA)]);

    expect(a).not.toBe(b);
    expect(await hasher.verify(a, SENHA)).toBe(true);
    expect(await hasher.verify(b, SENHA)).toBe(true);
  });

  it("recusa senha errada", async () => {
    const guardado = await hasher.hash(SENHA);
    expect(await hasher.verify(guardado, "a casa da vovo tem quintaL")).toBe(false);
    expect(await hasher.verify(guardado, "")).toBe(false);
  });

  it("trata hash corrompido como 'não confere', sem explodir", async () => {
    expect(await hasher.verify("nao-e-um-hash", SENHA)).toBe(false);
    expect(await hasher.verify("", SENHA)).toBe(false);
  });

  it("fakeVerify custa o mesmo que uma verificação real", async () => {
    const guardado = await hasher.hash(SENHA);

    const medir = async (fn: () => Promise<unknown>): Promise<number> => {
      const inicio = process.hrtime.bigint();
      await fn();
      return Number(process.hrtime.bigint() - inicio) / 1e6;
    };

    const real = await medir(() => hasher.verify(guardado, "senha-errada-mesmo"));
    const falsa = await medir(() => hasher.fakeVerify());

    // Se o hash descartável fosse inválido, `fakeVerify` retornaria quase
    // instantaneamente e o login vazaria quais e-mails existem pelo relógio.
    expect(falsa).toBeGreaterThan(real / 3);
  });
});
