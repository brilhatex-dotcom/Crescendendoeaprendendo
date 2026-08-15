import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import { evaluateMemoryPairs, probabilidadeDeChuteMemoryPairs } from "./evaluate";
import { memoryPairsConfigSchema, type MemoryPairsConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 9000,
  locale: "pt-BR",
};

const CONFIG: MemoryPairsConfig = memoryPairsConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Ache os pares de bichinhos iguais.",
  pares: [
    { id: "sapo", valor: "🐸" },
    { id: "pato", valor: "🦆" },
    { id: "leao", valor: "🦁" },
    { id: "rato", valor: "🐭" },
  ],
  mensagemDeAcerto: "Uau, memória de elefante! Achou todos com o mínimo de tentativas.",
  ensino: "Preste atenção em onde cada carta está antes de virar a próxima.",
  ensinoParcial: "Você achou todos os pares! Da próxima vez, tente lembrar onde já olhou.",
  dicas: ["Lembre onde você já viu cada carta."],
});

describe("jogo da memória — acerto perfeito", () => {
  it("celebra memória perfeita (tentativas == número de pares)", () => {
    const r = evaluateMemoryPairs(CONFIG, { tentativas: 4 }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.mensagem).toBe(
      "Uau, memória de elefante! Achou todos com o mínimo de tentativas.",
    );
  });
});

describe("jogo da memória — crédito por eficiência", () => {
  it("acima do limiar vale PARTIAL, mesmo tendo terminado o jogo", () => {
    // 4 pares em 6 tentativas: eficiência 4/6 ≈ 0.667.
    const r = evaluateMemoryPairs(CONFIG, { tentativas: 6 }, CTX);

    expect(r.scoreRatio).toBeCloseTo(4 / 6);
    expect(r.outcome).toBe("PARTIAL");
  });

  it("muitas tentativas cai para INCORRECT — mas o jogo foi concluído", () => {
    // 4 pares em 16 tentativas: eficiência 0.25.
    const r = evaluateMemoryPairs(CONFIG, { tentativas: 16 }, CTX);

    expect(r.scoreRatio).toBe(0.25);
    expect(r.outcome).toBe("INCORRECT");
  });

  it("respeita o limiar declarado no conteúdo", () => {
    const exigente = memoryPairsConfigSchema.parse({ ...CONFIG, limiarParcial: 0.9 });
    const r = evaluateMemoryPairs(exigente, { tentativas: 6 }, CTX);

    // 0.667 < 0.9.
    expect(r.outcome).toBe("INCORRECT");
  });
});

describe("jogo da memória — nunca deixa de ensinar", () => {
  it("todo desfecho não-acerto traz ensino (docs/08 §12.3)", () => {
    for (const tentativas of [5, 6, 8, 16]) {
      const r = evaluateMemoryPairs(CONFIG, { tentativas }, CTX);
      if (r.outcome === "CORRECT" || r.outcome === "SKIPPED") continue;
      expect(r.feedback.ensino.length).toBeGreaterThan(0);
    }
  });
});

describe("jogo da memória — casos de borda", () => {
  it("resposta nula é pulo, não erro", () => {
    const r = evaluateMemoryPairs(CONFIG, { tentativas: null }, CTX);
    expect(r.outcome).toBe("SKIPPED");
    expect(r.feedback).toBeUndefined();
  });

  it("menos tentativas que pares é matematicamente impossível — orienta sem culpar", () => {
    const r = evaluateMemoryPairs(CONFIG, { tentativas: 2 }, CTX);
    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("ORIENTA");
    expect(r.scoreRatio).toBe(0);
  });

  it("aponta ao renderer as tentativas e o número de pares", () => {
    const r = evaluateMemoryPairs(CONFIG, { tentativas: 6 }, CTX);
    expect(r.detalhes).toMatchObject({ tentativas: 6, numPares: 4 });
  });

  it("é pura", () => {
    const a = evaluateMemoryPairs(CONFIG, { tentativas: 6 }, CTX);
    const b = evaluateMemoryPairs(CONFIG, { tentativas: 6 }, CTX);
    expect(a).toEqual(b);
  });
});

describe("jogo da memória — probabilidade de chute (BKT)", () => {
  it("é 1/(2n-1), a chance de acertar uma comparação ao acaso", () => {
    expect(probabilidadeDeChuteMemoryPairs(CONFIG)).toBeCloseTo(1 / 7);

    const tresPares = memoryPairsConfigSchema.parse({
      ...CONFIG,
      pares: CONFIG.pares.slice(0, 3),
    });
    expect(probabilidadeDeChuteMemoryPairs(tresPares)).toBeCloseTo(1 / 5);
  });
});

describe("jogo da memória — o schema recusa configuração inconsistente", () => {
  function erros(config: unknown): string {
    const r = memoryPairsConfigSchema.safeParse(config);
    return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
  }

  it("recusa menos de 2 pares", () => {
    expect(erros({ ...CONFIG, pares: CONFIG.pares.slice(0, 1) })).not.toBe("");
  });

  it("recusa mais de 6 pares", () => {
    const setePares = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, valor: `${i}` }));
    expect(erros({ ...CONFIG, pares: setePares })).not.toBe("");
  });

  it("exige ensino — não é opcional", () => {
    expect(erros({ ...CONFIG, ensino: undefined })).not.toBe("");
  });
});
