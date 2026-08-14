import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import { evaluateTrueFalse, probabilidadeDeChuteTrueFalse } from "./evaluate";
import { trueFalseConfigSchema, type TrueFalseConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 4000,
  locale: "pt-BR",
};

const CONFIG: TrueFalseConfig = trueFalseConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Cinco é maior que três.",
  correta: true,
  mensagemDeAcerto: "Isso! 5 vem depois do 3 quando contamos.",
  ensino: "Conte nos dedos: 1, 2, 3, 4, 5. Quanto mais longe você chega, maior o número.",
  dicas: ["Pense em qual número você diz primeiro ao contar."],
  equivoco: "inverteu-a-comparacao",
});

describe("verdadeiro ou falso — acerto", () => {
  it("celebra quando a criança responde o mesmo que a afirmação", () => {
    const r = evaluateTrueFalse(CONFIG, { resposta: true }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.mensagem).toBe("Isso! 5 vem depois do 3 quando contamos.");
  });

  it("uma afirmação falsa também é celebrada quando respondida como falsa", () => {
    const falsa = trueFalseConfigSchema.parse({ ...CONFIG, correta: false });
    const r = evaluateTrueFalse(falsa, { resposta: false }, CTX);
    expect(r.outcome).toBe("CORRECT");
  });
});

describe("verdadeiro ou falso — nunca deixa de ensinar", () => {
  it("responder o oposto da afirmação vem com ensino (docs/08 §12.3)", () => {
    const r = evaluateTrueFalse(CONFIG, { resposta: false }, CTX);

    expect(r.outcome).toBe("INCORRECT");
    expect(r.scoreRatio).toBe(0);
    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Conte nos dedos: 1, 2, 3, 4, 5. Quanto mais longe você chega, maior o número.",
    );
  });

  it("sem dica usada, o tom é QUASE; depois de uma dica, ORIENTA", () => {
    const semDica = evaluateTrueFalse(CONFIG, { resposta: false }, CTX);
    expect(semDica.feedback?.tom).toBe("QUASE");

    const comDica = evaluateTrueFalse(CONFIG, { resposta: false }, { ...CTX, dicasUsadas: 1 });
    expect(comDica.feedback?.tom).toBe("ORIENTA");
  });

  it("carrega o equívoco declarado no conteúdo", () => {
    const r = evaluateTrueFalse(CONFIG, { resposta: false }, CTX);
    expect("equivoco" in r ? r.equivoco : undefined).toBe("inverteu-a-comparacao");
  });
});

describe("verdadeiro ou falso — casos de borda", () => {
  it("pular é SKIPPED, não erro", () => {
    const r = evaluateTrueFalse(CONFIG, { resposta: null }, CTX);
    expect(r.outcome).toBe("SKIPPED");
    expect(r.feedback).toBeUndefined();
  });

  it("aponta ao renderer a resposta dada e a correta", () => {
    const r = evaluateTrueFalse(CONFIG, { resposta: false }, CTX);
    expect(r.detalhes).toEqual({
      respostaDada: false,
      respostaCorreta: true,
      acertou: false,
    });
  });

  it("é pura", () => {
    const a = evaluateTrueFalse(CONFIG, { resposta: false }, CTX);
    const b = evaluateTrueFalse(CONFIG, { resposta: false }, CTX);
    expect(a).toEqual(b);
  });
});

describe("verdadeiro ou falso — probabilidade de chute (BKT)", () => {
  it("é sempre 1/2, cara ou coroa", () => {
    expect(probabilidadeDeChuteTrueFalse(CONFIG)).toBe(0.5);
  });
});

describe("verdadeiro ou falso — o schema exige o essencial", () => {
  function erros(config: unknown): string {
    const r = trueFalseConfigSchema.safeParse(config);
    return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
  }

  it("exige ensino — não é opcional", () => {
    expect(erros({ ...CONFIG, ensino: undefined })).not.toBe("");
  });

  it("exige mensagemDeAcerto", () => {
    expect(erros({ ...CONFIG, mensagemDeAcerto: "" })).not.toBe("");
  });

  it("aceita sem apoio, dicas ou equívoco — só o essencial é obrigatório", () => {
    expect(
      erros({
        schemaVersion: 1,
        enunciado: "Dois mais dois é quatro.",
        correta: true,
        mensagemDeAcerto: "Isso!",
        ensino: "Conte de novo, um de cada vez.",
      }),
    ).toBe("");
  });
});
