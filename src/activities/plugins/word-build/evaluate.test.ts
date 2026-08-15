import { describe, expect, it } from "vitest";

import type { EvaluationContext } from "../../contracts";
import { evaluateWordBuild, probabilidadeDeChuteWordBuild } from "./evaluate";
import { wordBuildConfigSchema, type WordBuildConfig } from "./schema";

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 9000,
  locale: "pt-BR",
};

const CONFIG: WordBuildConfig = wordBuildConfigSchema.parse({
  schemaVersion: 1,
  enunciado: "Monte a palavra GATO.",
  palavra: "GATO",
  pedacos: [
    { id: "p_g", texto: "G" },
    { id: "p_a", texto: "A" },
    { id: "p_t", texto: "T" },
    { id: "p_o", texto: "O" },
    // Iscas: letras que não entram na palavra.
    { id: "p_d", texto: "D" },
    { id: "p_b", texto: "B" },
  ],
  sequenciaCorreta: ["p_g", "p_a", "p_t", "p_o"],
  mensagemDeAcerto: "Isso! G-A-T-O.",
  ensino: "Comece pelo som que você ouve primeiro na palavra.",
  ensinoParcial: "Você já montou boa parte! Veja qual letra está fora do lugar.",
  dicas: ["Qual letra faz o primeiro som de 'gato'?"],
  equivoco: "letra-fora-de-ordem",
});

describe("montar-a-palavra — acerto", () => {
  it("celebra a palavra montada certa", () => {
    const r = evaluateWordBuild(CONFIG, { sequencia: ["p_g", "p_a", "p_t", "p_o"] }, CTX);

    expect(r.outcome).toBe("CORRECT");
    expect(r.scoreRatio).toBe(1);
    expect(r.feedback?.mensagem).toBe("Isso! G-A-T-O.");
  });
});

describe("montar-a-palavra — crédito parcial mede ordem RELATIVA", () => {
  it("não pune o deslocamento causado por uma letra fora de lugar", () => {
    const r = evaluateWordBuild(CONFIG, { sequencia: ["p_o", "p_g", "p_a", "p_t"] }, CTX);

    // g, a, t seguem em ordem relativa correta → 3 de 4.
    expect(r.scoreRatio).toBe(0.75);
    expect(r.outcome).toBe("PARTIAL");
  });

  it("reconhece o que já foi feito, com o ensino parcial", () => {
    const r = evaluateWordBuild(CONFIG, { sequencia: ["p_o", "p_g", "p_a", "p_t"] }, CTX);

    expect(r.feedback?.tom).toBe("QUASE");
    expect(r.feedback?.mensagem).toBe("Você acertou 3 de 4 letras.");
  });

  it("respeita o limiar declarado no conteúdo", () => {
    const exigente = wordBuildConfigSchema.parse({ ...CONFIG, limiarParcial: 0.8 });
    const r = evaluateWordBuild(exigente, { sequencia: ["p_o", "p_g", "p_a", "p_t"] }, CTX);

    expect(r.outcome).toBe("INCORRECT");
  });
});

describe("montar-a-palavra — iscas no banco", () => {
  it("tocar numa isca não corrompe a resposta, só custa progresso", () => {
    // p_d é isca — não pertence à sequência correta, então não conta como
    // acerto nem quebra a leitura da resposta.
    const r = evaluateWordBuild(CONFIG, { sequencia: ["p_g", "p_a", "p_d", "p_t", "p_o"] }, CTX);

    expect(r.outcome).not.toBe("SKIPPED");
    // g, a, t, o continuam em ordem relativa correta apesar da isca no meio.
    expect(r.scoreRatio).toBe(1);
    // Mas não é CORRECT: a sequência enviada tem 5 pedaços, a palavra tem 4.
    expect(r.outcome).not.toBe("CORRECT");
  });

  it("só iscas nunca vira acerto", () => {
    const r = evaluateWordBuild(CONFIG, { sequencia: ["p_d", "p_b"] }, CTX);
    expect(r.outcome).toBe("INCORRECT");
    expect(r.scoreRatio).toBe(0);
  });
});

describe("montar-a-palavra — nunca deixa de ensinar", () => {
  it("todo desfecho não-acerto traz ensino (docs/08 §12.3)", () => {
    const respostas = [
      ["p_o", "p_t", "p_a", "p_g"],
      ["p_o", "p_g", "p_a", "p_t"],
      ["p_d", "p_b"],
      ["p_g", "p_a"],
    ];

    for (const sequencia of respostas) {
      const r = evaluateWordBuild(CONFIG, { sequencia }, CTX);
      if (r.outcome === "CORRECT" || r.outcome === "SKIPPED") continue;
      expect(r.feedback.ensino.length).toBeGreaterThan(0);
    }
  });

  it("resposta incompleta não pode ser acerto", () => {
    const r = evaluateWordBuild(CONFIG, { sequencia: ["p_g", "p_a"] }, CTX);
    expect(r.outcome).not.toBe("CORRECT");
  });
});

describe("montar-a-palavra — casos de borda", () => {
  it("sequência vazia é pulo, não erro", () => {
    const r = evaluateWordBuild(CONFIG, { sequencia: [] }, CTX);
    expect(r.outcome).toBe("SKIPPED");
    expect(r.feedback).toBeUndefined();
  });

  it("id desconhecido (fora do banco desta atividade) orienta sem culpar", () => {
    const r = evaluateWordBuild(CONFIG, { sequencia: ["p_g", "fantasma"] }, CTX);
    expect(r.outcome).toBe("INCORRECT");
    expect(r.feedback?.tom).toBe("ORIENTA");
  });

  it("aponta ao renderer o que está fora do lugar", () => {
    const r = evaluateWordBuild(CONFIG, { sequencia: ["p_o", "p_g", "p_a", "p_t"] }, CTX);
    expect(r.detalhes).toMatchObject({ letrasCertas: 3, total: 4 });
    expect((r.detalhes as { posicoesForaDeLugar: number[] }).posicoesForaDeLugar).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("é pura", () => {
    const a = evaluateWordBuild(CONFIG, { sequencia: ["p_a", "p_g", "p_t", "p_o"] }, CTX);
    const b = evaluateWordBuild(CONFIG, { sequencia: ["p_a", "p_g", "p_t", "p_o"] }, CTX);
    expect(a).toEqual(b);
  });
});

describe("montar-a-palavra — probabilidade de chute (BKT)", () => {
  it("é menor que 1/n! quando há iscas no banco", () => {
    // 4 letras certas entre 6 pedaços: 1/(6·5·4·3), mais difícil que 1/4!.
    const semIscas = wordBuildConfigSchema.parse({
      ...CONFIG,
      pedacos: CONFIG.pedacos.slice(0, 4),
    });

    expect(probabilidadeDeChuteWordBuild(CONFIG)).toBeCloseTo(1 / (6 * 5 * 4 * 3));
    expect(probabilidadeDeChuteWordBuild(semIscas)).toBeCloseTo(1 / 24);
    expect(probabilidadeDeChuteWordBuild(CONFIG)).toBeLessThan(
      probabilidadeDeChuteWordBuild(semIscas),
    );
  });
});

describe("montar-a-palavra — o schema recusa gabarito inconsistente", () => {
  function erros(config: unknown): string {
    const r = wordBuildConfigSchema.safeParse(config);
    return r.success ? "" : r.error.issues.map((i) => i.message).join(" | ");
  }

  it("recusa sequência que cita id inexistente", () => {
    expect(erros({ ...CONFIG, sequenciaCorreta: ["p_g", "p_a", "p_t", "p_42"] })).toContain(
      "p_42",
    );
  });

  it("recusa sequência que não monta a palavra declarada", () => {
    expect(erros({ ...CONFIG, sequenciaCorreta: ["p_t", "p_a", "p_g", "p_o"] })).toContain(
      "GATO",
    );
  });

  it("recusa id repetido na sequência correta", () => {
    expect(erros({ ...CONFIG, sequenciaCorreta: ["p_g", "p_g", "p_t", "p_o"] })).toContain(
      "repete",
    );
  });

  it("exige ensino — não é opcional", () => {
    expect(erros({ ...CONFIG, ensino: undefined })).not.toBe("");
  });
});
