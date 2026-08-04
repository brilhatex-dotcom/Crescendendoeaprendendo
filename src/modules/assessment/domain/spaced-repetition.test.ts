import { describe, expect, it } from "vitest";

import {
  SM2,
  diasEntre,
  proximaRevisao,
  qualidadeDaResposta,
  type EstadoDeRevisao,
} from "./spaced-repetition";

const AGORA = new Date("2026-03-01T10:00:00Z");

const diasAte = (data: Date): number =>
  Math.round((data.getTime() - AGORA.getTime()) / (24 * 60 * 60 * 1000));

describe("qualidade da resposta", () => {
  it("acerto limpo é a nota máxima", () => {
    expect(qualidadeDaResposta("CORRECT", 1, 0)).toBe(5);
  });

  it("acertar com dicas nunca vira recaída", () => {
    // Pedir ajuda é comportamento que o produto quer ensinar (docs/08 §1). O
    // que a dica reduz é o crescimento do intervalo, não a validade do acerto.
    for (const dicas of [1, 2, 5, 10]) {
      expect(qualidadeDaResposta("CORRECT", 1, dicas)).toBeGreaterThanOrEqual(
        SM2.limiarDeRecaida,
      );
    }
  });

  it("errar é recaída, mas nunca branco total — houve ensino junto", () => {
    expect(qualidadeDaResposta("INCORRECT", 0, 0)).toBe(1);
    expect(qualidadeDaResposta("TIMEOUT", 0, 0)).toBe(1);
  });

  it("acerto parcial depende de quanto foi acertado", () => {
    expect(qualidadeDaResposta("PARTIAL", 0.8, 0)).toBeGreaterThanOrEqual(SM2.limiarDeRecaida);
    expect(qualidadeDaResposta("PARTIAL", 0.2, 0)).toBeLessThan(SM2.limiarDeRecaida);
  });
});

describe("agendamento", () => {
  it("a primeira revisão é no dia seguinte", () => {
    const cartao = proximaRevisao(null, 5, AGORA);
    expect(cartao.intervaloDias).toBe(1);
    expect(diasAte(cartao.venceEm)).toBe(1);
  });

  it("acertos seguidos afastam a revisão: 1 → 6 → mais", () => {
    let cartao = proximaRevisao(null, 5, AGORA);
    expect(cartao.intervaloDias).toBe(1);

    cartao = proximaRevisao(cartao, 5, AGORA);
    expect(cartao.intervaloDias).toBe(SM2.segundoIntervaloDias);

    const terceiro = proximaRevisao(cartao, 5, AGORA);
    expect(terceiro.intervaloDias).toBeGreaterThan(SM2.segundoIntervaloDias);
  });

  it("o intervalo cresce estritamente, mesmo com a facilidade no piso", () => {
    let cartao: EstadoDeRevisao = {
      intervaloDias: 10,
      facilidade: SM2.facilidadeMinima,
      venceEm: AGORA,
      recaidas: 0,
    };

    for (let i = 0; i < 10; i += 1) {
      const anterior = cartao.intervaloDias;
      cartao = proximaRevisao(cartao, 3, AGORA);
      if (anterior < SM2.intervaloMaximoDias) {
        expect(cartao.intervaloDias).toBeGreaterThan(anterior);
      }
    }
  });

  it("nunca ultrapassa o teto — revisão daqui a dois anos é revisão nenhuma", () => {
    let cartao = proximaRevisao(null, 5, AGORA);
    for (let i = 0; i < 40; i += 1) {
      cartao = proximaRevisao(cartao, 5, AGORA);
    }
    expect(cartao.intervaloDias).toBe(SM2.intervaloMaximoDias);
  });

  it("recair devolve a revisão para o dia seguinte e conta a recaída", () => {
    const maduro: EstadoDeRevisao = {
      intervaloDias: 45,
      facilidade: 2.6,
      venceEm: AGORA,
      recaidas: 1,
    };

    const depois = proximaRevisao(maduro, 1, AGORA);

    expect(depois.intervaloDias).toBe(1);
    expect(depois.recaidas).toBe(2);
    // A facilidade cai, mas não é zerada: punir duas vezes o mesmo tropeço
    // faria o cartão levar semanas para voltar ao ritmo.
    expect(depois.facilidade).toBeLessThan(maduro.facilidade);
    expect(depois.facilidade).toBeGreaterThanOrEqual(SM2.facilidadeMinima);
  });

  it("a facilidade nunca desce abaixo do piso do SM-2", () => {
    let cartao = proximaRevisao(null, 0, AGORA);
    for (let i = 0; i < 30; i += 1) {
      cartao = proximaRevisao(cartao, 0, AGORA);
    }
    expect(cartao.facilidade).toBe(SM2.facilidadeMinima);
  });

  it("acertar com folga aumenta a facilidade", () => {
    const cartao = proximaRevisao(null, 5, AGORA);
    expect(cartao.facilidade).toBeGreaterThan(SM2.facilidadeInicial);
  });
});

describe("diasEntre", () => {
  it("sem início, não há tempo decorrido", () => {
    expect(diasEntre(null, AGORA)).toBe(0);
  });

  it("conta frações de dia", () => {
    expect(diasEntre(new Date("2026-02-28T22:00:00Z"), AGORA)).toBeCloseTo(0.5, 5);
  });

  it("nunca é negativo", () => {
    expect(diasEntre(new Date("2026-04-01T00:00:00Z"), AGORA)).toBe(0);
  });
});
