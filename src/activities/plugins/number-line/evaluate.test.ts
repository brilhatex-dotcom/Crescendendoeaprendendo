import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import { evaluateNumberLine, probabilidadeDeChuteNumberLine } from "./evaluate";
import { numberLineConfigSchema, type NumberLineConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 9000,
  locale: "pt-BR",
};

const CONFIG: NumberLineConfig = numberLineConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Toque no número 7 na reta numérica.",
  minimo: 0,
  maximo: 10,
  valorCorreto: 7,
  mensagemDeAcerto: "Isso! O 7 fica bem aí.",
  ensino: "Conte devagar a partir do 0, apontando cada número, até chegar no 7.",
  ensinoParcial: "Você tocou bem perto! Conte de novo devagar para achar o lugar exato.",
  dicas: ["Comece do 0 e conte para a frente."],
  equivoco: "posicao-proxima-mas-nao-exata",
});

describe("reta numérica — acerto", () => {
  it("celebra a posição exata", () => {
    const r = evaluateNumberLine(CONFIG, { valor: 7 }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.mensagem).toBe("Isso! O 7 fica bem aí.");
  });
});

describe("reta numérica — crédito parcial mede distância", () => {
  it("toque a 1 de distância vale quase tudo", () => {
    // Pior distância possível a partir de 7 em [0,10] é max(7,3) = 7.
    const r = evaluateNumberLine(CONFIG, { valor: 6 }, CTX);

    expect(r.scoreRatio).toBeCloseTo(1 - 1 / 7);
    expect(r.outcome).toBe("PARTIAL");
  });

  it("reconhece o que já foi feito, com o ensino parcial", () => {
    const r = evaluateNumberLine(CONFIG, { valor: 6 }, CTX);
    expect(r.feedback?.tom).toBe("QUASE");
  });

  it("toque no extremo oposto cai para INCORRECT — elogio vazio não ajuda", () => {
    const r = evaluateNumberLine(CONFIG, { valor: 0 }, CTX);

    expect(r.scoreRatio).toBe(0);
    expect(r.outcome).toBe("INCORRECT");
  });

  it("respeita o limiar declarado no conteúdo", () => {
    const exigente = numberLineConfigSchema.parse({ ...CONFIG, limiarParcial: 0.95 });
    const r = evaluateNumberLine(exigente, { valor: 6 }, CTX);

    // 1 − 1/7 ≈ 0.857 < 0.95.
    expect(r.outcome).toBe("INCORRECT");
  });

  it("usa o ensino geral quando não há ensino parcial escrito", () => {
    const semParcial = numberLineConfigSchema.parse({ ...CONFIG, ensinoParcial: undefined });
    const r = evaluateNumberLine(semParcial, { valor: 6 }, CTX);

    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Conte devagar a partir do 0, apontando cada número, até chegar no 7.",
    );
  });
});

describe("reta numérica — nunca deixa de ensinar", () => {
  it("todo desfecho não-acerto traz ensino (docs/08 §12.3)", () => {
    for (const valor of [0, 1, 3, 5, 6, 8, 10]) {
      const r = evaluateNumberLine(CONFIG, { valor }, CTX);
      if (r.outcome === "CORRECT" || r.outcome === "SKIPPED") continue;
      expect(r.feedback.ensino.length).toBeGreaterThan(0);
    }
  });
});

describe("reta numérica — casos de borda", () => {
  it("resposta nula é pulo, não erro", () => {
    const r = evaluateNumberLine(CONFIG, { valor: null }, CTX);
    expect(r.outcome).toBe("SKIPPED");
    expect(r.feedback).toBeUndefined();
  });

  it("valor fora da faixa orienta sem culpar", () => {
    const r = evaluateNumberLine(CONFIG, { valor: 42 }, CTX);
    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("ORIENTA");
  });

  it("aponta ao renderer a distância e o valor certo", () => {
    const r = evaluateNumberLine(CONFIG, { valor: 6 }, CTX);
    expect(r.detalhes).toMatchObject({ valorEnviado: 6, valorCorreto: 7, distancia: 1 });
  });

  it("é pura", () => {
    const a = evaluateNumberLine(CONFIG, { valor: 6 }, CTX);
    const b = evaluateNumberLine(CONFIG, { valor: 6 }, CTX);
    expect(a).toEqual(b);
  });
});

describe("reta numérica — probabilidade de chute (BKT)", () => {
  it("é 1/n posições da faixa", () => {
    expect(probabilidadeDeChuteNumberLine(CONFIG)).toBeCloseTo(1 / 11);

    const faixaMenor = numberLineConfigSchema.parse({ ...CONFIG, minimo: 0, maximo: 4, valorCorreto: 2 });
    expect(probabilidadeDeChuteNumberLine(faixaMenor)).toBeCloseTo(1 / 5);
  });
});

describe("reta numérica — o schema recusa configuração inconsistente", () => {
  function erros(config: unknown): string {
    const r = numberLineConfigSchema.safeParse(config);
    return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
  }

  it("recusa maximo menor ou igual a minimo", () => {
    expect(erros({ ...CONFIG, minimo: 10, maximo: 10 })).toContain("maior que");
  });

  it("recusa faixa maior que 20 posições", () => {
    expect(erros({ ...CONFIG, minimo: 0, maximo: 30 })).toContain("20 posições");
  });

  it("recusa valorCorreto fora da faixa", () => {
    expect(erros({ ...CONFIG, valorCorreto: 99 })).toContain("entre");
  });

  it("exige ensino — não é opcional", () => {
    expect(erros({ ...CONFIG, ensino: undefined })).not.toBe("");
  });
});
