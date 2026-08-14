import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import { evaluateMultiSelect, probabilidadeDeChuteMultiSelect } from "./evaluate";
import { multiSelectConfigSchema, type MultiSelectConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 9000,
  locale: "pt-BR",
};

const CONFIG: MultiSelectConfig = multiSelectConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Toque em todos os números pares.",
  opcoes: [
    { id: "dois", texto: "2", correta: true },
    { id: "tres", texto: "3", correta: false },
    { id: "quatro", texto: "4", correta: true },
    { id: "cinco", texto: "5", correta: false },
  ],
  mensagemDeAcerto: "Isso! Achou todos os pares.",
  ensino: "Um número par termina em 0, 2, 4, 6 ou 8.",
  ensinoParcial: "Você já achou alguns! Confira os que faltam e os que sobraram.",
  dicas: ["Conte de 2 em 2: 2, 4, 6…"],
  equivoco: "confundiu-par-e-impar",
});

describe("múltipla seleção — acerto", () => {
  it("celebra quando a criança marca exatamente as opções certas", () => {
    const r = evaluateMultiSelect(CONFIG, { opcaoIds: ["dois", "quatro"] }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.mensagem).toBe("Isso! Achou todos os pares.");
  });

  it("marcar na ordem inversa também é acerto — não é sequência", () => {
    const r = evaluateMultiSelect(CONFIG, { opcaoIds: ["quatro", "dois"] }, CTX);
    expect(r.outcome).toBe("CORRECT");
  });
});

describe("múltipla seleção — crédito parcial", () => {
  it("deixar uma opção errada em branco já conta como acerto sobre ela", () => {
    // Marcou só "dois" (certo): dois✓, três(em branco, errado)✓, quatro(faltou)✗, cinco(em branco, errado)✓.
    const r = evaluateMultiSelect(CONFIG, { opcaoIds: ["dois"] }, CTX);

    expect(r.scoreRatio).toBe(0.75);
    expect(r.outcome).toBe("PARTIAL");
  });

  it("reconhece o que já foi feito, com o ensino parcial", () => {
    const r = evaluateMultiSelect(CONFIG, { opcaoIds: ["dois"] }, CTX);

    expect(r.feedback?.tom).toBe("QUASE");
    expect(r.feedback?.mensagem).toBe("Você acertou 3 de 4.");
    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Você já achou alguns! Confira os que faltam e os que sobraram.",
    );
  });

  it("marcar tudo errado zera o placar", () => {
    const r = evaluateMultiSelect(CONFIG, { opcaoIds: ["tres", "cinco"] }, CTX);

    expect(r.scoreRatio).toBe(0);
    expect(r.outcome).toBe("INCORRECT");
  });

  it("respeita o limiar declarado no conteúdo", () => {
    const exigente = multiSelectConfigSchema.parse({ ...CONFIG, limiarParcial: 0.9 });
    const r = evaluateMultiSelect(exigente, { opcaoIds: ["dois"] }, CTX);

    // 0.75 < 0.9 → deixa de ser "quase".
    expect(r.outcome).toBe("INCORRECT");
  });

  it("usa o ensino geral quando não há ensino parcial escrito", () => {
    const semParcial = multiSelectConfigSchema.parse({ ...CONFIG, ensinoParcial: undefined });
    const r = evaluateMultiSelect(semParcial, { opcaoIds: ["dois"] }, CTX);

    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Um número par termina em 0, 2, 4, 6 ou 8.",
    );
  });
});

describe("múltipla seleção — nunca deixa de ensinar", () => {
  it("todo desfecho não-acerto traz ensino (docs/08 §12.3)", () => {
    const respostas: string[][] = [["tres", "cinco"], ["dois"], ["tres"]];

    for (const opcaoIds of respostas) {
      const r = evaluateMultiSelect(CONFIG, { opcaoIds }, CTX);
      if (r.outcome === "CORRECT" || r.outcome === "SKIPPED") continue;
      expect(r.feedback.ensino.length).toBeGreaterThan(0);
    }
  });
});

describe("múltipla seleção — casos de borda", () => {
  it("nenhuma opção marcada é pulo, não erro", () => {
    const r = evaluateMultiSelect(CONFIG, { opcaoIds: [] }, CTX);
    expect(r.outcome).toBe("SKIPPED");
    expect(r.feedback).toBeUndefined();
  });

  it("id desconhecido orienta sem culpar", () => {
    const r = evaluateMultiSelect(CONFIG, { opcaoIds: ["fantasma"] }, CTX);
    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("ORIENTA");
  });

  it("aponta ao renderer quais opções estão certas", () => {
    const r = evaluateMultiSelect(CONFIG, { opcaoIds: ["dois", "tres"] }, CTX);

    expect(r.detalhes).toMatchObject({ acertos: 2, total: 4 });
    const opcoes = (r.detalhes as { opcoes: { id: string; escolhida: boolean; correta: boolean }[] })
      .opcoes;
    expect(opcoes.find((o) => o.id === "dois")).toMatchObject({ escolhida: true, correta: true });
    expect(opcoes.find((o) => o.id === "tres")).toMatchObject({ escolhida: true, correta: false });
    expect(opcoes.find((o) => o.id === "quatro")).toMatchObject({ escolhida: false, correta: true });
  });

  it("é pura", () => {
    const a = evaluateMultiSelect(CONFIG, { opcaoIds: ["dois", "tres"] }, CTX);
    const b = evaluateMultiSelect(CONFIG, { opcaoIds: ["dois", "tres"] }, CTX);
    expect(a).toEqual(b);
  });
});

describe("múltipla seleção — probabilidade de chute (BKT)", () => {
  it("é 1/2^n — cada opção é uma moeda independente", () => {
    expect(probabilidadeDeChuteMultiSelect(CONFIG)).toBeCloseTo(1 / 16);

    const tres = multiSelectConfigSchema.parse({ ...CONFIG, opcoes: CONFIG.opcoes.slice(0, 3) });
    expect(probabilidadeDeChuteMultiSelect(tres)).toBeCloseTo(1 / 8);
  });
});

describe("múltipla seleção — o schema exige o essencial", () => {
  function erros(config: unknown): string {
    const r = multiSelectConfigSchema.safeParse(config);
    return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
  }

  it("recusa id de opção repetido", () => {
    expect(
      erros({ ...CONFIG, opcoes: [...CONFIG.opcoes, { id: "dois", texto: "6", correta: true }] }),
    ).toContain("repetidos");
  });

  it("recusa menos de duas opções corretas", () => {
    expect(
      erros({
        ...CONFIG,
        opcoes: [
          { id: "a", texto: "1", correta: true },
          { id: "b", texto: "2", correta: false },
          { id: "c", texto: "3", correta: false },
        ],
      }),
    ).toContain("MULTIPLE_CHOICE");
  });

  it("recusa nenhuma opção correta", () => {
    expect(
      erros({ ...CONFIG, opcoes: CONFIG.opcoes.map((o) => ({ ...o, correta: false })) }),
    ).not.toBe("");
  });

  it("recusa menos de 3 opções", () => {
    expect(erros({ ...CONFIG, opcoes: CONFIG.opcoes.slice(0, 2) })).not.toBe("");
  });

  it("recusa mais de 6 opções", () => {
    const muitas = Array.from({ length: 7 }, (_, i) => ({
      id: `o${i}`,
      texto: String(i),
      correta: i < 2,
    }));
    expect(erros({ ...CONFIG, opcoes: muitas })).not.toBe("");
  });

  it("exige ensino — não é opcional", () => {
    expect(erros({ ...CONFIG, ensino: undefined })).not.toBe("");
  });
});
