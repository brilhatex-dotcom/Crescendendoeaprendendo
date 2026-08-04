import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import {
  evaluateMultipleChoice,
  probabilidadeDeChuteMultipleChoice,
} from "./evaluate";
import { multipleChoiceConfigSchema, type MultipleChoiceConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 4000,
  locale: "pt-BR",
};

const CONFIG: MultipleChoiceConfig = multipleChoiceConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Quantas conchas há na areia?",
  opcoes: [
    { id: "a", texto: "3", correta: false, ensino: "Conte de novo apontando com o dedo.", equivoco: "pulou-um-item" },
    { id: "b", texto: "4", correta: true },
    { id: "c", texto: "5", correta: false, ensino: "Você contou uma concha duas vezes.", equivoco: "contou-em-dobro" },
  ],
  mensagemDeAcerto: "Isso! São 4 conchas.",
  dicas: ["Toque em cada concha enquanto conta.", "Comece pela da esquerda."],
});

describe("múltipla escolha — acerto", () => {
  it("celebra com a mensagem do conteúdo, não uma genérica", () => {
    const r = evaluateMultipleChoice(CONFIG, { opcaoId: "b" }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.tom).toBe("CELEBRA");
    expect(r.feedback?.mensagem).toBe("Isso! São 4 conchas.");
  });

  it("não anexa equívoco a quem acertou", () => {
    const r = evaluateMultipleChoice(CONFIG, { opcaoId: "b" }, CTX);
    expect("equivoco" in r ? r.equivoco : undefined).toBeUndefined();
  });
});

describe("múltipla escolha — erro sempre ensina", () => {
  it("devolve o ensino escrito para AQUELA opção", () => {
    const r = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, CTX);

    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("QUASE");
    // O ensino é específico do erro cometido, não um texto único para todos.
    expect(r.feedback && "ensino" in r.feedback ? r.feedback.ensino : "").toBe(
      "Conte de novo apontando com o dedo.",
    );
  });

  it("diagnostica o equívoco para o relatório e o tutor", () => {
    const a = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, CTX);
    const c = evaluateMultipleChoice(CONFIG, { opcaoId: "c" }, CTX);

    expect("equivoco" in a ? a.equivoco : undefined).toBe("pulou-um-item");
    expect("equivoco" in c ? c.equivoco : undefined).toBe("contou-em-dobro");
  });

  it("nenhum resultado incorreto sai sem ensino (docs/08 §12.3)", () => {
    for (const opcao of CONFIG.opcoes) {
      const r = evaluateMultipleChoice(CONFIG, { opcaoId: opcao.id }, CTX);
      if (r.outcome === "CORRECT" || r.outcome === "SKIPPED") continue;
      expect(r.feedback.ensino.length).toBeGreaterThan(0);
    }
  });

  it("passa de QUASE para ORIENTA depois que a criança pediu ajuda", () => {
    const semDica = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, CTX);
    const comDica = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, { ...CTX, dicasUsadas: 1 });

    expect(semDica.feedback?.tom).toBe("QUASE");
    expect(comDica.feedback?.tom).toBe("ORIENTA");
  });

  it("entrega a próxima dica da fila, e para quando acabam", () => {
    const primeira = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, CTX);
    const segunda = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, { ...CTX, dicasUsadas: 1 });
    const terceira = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, { ...CTX, dicasUsadas: 2 });

    expect(primeira.feedback?.dica).toBe("Toque em cada concha enquanto conta.");
    expect(segunda.feedback?.dica).toBe("Comece pela da esquerda.");
    expect(terceira.feedback?.dica).toBeUndefined();
  });
});

describe("múltipla escolha — casos de borda", () => {
  it("pular não é errar", () => {
    const r = evaluateMultipleChoice(CONFIG, { opcaoId: null }, CTX);

    expect(r.outcome).toBe("SKIPPED");
    expect(r.scoreRatio).toBe(0);
    expect(r.feedback).toBeUndefined();
  });

  it("id inexistente orienta sem culpar nem registrar equívoco", () => {
    const r = evaluateMultipleChoice(CONFIG, { opcaoId: "nao-existe" }, CTX);

    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("ORIENTA");
    expect("equivoco" in r ? r.equivoco : undefined).toBeUndefined();
  });

  it("informa ao renderer qual era a correta", () => {
    const r = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, CTX);
    expect(r.detalhes).toMatchObject({ opcaoEscolhida: "a", opcaoCorreta: "b", acertou: false });
  });

  it("o acerto também informa qual era a opção correta", () => {
    /*
     * Regressão de um defeito que só aparecia na tela: sem `opcaoCorreta` no
     * caminho do acerto, o renderer comparava a escolha com `undefined` e
     * marcava a resposta certa da criança com o coral de "tente de novo" — ao
     * lado de uma devolutiva verde dizendo "Isso!".
     *
     * Os detalhes têm a mesma forma nos dois desfechos. Quem desenha não pode
     * precisar conhecer dois contratos.
     */
    const r = evaluateMultipleChoice(CONFIG, { opcaoId: "b" }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.detalhes).toMatchObject({
      opcaoEscolhida: "b",
      opcaoCorreta: "b",
      acertou: true,
    });
  });

  it("é pura: mesma entrada, mesmo resultado", () => {
    const a = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, CTX);
    const b = evaluateMultipleChoice(CONFIG, { opcaoId: "a" }, CTX);
    expect(a).toEqual(b);
  });
});

describe("múltipla escolha — probabilidade de chute (BKT)", () => {
  it("é 1/n, então depende do número de opções", () => {
    expect(probabilidadeDeChuteMultipleChoice(CONFIG)).toBeCloseTo(1 / 3);

    const comQuatro = multipleChoiceConfigSchema.parse({
      ...CONFIG,
      opcoes: [...CONFIG.opcoes, { id: "d", texto: "6", correta: false, ensino: "Olhe de novo." }],
    });
    expect(probabilidadeDeChuteMultipleChoice(comQuatro)).toBeCloseTo(0.25);
  });
});

describe("múltipla escolha — o schema recusa conteúdo mal autorado", () => {
  function erros(config: unknown): string[] {
    const r = multipleChoiceConfigSchema.safeParse(config);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  }

  it("recusa opção incorreta sem ensino — a regra central do produto", () => {
    const mensagens = erros({
      ...CONFIG,
      opcoes: [
        { id: "a", texto: "3", correta: false },
        { id: "b", texto: "4", correta: true },
      ],
    });
    expect(mensagens.join(" ")).toContain("ensino");
  });

  it("recusa nenhuma ou mais de uma correta", () => {
    expect(
      erros({ ...CONFIG, opcoes: [{ id: "a", texto: "3", correta: false, ensino: "x" }, { id: "b", texto: "4", correta: false, ensino: "y" }] }).join(" "),
    ).toContain("Nenhuma opção correta");

    expect(
      erros({ ...CONFIG, opcoes: [{ id: "a", texto: "3", correta: true }, { id: "b", texto: "4", correta: true }] }).join(" "),
    ).toContain("MULTI_SELECT");
  });

  it("recusa ids repetidos", () => {
    expect(
      erros({
        ...CONFIG,
        opcoes: [
          { id: "a", texto: "3", correta: true },
          { id: "a", texto: "4", correta: false, ensino: "x" },
        ],
      }).join(" "),
    ).toContain("id único");
  });

  it("exige texto alternativo em toda imagem (acessibilidade)", () => {
    expect(
      multipleChoiceConfigSchema.safeParse({
        ...CONFIG,
        opcoes: [
          { id: "a", texto: "3", correta: true, imagem: { assetId: "x" } },
          { id: "b", texto: "4", correta: false, ensino: "y" },
        ],
      }).success,
    ).toBe(false);
  });
});
