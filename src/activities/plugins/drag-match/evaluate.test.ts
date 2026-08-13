import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import { evaluateDragMatch, probabilidadeDeChuteDragMatch } from "./evaluate";
import { dragMatchConfigSchema, type DragMatchConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 9000,
  locale: "pt-BR",
};

const CONFIG: DragMatchConfig = dragMatchConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Combine cada número com a quantidade certa.",
  pares: [
    { id: "um", esquerda: "1", direita: "🐚" },
    { id: "dois", esquerda: "2", direita: "🐚🐚" },
    { id: "tres", esquerda: "3", direita: "🐚🐚🐚" },
    { id: "quatro", esquerda: "4", direita: "🐚🐚🐚🐚" },
  ],
  mensagemDeAcerto: "Isso! Todo mundo encontrou seu par.",
  ensino: "Conte as conchas de cada grupo e procure o número igual.",
  ensinoParcial: "Alguns pares já estão certos! Olhe os que ainda não combinam.",
  dicas: ["Conte devagar, uma concha de cada vez."],
  equivoco: "pareamento-por-posicao",
});

describe("parear — acerto", () => {
  it("celebra quando todos os pares estão certos", () => {
    const r = evaluateDragMatch(
      CONFIG,
      { pareamentos: { um: "um", dois: "dois", tres: "tres", quatro: "quatro" } },
      CTX,
    );

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.mensagem).toBe("Isso! Todo mundo encontrou seu par.");
  });
});

describe("parear — crédito parcial", () => {
  it("mede a fração de pares certos", () => {
    const r = evaluateDragMatch(
      CONFIG,
      { pareamentos: { um: "um", dois: "dois", tres: "quatro", quatro: "tres" } },
      CTX,
    );

    expect(r.scoreRatio).toBe(0.5);
    expect(r.outcome).toBe("PARTIAL");
  });

  it("reconhece o que já foi feito, com o ensino parcial", () => {
    const r = evaluateDragMatch(
      CONFIG,
      { pareamentos: { um: "um", dois: "dois", tres: "quatro", quatro: "tres" } },
      CTX,
    );

    expect(r.feedback?.tom).toBe("QUASE");
    expect(r.feedback?.mensagem).toBe("Você acertou 2 de 4 pares.");
    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Alguns pares já estão certos! Olhe os que ainda não combinam.",
    );
  });

  it("cai para INCORRECT abaixo do limiar", () => {
    const r = evaluateDragMatch(
      CONFIG,
      { pareamentos: { um: "dois", dois: "tres", tres: "quatro", quatro: "um" } },
      CTX,
    );

    expect(r.scoreRatio).toBe(0);
    expect(r.outcome).toBe("INCORRECT");
  });

  it("respeita o limiar declarado no conteúdo", () => {
    const exigente = dragMatchConfigSchema.parse({ ...CONFIG, limiarParcial: 0.8 });
    const r = evaluateDragMatch(
      exigente,
      { pareamentos: { um: "um", dois: "dois", tres: "quatro", quatro: "tres" } },
      CTX,
    );

    // 0.5 < 0.8 → deixa de ser "quase".
    expect(r.outcome).toBe("INCORRECT");
  });

  it("usa o ensino geral quando não há ensino parcial escrito", () => {
    const semParcial = dragMatchConfigSchema.parse({ ...CONFIG, ensinoParcial: undefined });
    const r = evaluateDragMatch(
      semParcial,
      { pareamentos: { um: "um", dois: "dois", tres: "quatro", quatro: "tres" } },
      CTX,
    );

    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Conte as conchas de cada grupo e procure o número igual.",
    );
  });
});

describe("parear — pareamento parcial (nem todo par tocado)", () => {
  it("não pode ser CORRECT se faltou parear algum", () => {
    const r = evaluateDragMatch(CONFIG, { pareamentos: { um: "um", dois: "dois" } }, CTX);
    expect(r.outcome).not.toBe("CORRECT");
    expect(r.scoreRatio).toBe(0.5);
  });
});

describe("parear — nunca deixa de ensinar", () => {
  it("todo desfecho não-acerto traz ensino (docs/08 §12.3)", () => {
    const respostas: Record<string, string>[] = [
      { um: "dois", dois: "tres", tres: "quatro", quatro: "um" },
      { um: "um", dois: "dois", tres: "quatro", quatro: "tres" },
      { um: "um" },
    ];

    for (const pareamentos of respostas) {
      const r = evaluateDragMatch(CONFIG, { pareamentos }, CTX);
      if (r.outcome === "CORRECT" || r.outcome === "SKIPPED") continue;
      expect(r.feedback.ensino.length).toBeGreaterThan(0);
    }
  });
});

describe("parear — casos de borda", () => {
  it("nenhum pareamento é pulo, não erro", () => {
    const r = evaluateDragMatch(CONFIG, { pareamentos: {} }, CTX);
    expect(r.outcome).toBe("SKIPPED");
    expect(r.feedback).toBeUndefined();
  });

  it("id desconhecido orienta sem culpar", () => {
    const r = evaluateDragMatch(CONFIG, { pareamentos: { fantasma: "um" } }, CTX);
    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("ORIENTA");
  });

  it("aponta ao renderer quais pares estão certos", () => {
    const r = evaluateDragMatch(
      CONFIG,
      { pareamentos: { um: "um", dois: "tres" } },
      CTX,
    );
    expect(r.detalhes).toMatchObject({ acertos: 1, total: 4 });
    const pares = (r.detalhes as { pares: { id: string; correto: boolean }[] }).pares;
    expect(pares.find((p) => p.id === "um")?.correto).toBe(true);
    expect(pares.find((p) => p.id === "dois")?.correto).toBe(false);
    expect(pares.find((p) => p.id === "tres")?.correto).toBe(false);
  });

  it("é pura", () => {
    const a = evaluateDragMatch(CONFIG, { pareamentos: { um: "dois", dois: "um" } }, CTX);
    const b = evaluateDragMatch(CONFIG, { pareamentos: { um: "dois", dois: "um" } }, CTX);
    expect(a).toEqual(b);
  });
});

describe("parear — probabilidade de chute (BKT)", () => {
  it("é 1/n!, mesma matemática de ORDER_SEQUENCE", () => {
    expect(probabilidadeDeChuteDragMatch(CONFIG)).toBeCloseTo(1 / 24);

    const tres = dragMatchConfigSchema.parse({ ...CONFIG, pares: CONFIG.pares.slice(0, 3) });
    expect(probabilidadeDeChuteDragMatch(tres)).toBeCloseTo(1 / 6);
  });
});

describe("parear — o schema exige o essencial", () => {
  function erros(config: unknown): string {
    const r = dragMatchConfigSchema.safeParse(config);
    return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
  }

  it("recusa id de par repetido", () => {
    expect(
      erros({ ...CONFIG, pares: [...CONFIG.pares, { id: "um", esquerda: "5", direita: "🐚" }] }),
    ).toContain("repetidos");
  });

  it("recusa menos de 2 pares", () => {
    expect(erros({ ...CONFIG, pares: [CONFIG.pares[0]] })).not.toBe("");
  });

  it("recusa mais de 6 pares", () => {
    const muitos = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      esquerda: String(i),
      direita: "🐚".repeat(i + 1),
    }));
    expect(erros({ ...CONFIG, pares: muitos })).not.toBe("");
  });

  it("exige ensino — não é opcional", () => {
    expect(erros({ ...CONFIG, ensino: undefined })).not.toBe("");
  });
});
