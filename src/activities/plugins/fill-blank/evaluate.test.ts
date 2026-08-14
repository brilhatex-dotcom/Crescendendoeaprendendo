import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import { evaluateFillBlank, probabilidadeDeChuteFillBlank } from "./evaluate";
import { fillBlankConfigSchema, type FillBlankConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 6000,
  locale: "pt-BR",
};

const CONFIG: FillBlankConfig = fillBlankConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Cinco mais dois é ___.",
  opcoes: [
    { id: "sete", texto: "sete", correta: true },
    { id: "seis", texto: "seis", correta: false, ensino: "Conte de novo, começando do 5: 6, 7. Você parou cedo demais.", equivoco: "parou-antes-do-ultimo" },
    { id: "oito", texto: "oito", correta: false, ensino: "Conte de novo, começando do 5: 6, 7. Você foi longe demais.", equivoco: "contou-em-dobro" },
  ],
  mensagemDeAcerto: "Isso! Cinco mais dois é sete.",
  dicas: ["Conte nos dedos, começando do 5."],
});

describe("completar a lacuna — acerto", () => {
  it("celebra quando a criança escolhe a palavra certa", () => {
    const r = evaluateFillBlank(CONFIG, { opcaoId: "sete" }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.mensagem).toBe("Isso! Cinco mais dois é sete.");
  });
});

describe("completar a lacuna — nunca deixa de ensinar", () => {
  it("toda opção errada vem com ensino (docs/08 §12.3)", () => {
    for (const opcaoId of ["seis", "oito"]) {
      const r = evaluateFillBlank(CONFIG, { opcaoId }, CTX);
      expect(r.outcome).toBe("INCORRECT");
      expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino.length : 0).toBeGreaterThan(0);
    }
  });

  it("sem dica usada, o tom é QUASE; depois de uma dica, ORIENTA", () => {
    const semDica = evaluateFillBlank(CONFIG, { opcaoId: "seis" }, CTX);
    expect(semDica.feedback?.tom).toBe("QUASE");

    const comDica = evaluateFillBlank(CONFIG, { opcaoId: "seis" }, { ...CTX, dicasUsadas: 1 });
    expect(comDica.feedback?.tom).toBe("ORIENTA");
  });

  it("carrega o equívoco declarado no conteúdo", () => {
    const r = evaluateFillBlank(CONFIG, { opcaoId: "seis" }, CTX);
    expect("equivoco" in r ? r.equivoco : undefined).toBe("parou-antes-do-ultimo");
  });
});

describe("completar a lacuna — casos de borda", () => {
  it("pular é SKIPPED, não erro", () => {
    const r = evaluateFillBlank(CONFIG, { opcaoId: null }, CTX);
    expect(r.outcome).toBe("SKIPPED");
    expect(r.feedback).toBeUndefined();
  });

  it("id desconhecido orienta sem culpar", () => {
    const r = evaluateFillBlank(CONFIG, { opcaoId: "fantasma" }, CTX);
    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("ORIENTA");
  });

  it("aponta ao renderer a opção escolhida e a correta, nos dois desfechos", () => {
    const acerto = evaluateFillBlank(CONFIG, { opcaoId: "sete" }, CTX);
    expect(acerto.detalhes).toEqual({ opcaoEscolhida: "sete", opcaoCorreta: "sete", acertou: true });

    const erro = evaluateFillBlank(CONFIG, { opcaoId: "seis" }, CTX);
    expect(erro.detalhes).toEqual({ opcaoEscolhida: "seis", opcaoCorreta: "sete", acertou: false });
  });

  it("é pura", () => {
    const a = evaluateFillBlank(CONFIG, { opcaoId: "seis" }, CTX);
    const b = evaluateFillBlank(CONFIG, { opcaoId: "seis" }, CTX);
    expect(a).toEqual(b);
  });
});

describe("completar a lacuna — probabilidade de chute (BKT)", () => {
  it("é 1/n opções do banco", () => {
    expect(probabilidadeDeChuteFillBlank(CONFIG)).toBeCloseTo(1 / 3);
  });
});

describe("completar a lacuna — o schema exige o essencial", () => {
  function erros(config: unknown): string {
    const r = fillBlankConfigSchema.safeParse(config);
    return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
  }

  it("recusa enunciado sem o marcador de lacuna", () => {
    expect(erros({ ...CONFIG, enunciado: "Cinco mais dois é sete." })).toContain("___");
  });

  it("recusa mais de uma opção correta", () => {
    expect(
      erros({
        ...CONFIG,
        opcoes: CONFIG.opcoes.map((o) => ({ ...o, correta: true })),
      }),
    ).not.toBe("");
  });

  it("recusa opção incorreta sem ensino", () => {
    expect(
      erros({
        ...CONFIG,
        opcoes: [
          { id: "sete", texto: "sete", correta: true },
          { id: "seis", texto: "seis", correta: false },
        ],
      }),
    ).toContain("ensino");
  });

  it("recusa id de opção repetido", () => {
    expect(
      erros({ ...CONFIG, opcoes: [...CONFIG.opcoes, { id: "sete", texto: "nove", correta: false, ensino: "x" }] }),
    ).toContain("repetidos");
  });
});
