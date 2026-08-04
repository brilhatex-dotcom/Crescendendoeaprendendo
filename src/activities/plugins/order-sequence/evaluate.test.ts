import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import {
  evaluateOrderSequence,
  probabilidadeDeChuteOrderSequence,
} from "./evaluate";
import { orderSequenceConfigSchema, type OrderSequenceConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 9000,
  locale: "pt-BR",
};

const CONFIG: OrderSequenceConfig = orderSequenceConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Coloque os números do menor para o maior.",
  itens: [
    { id: "n2", texto: "2" },
    { id: "n5", texto: "5" },
    { id: "n7", texto: "7" },
    { id: "n9", texto: "9" },
  ],
  ordemCorreta: ["n2", "n5", "n7", "n9"],
  mensagemDeAcerto: "Perfeito! Do menor para o maior.",
  ensino: "Procure sempre o menor número que sobrou e coloque na frente.",
  ensinoParcial: "Você já organizou boa parte! Veja qual número saiu do lugar.",
  dicas: ["Qual é o menor de todos?"],
  equivoco: "ordem-crescente-parcial",
});

describe("ordenação — acerto", () => {
  it("celebra a ordem exata", () => {
    const r = evaluateOrderSequence(CONFIG, { ordem: ["n2", "n5", "n7", "n9"] }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.mensagem).toBe("Perfeito! Do menor para o maior.");
  });
});

describe("ordenação — crédito parcial mede ordem RELATIVA", () => {
  /**
   * O caso que justifica a escolha do algoritmo: a criança entendeu a ordem
   * inteira, só colocou um item no lugar errado. Contar "posições exatas" daria
   * quase zero por causa do deslocamento; medir ordem relativa dá o que ela de
   * fato demonstrou.
   */
  it("não pune o deslocamento causado por um item fora de lugar", () => {
    const r = evaluateOrderSequence(CONFIG, { ordem: ["n9", "n2", "n5", "n7"] }, CTX);

    // n2, n5, n7 seguem em ordem relativa correta → 3 de 4.
    expect(r.scoreRatio).toBe(0.75);
    expect(r.outcome).toBe("PARTIAL");
  });

  it("reconhece o que já foi feito, com o ensino parcial", () => {
    const r = evaluateOrderSequence(CONFIG, { ordem: ["n9", "n2", "n5", "n7"] }, CTX);

    expect(r.feedback?.tom).toBe("QUASE");
    expect(r.feedback?.mensagem).toBe("Você acertou 3 de 4 na ordem certa.");
    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Você já organizou boa parte! Veja qual número saiu do lugar.",
    );
  });

  it("cai para INCORRECT abaixo do limiar — elogio vazio não ajuda", () => {
    // Ordem totalmente invertida: só 1 item forma sequência crescente.
    const r = evaluateOrderSequence(CONFIG, { ordem: ["n9", "n7", "n5", "n2"] }, CTX);

    expect(r.scoreRatio).toBe(0.25);
    expect(r.outcome).toBe("INCORRECT");
  });

  it("respeita o limiar declarado no conteúdo", () => {
    const exigente = orderSequenceConfigSchema.parse({ ...CONFIG, limiarParcial: 0.8 });
    const r = evaluateOrderSequence(exigente, { ordem: ["n9", "n2", "n5", "n7"] }, CTX);

    // 0.75 < 0.8 → deixa de ser "quase".
    expect(r.outcome).toBe("INCORRECT");
  });

  it("usa o ensino geral quando não há ensino parcial escrito", () => {
    const semParcial = orderSequenceConfigSchema.parse({
      ...CONFIG,
      ensinoParcial: undefined,
    });
    const r = evaluateOrderSequence(semParcial, { ordem: ["n9", "n2", "n5", "n7"] }, CTX);

    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Procure sempre o menor número que sobrou e coloque na frente.",
    );
  });
});

describe("ordenação — nunca deixa de ensinar", () => {
  it("todo desfecho não-acerto traz ensino (docs/08 §12.3)", () => {
    const respostas = [
      ["n9", "n7", "n5", "n2"],
      ["n9", "n2", "n5", "n7"],
      ["n5", "n2", "n9", "n7"],
      ["n2", "n5"],
    ];

    for (const ordem of respostas) {
      const r = evaluateOrderSequence(CONFIG, { ordem }, CTX);
      if (r.outcome === "CORRECT" || r.outcome === "SKIPPED") continue;
      expect(r.feedback.ensino.length).toBeGreaterThan(0);
    }
  });

  it("resposta incompleta não pode ser acerto", () => {
    const r = evaluateOrderSequence(CONFIG, { ordem: ["n2", "n5"] }, CTX);
    expect(r.outcome).not.toBe("CORRECT");
  });
});

describe("ordenação — casos de borda", () => {
  it("lista vazia é pulo, não erro", () => {
    const r = evaluateOrderSequence(CONFIG, { ordem: [] }, CTX);
    expect(r.outcome).toBe("SKIPPED");
    expect(r.feedback).toBeUndefined();
  });

  it("id desconhecido orienta sem culpar", () => {
    const r = evaluateOrderSequence(CONFIG, { ordem: ["n2", "fantasma"] }, CTX);
    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("ORIENTA");
  });

  it("aponta ao renderer o que está fora do lugar", () => {
    const r = evaluateOrderSequence(CONFIG, { ordem: ["n9", "n2", "n5", "n7"] }, CTX);
    expect(r.detalhes).toMatchObject({ itensEmOrdem: 3, total: 4 });
    expect((r.detalhes as { posicoesForaDeLugar: number[] }).posicoesForaDeLugar).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("é pura", () => {
    const a = evaluateOrderSequence(CONFIG, { ordem: ["n5", "n2", "n7", "n9"] }, CTX);
    const b = evaluateOrderSequence(CONFIG, { ordem: ["n5", "n2", "n7", "n9"] }, CTX);
    expect(a).toEqual(b);
  });
});

describe("ordenação — probabilidade de chute (BKT)", () => {
  it("é 1/n!, muito menor que a de múltipla escolha", () => {
    expect(probabilidadeDeChuteOrderSequence(CONFIG)).toBeCloseTo(1 / 24);

    const tres = orderSequenceConfigSchema.parse({
      ...CONFIG,
      itens: CONFIG.itens.slice(0, 3),
      ordemCorreta: ["n2", "n5", "n7"],
    });
    expect(probabilidadeDeChuteOrderSequence(tres)).toBeCloseTo(1 / 6);
  });
});

describe("ordenação — o schema recusa gabarito inconsistente", () => {
  function erros(config: unknown): string {
    const r = orderSequenceConfigSchema.safeParse(config);
    return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
  }

  it("recusa ordem que cita id inexistente", () => {
    expect(erros({ ...CONFIG, ordemCorreta: ["n2", "n5", "n7", "n42"] })).toContain("n42");
  });

  it("recusa ordem com tamanho diferente do número de itens", () => {
    expect(erros({ ...CONFIG, ordemCorreta: ["n2", "n5"] })).toContain("2 ids");
  });

  it("recusa id repetido na ordem correta", () => {
    expect(erros({ ...CONFIG, ordemCorreta: ["n2", "n2", "n7", "n9"] })).toContain("repete");
  });

  it("exige ensino — não é opcional", () => {
    expect(erros({ ...CONFIG, ensino: undefined })).not.toBe("");
  });
});
