import { describe, expect, it } from "vitest";
import { z } from "zod";

import { isErr, unwrap } from "@/shared/kernel";

import type { ActivityPlugin, EvaluationContext } from "./contracts";
import { avaliarAtividade, criarRegistro, selar } from "./registry";

/**
 * Teste do NÚCLEO.
 *
 * Repare que este arquivo não importa nenhum plugin real. Ele monta plugins
 * inventados na hora e prova que o motor funciona com eles — que é exatamente
 * a afirmação da arquitetura: *o núcleo não conhece tipo de atividade nenhum*.
 *
 * Se algum dia for preciso importar `multiple-choice` aqui para o teste passar,
 * é sinal de que o motor passou a depender de um tipo concreto.
 */

const CTX: EvaluationContext = {
  dicasUsadas: 0,
  tentativa: 1,
  duracaoMs: 1000,
  locale: "pt-BR",
};

/** Um tipo de atividade que não existe no produto, inventado só para este teste. */
const pluginFicticio: ActivityPlugin<{ alvo: number }, { valor: number }> = {
  type: "SIMULATION",
  configSchema: z.object({ alvo: z.number() }),
  answerSchema: z.object({ valor: z.number() }),
  evaluate(config, answer) {
    return answer.valor === config.alvo
      ? { outcome: "CORRECT", scoreRatio: 1, feedback: { tom: "CELEBRA", mensagem: "Isso!" } }
      : {
          outcome: "INCORRECT",
          scoreRatio: 0,
          feedback: { tom: "ORIENTA", mensagem: "Ainda não.", ensino: "Tente um número maior." },
        };
  },
  probabilidadeDeChute: () => 0.01,
  rendererId: "ficticio",
};

const outroPlugin: ActivityPlugin<{ n: number }, { n: number }> = {
  type: "MEMORY_PAIRS",
  configSchema: z.object({ n: z.number() }),
  answerSchema: z.object({ n: z.number() }),
  evaluate: () => ({ outcome: "CORRECT", scoreRatio: 1, feedback: { tom: "CELEBRA", mensagem: "ok" } }),
  probabilidadeDeChute: () => 0.5,
  rendererId: "outro",
};

describe("registro — resolução de plugin", () => {
  const registro = criarRegistro([selar(pluginFicticio), selar(outroPlugin)]);

  it("resolve pelo tipo", () => {
    expect(unwrap(registro.obter("SIMULATION")).rendererId).toBe("ficticio");
  });

  it("recusa tipo não registrado, sem explodir", () => {
    const r = registro.obter("BUILD_3D");
    expect(isErr(r) && r.error.code).toBe("activity.plugin_not_registered");
    expect(registro.suporta("BUILD_3D")).toBe(false);
  });

  it("lista o que é jogável hoje", () => {
    expect(registro.tiposDisponiveis()).toEqual(["MEMORY_PAIRS", "SIMULATION"]);
  });

  it("recusa dois plugins para o mesmo tipo na inicialização", () => {
    // Falhar ao subir é o certo: com dois plugins para um tipo, a correção de
    // uma atividade dependeria da ordem dos imports.
    expect(() => criarRegistro([selar(pluginFicticio), selar(pluginFicticio)])).toThrow(
      /Dois plugins registrados/,
    );
  });
});

describe("registro — validação nas duas pontas", () => {
  const registro = criarRegistro([selar(pluginFicticio)]);

  it("avalia quando config e resposta são válidas", () => {
    const r = avaliarAtividade(registro, { type: "SIMULATION", config: { alvo: 7 } }, { valor: 7 }, CTX);
    expect(unwrap(r).outcome).toBe("CORRECT");
  });

  it("recusa conteúdo malformado ANTES de corrigir", () => {
    const r = avaliarAtividade(registro, { type: "SIMULATION", config: { alvo: "sete" } }, { valor: 7 }, CTX);

    expect(isErr(r) && r.error.code).toBe("activity.config_invalid");
    // O erro diz onde está o problema — quem autora precisa conseguir consertar.
    expect(isErr(r) && JSON.stringify(r.error.details)).toContain("alvo");
  });

  it("recusa resposta malformada vinda do cliente", () => {
    const r = avaliarAtividade(registro, { type: "SIMULATION", config: { alvo: 7 } }, { valor: "sete" }, CTX);
    expect(isErr(r) && r.error.code).toBe("activity.answer_invalid");
  });

  it("descarta campos não declarados na resposta (fail-closed)", () => {
    const r = avaliarAtividade(
      registro,
      { type: "SIMULATION", config: { alvo: 7 } },
      { valor: 7, pontuacaoForjada: 999 },
      CTX,
    );
    expect(unwrap(r).scoreRatio).toBe(1);
  });

  it("propaga a probabilidade de chute do plugin", () => {
    const plugin = unwrap(registro.obter("SIMULATION"));
    expect(unwrap(plugin.probabilidadeDeChute({ alvo: 7 }))).toBe(0.01);
  });

  it("não calcula chute sobre config inválida", () => {
    const plugin = unwrap(registro.obter("SIMULATION"));
    expect(isErr(plugin.probabilidadeDeChute({ alvo: "x" }))).toBe(true);
  });
});

describe("registro — Open/Closed", () => {
  it("aceita um tipo novo sem que o núcleo saiba dele", () => {
    /*
     * Este teste é a afirmação central da arquitetura, escrita como código:
     * um tipo inventado agora, com forma de resposta própria, entra no motor
     * sem que `registry.ts` ou `contracts.ts` tenham sido tocados.
     */
    const inventadoAgora: ActivityPlugin<{ palavras: string[] }, { texto: string }> = {
      type: "FREE_TEXT",
      configSchema: z.object({ palavras: z.array(z.string()) }),
      answerSchema: z.object({ texto: z.string() }),
      evaluate(config, answer) {
        const usou = config.palavras.filter((p) => answer.texto.includes(p)).length;
        const razao = config.palavras.length > 0 ? usou / config.palavras.length : 0;
        return razao === 1
          ? { outcome: "CORRECT", scoreRatio: 1, feedback: { tom: "CELEBRA", mensagem: "Usou todas!" } }
          : {
              outcome: "PARTIAL",
              scoreRatio: razao,
              feedback: { tom: "QUASE", mensagem: `Usou ${usou}.`, ensino: "Tente incluir as que faltam." },
            };
      },
      probabilidadeDeChute: () => 0.001,
      rendererId: "texto-livre",
    };

    const registro = criarRegistro([selar(pluginFicticio), selar(inventadoAgora)]);
    const r = avaliarAtividade(
      registro,
      { type: "FREE_TEXT", config: { palavras: ["sol", "mar"] } },
      { texto: "o sol nasce" },
      CTX,
    );

    expect(unwrap(r).outcome).toBe("PARTIAL");
    expect(unwrap(r).scoreRatio).toBe(0.5);
  });

  it("um registro vazio é válido e não quebra nada", () => {
    const vazio = criarRegistro([]);
    expect(vazio.tiposDisponiveis()).toEqual([]);
    expect(isErr(vazio.obter("MULTIPLE_CHOICE"))).toBe(true);
  });
});
