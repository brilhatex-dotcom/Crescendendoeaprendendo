import { describe, expect, it } from "vitest";

import { REGRAS_DE_DIMENSAO } from "../domain/dimension-rules";
import { FILTRO_POR_DIMENSAO } from "./prisma-learning-profile-repository";

/**
 * `FILTRO_POR_DIMENSAO` (Prisma `where`) é a versão executável em SQL da
 * mesma regra que `REGRAS_DE_DIMENSAO` (domínio, predicado em memória)
 * expressa em TypeScript puro. Duplicadas de propósito — o domínio não pode
 * depender de tipos do Prisma — mas nunca podem sair de sincronia: uma
 * dimensão nova declarada só do lado do domínio nunca teria dado real
 * consultado, e uma só do lado do Prisma nunca seria inferida a partir de
 * uma atividade.
 */
describe("FILTRO_POR_DIMENSAO e REGRAS_DE_DIMENSAO nunca saem de sincronia", () => {
  it("declaram exatamente o mesmo conjunto de chaves", () => {
    expect(Object.keys(FILTRO_POR_DIMENSAO).sort()).toEqual(
      Object.keys(REGRAS_DE_DIMENSAO).sort(),
    );
  });
});
