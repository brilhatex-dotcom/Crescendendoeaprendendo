import { describe, expect, it } from "vitest";

import { fatorDeDificuldade, seletorPorProximidade } from "./difficulty";
import {
  PREMIO_VAZIO,
  calcularPremio,
  premioSchema,
  regraDeRecompensaSchema,
  somarPremios,
  type ContextoDeRecompensa,
} from "./rewards";

const REGRA = regraDeRecompensaSchema.parse({
  porDesfecho: {
    CORRECT: premioSchema.parse({ xp: 10, moedas: 5 }),
    PARTIAL: premioSchema.parse({ xp: 6, moedas: 3 }),
    // docs/08 §1: errar e aprender rende. Nunca zero.
    INCORRECT: premioSchema.parse({ xp: 4, moedas: 1 }),
    SKIPPED: premioSchema.parse({}),
  },
  multiplicadorPorDica: [1, 0.6, 0.4],
  decaimentoPorRepeticao: [1, 0.3, 0.1, 0],
});

const CTX: ContextoDeRecompensa = {
  outcome: "CORRECT",
  dicasUsadas: 0,
  repeticoes: 0,
  dificuldadeDaAtividade: 1000,
  habilidadeDaCrianca: 1000,
  semFolego: false,
};

describe("fator de dificuldade (docs/08 §1)", () => {
  it("vale 1 quando o desafio casa com a habilidade", () => {
    expect(fatorDeDificuldade(1000, 1000)).toBe(1);
  });

  it("desaba no piso quando o conteúdo é fácil demais — farmar não compensa", () => {
    expect(fatorDeDificuldade(600, 1000)).toBe(0.6);
    expect(fatorDeDificuldade(100, 1000)).toBe(0.6);
  });

  it("chega ao teto quando a criança encara o que está acima dela", () => {
    expect(fatorDeDificuldade(1400, 1000)).toBe(1.8);
  });
});

describe("cálculo do prêmio", () => {
  it("paga o valor do conteúdo, sem número fixo no código", () => {
    expect(calcularPremio(REGRA, CTX)).toMatchObject({ xp: 10, moedas: 5 });
  });

  it("errar rende XP — nunca zero (docs/08 §1)", () => {
    const premio = calcularPremio(REGRA, { ...CTX, outcome: "INCORRECT" });
    expect(premio.xp).toBeGreaterThan(0);
  });

  it("pedir ajuda reduz o ganho, mas não o anula", () => {
    const comUmaDica = calcularPremio(REGRA, { ...CTX, dicasUsadas: 1 });
    const comDuas = calcularPremio(REGRA, { ...CTX, dicasUsadas: 2 });

    expect(comUmaDica.xp).toBe(6);
    expect(comDuas.xp).toBe(4);
    expect(comDuas.xp).toBeGreaterThan(0);
  });

  it("repete o último multiplicador quando pedem mais dicas do que há", () => {
    expect(calcularPremio(REGRA, { ...CTX, dicasUsadas: 99 }).xp).toBe(4);
  });

  it("decai ao rejogar até zerar", () => {
    expect(calcularPremio(REGRA, { ...CTX, repeticoes: 1 }).xp).toBe(3);
    expect(calcularPremio(REGRA, { ...CTX, repeticoes: 2 }).xp).toBe(1);
    expect(calcularPremio(REGRA, { ...CTX, repeticoes: 3 }).xp).toBe(0);
    expect(calcularPremio(REGRA, { ...CTX, repeticoes: 50 }).xp).toBe(0);
  });

  it("multiplica pelo desafio real", () => {
    const facilDemais = calcularPremio(REGRA, { ...CTX, dificuldadeDaAtividade: 600 });
    const desafiador = calcularPremio(REGRA, { ...CTX, dificuldadeDaAtividade: 1400 });

    expect(facilDemais.xp).toBe(6);
    expect(desafiador.xp).toBe(18);
  });

  it("respeita conteúdo que dispensa o fator (prêmio fixo de missão)", () => {
    const fixa = regraDeRecompensaSchema.parse({
      ...REGRA,
      aplicarFatorDeDificuldade: false,
    });
    expect(calcularPremio(fixa, { ...CTX, dificuldadeDaAtividade: 1400 }).xp).toBe(10);
  });
});

describe("regra ética do Fôlego (docs/08 §4)", () => {
  /**
   * A regra mais importante deste arquivo: sem energia, a criança perde a
   * moeda e o cosmético — nunca o aprendizado.
   */
  it("sem Fôlego, XP continua integral", () => {
    const premio = calcularPremio(REGRA, { ...CTX, semFolego: true });
    expect(premio.xp).toBe(10);
  });

  it("sem Fôlego, moeda e cosmético não são creditados", () => {
    const comItens = regraDeRecompensaSchema.parse({
      ...REGRA,
      porDesfecho: {
        ...REGRA.porDesfecho,
        CORRECT: premioSchema.parse({
          xp: 10,
          moedas: 5,
          cristais: 2,
          itens: ["chapeu"],
          colecionaveis: ["concha"],
          conquistas: ["primeira-missao"],
        }),
      },
    });

    const premio = calcularPremio(comItens, { ...CTX, semFolego: true });

    expect(premio.moedas).toBe(0);
    expect(premio.cristais).toBe(0);
    expect(premio.itens).toEqual([]);
    expect(premio.colecionaveis).toEqual([]);
    // Conquista é reconhecimento de mérito, não economia: não se perde.
    expect(premio.conquistas).toEqual(["primeira-missao"]);
  });
});

describe("prêmios", () => {
  it("desfecho sem regra declarada não paga nada", () => {
    expect(calcularPremio(REGRA, { ...CTX, outcome: "TIMEOUT" })).toEqual(PREMIO_VAZIO);
  });

  it("soma acumula moedas e concatena coleções", () => {
    const a = premioSchema.parse({ xp: 10, moedas: 5, itens: ["a"] });
    const b = premioSchema.parse({ xp: 4, moedas: 1, itens: ["b"] });

    expect(somarPremios(a, b)).toMatchObject({ xp: 14, moedas: 6, itens: ["a", "b"] });
  });
});

describe("seleção adaptativa (docs/08 §7)", () => {
  const candidatas = [
    { activityId: "muito-facil", type: "MULTIPLE_CHOICE", dificuldade: 700 },
    { activityId: "no-alvo", type: "ORDER_SEQUENCE", dificuldade: 1060 },
    { activityId: "perto", type: "MULTIPLE_CHOICE", dificuldade: 1100 },
    { activityId: "dificil", type: "MULTIPLE_CHOICE", dificuldade: 1500 },
  ];

  it("mira a habilidade + 60, não o mais fácil", () => {
    const escolhidas = seletorPorProximidade.selecionar(
      { habilidade: 1000, objectiveId: "o1", excluir: [], tiposRecentes: [], quantidade: 1 },
      candidatas,
    );
    expect(escolhidas[0]?.activityId).toBe("no-alvo");
  });

  it("não repete o que a criança acabou de ver", () => {
    const escolhidas = seletorPorProximidade.selecionar(
      { habilidade: 1000, objectiveId: "o1", excluir: ["no-alvo"], tiposRecentes: [], quantidade: 1 },
      candidatas,
    );
    expect(escolhidas[0]?.activityId).toBe("perto");
  });

  it("evita o mesmo tipo três vezes seguidas", () => {
    const escolhidas = seletorPorProximidade.selecionar(
      {
        habilidade: 1000,
        objectiveId: "o1",
        excluir: [],
        tiposRecentes: ["MULTIPLE_CHOICE", "MULTIPLE_CHOICE"],
        quantidade: 1,
      },
      candidatas,
    );
    expect(escolhidas[0]?.type).toBe("ORDER_SEQUENCE");
  });

  it("prefere repetir o tipo a entregar missão incompleta", () => {
    const escolhidas = seletorPorProximidade.selecionar(
      {
        habilidade: 1000,
        objectiveId: "o1",
        excluir: [],
        tiposRecentes: ["MULTIPLE_CHOICE", "MULTIPLE_CHOICE"],
        quantidade: 4,
      },
      candidatas,
    );
    expect(escolhidas).toHaveLength(4);
  });

  it("é determinística — a mesma sessão se reproduz para investigar bug", () => {
    const pedido = {
      habilidade: 1000,
      objectiveId: "o1",
      excluir: [],
      tiposRecentes: [],
      quantidade: 3,
    };
    const a = seletorPorProximidade.selecionar(pedido, candidatas);
    const b = seletorPorProximidade.selecionar(pedido, candidatas);
    expect(a.map((c) => c.activityId)).toEqual(b.map((c) => c.activityId));
  });
});
