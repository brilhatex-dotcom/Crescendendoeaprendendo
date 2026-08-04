import { describe, expect, it } from "vitest";

import {
  DOMINIO_DO_COLOSSO,
  avaliarDesbloqueio,
  regraDeDesbloqueioSchema,
  regraEfetiva,
  type EstadoParaDesbloqueio,
  type RegraDeDesbloqueio,
} from "./unlock-rule";

/**
 * O avaliador de desbloqueio tem duas obrigações, e a segunda é a que costuma
 * ser esquecida: dizer que **não** dá para jogar, e dizer **o que falta**.
 *
 * Um cadeado sem explicação é uma parede sem porta (docs/08 §3). Os testes
 * daqui cobrem as duas — e a segunda é a que quebra se alguém simplificar o
 * retorno para um booleano.
 */

const estado = (parcial: Partial<EstadoParaDesbloqueio> = {}): EstadoParaDesbloqueio => ({
  nivel: 1,
  missoesConcluidas: new Set(),
  dominioPorCompetencia: new Map(),
  ...parcial,
});

describe("regra ausente", () => {
  it("sem regra, a missão é jogável", () => {
    // O padrão precisa ser liberar: a maioria do acervo não declara regra, e um
    // padrão que travasse deixaria a criança sem nada para fazer.
    expect(avaliarDesbloqueio(null, estado()).jogavel).toBe(true);
    expect(avaliarDesbloqueio(undefined, estado()).jogavel).toBe(true);
  });
});

describe("condição de nível", () => {
  const regra: RegraDeDesbloqueio = { level: { gte: 12 } };

  it("libera a partir do nível exigido", () => {
    expect(avaliarDesbloqueio(regra, estado({ nivel: 12 })).jogavel).toBe(true);
    expect(avaliarDesbloqueio(regra, estado({ nivel: 30 })).jogavel).toBe(true);
  });

  it("abaixo, diz quanto falta em vez de só travar", () => {
    const resultado = avaliarDesbloqueio(regra, estado({ nivel: 8 }));

    expect(resultado.jogavel).toBe(false);
    expect(resultado.pendencias).toEqual([{ tipo: "NIVEL", exigido: 12, atual: 8 }]);
  });
});

describe("condição de missão concluída", () => {
  const regra: RegraDeDesbloqueio = { questCompleted: "conhecimento/mat/SPROUT/n1/m1/missao-01" };

  it("libera quando a missão já foi concluída", () => {
    const concluida = estado({
      missoesConcluidas: new Set(["conhecimento/mat/SPROUT/n1/m1/missao-01"]),
    });
    expect(avaliarDesbloqueio(regra, concluida).jogavel).toBe(true);
  });

  it("aponta qual missão falta", () => {
    const resultado = avaliarDesbloqueio(regra, estado());

    expect(resultado.jogavel).toBe(false);
    expect(resultado.pendencias[0]).toMatchObject({ tipo: "MISSAO" });
  });
});

describe("condição de domínio médio", () => {
  const regra: RegraDeDesbloqueio = {
    masteryAvg: { skills: ["contar-ate-10", "comparar-quantidades"], gte: 0.6 },
  };

  it("libera quando a média alcança o exigido", () => {
    const pronta = estado({
      dominioPorCompetencia: new Map([
        ["contar-ate-10", 0.8],
        ["comparar-quantidades", 0.5],
      ]),
    });
    expect(avaliarDesbloqueio(regra, pronta).jogavel).toBe(true);
  });

  it("competência sem registro conta zero, e não é ignorada", () => {
    /*
     * A regra que evita o falso "pronta": uma criança que praticou uma das duas
     * competências pareceria pronta pelas duas se a que falta fosse ignorada —
     * e ela encararia o Colosso sem ter visto metade do que ele cobra.
     */
    const soUma = estado({ dominioPorCompetencia: new Map([["contar-ate-10", 1]]) });
    const resultado = avaliarDesbloqueio(regra, soUma);

    expect(resultado.jogavel).toBe(false);
    expect(resultado.pendencias[0]).toMatchObject({ tipo: "DOMINIO", atual: 0.5 });
  });
});

describe("combinadores", () => {
  const regra: RegraDeDesbloqueio = {
    all: [{ level: { gte: 5 } }, { questCompleted: "missao-anterior" }],
  };

  it("`all` exige todas — e lista tudo que falta", () => {
    const resultado = avaliarDesbloqueio(regra, estado({ nivel: 2 }));

    expect(resultado.jogavel).toBe(false);
    expect(resultado.pendencias).toHaveLength(2);
  });

  it("`all` libera quando todas passam", () => {
    const pronta = estado({ nivel: 9, missoesConcluidas: new Set(["missao-anterior"]) });
    expect(avaliarDesbloqueio(regra, pronta).jogavel).toBe(true);
  });

  it("`any` basta uma", () => {
    const alternativa: RegraDeDesbloqueio = {
      any: [{ level: { gte: 40 } }, { questCompleted: "missao-anterior" }],
    };
    const pronta = estado({ nivel: 1, missoesConcluidas: new Set(["missao-anterior"]) });

    expect(avaliarDesbloqueio(alternativa, pronta).jogavel).toBe(true);
  });

  it("`any` sem saída mostra UM caminho, o mais curto", () => {
    /*
     * Listar todos os caminhos entregaria à criança uma lista de coisas que ela
     * não precisa fazer todas — e a leitura mais natural ("preciso de tudo
     * isso?") é justamente a errada.
     */
    const alternativa: RegraDeDesbloqueio = {
      any: [
        { all: [{ level: { gte: 40 } }, { questCompleted: "a" }, { questCompleted: "b" }] },
        { level: { gte: 3 } },
      ],
    };

    const resultado = avaliarDesbloqueio(alternativa, estado({ nivel: 1 }));

    expect(resultado.jogavel).toBe(false);
    expect(resultado.pendencias).toHaveLength(1);
    expect(resultado.pendencias[0]).toMatchObject({ tipo: "NIVEL", exigido: 3 });
  });
});

describe("regra efetiva do Colosso", () => {
  it("um chefão exige domínio nas competências do capítulo, mesmo sem regra escrita", () => {
    /*
     * Deixar isso na mão de quem autora significaria que a primeira missão de
     * chefão sem o campo preenchido viraria um chefão de enfeite — e a criança
     * encararia o Guardião sem ter aprendido o que ele cobra.
     */
    const regra = regraEfetiva({
      tipo: "BOSS",
      competenciasExigidas: ["fracoes"],
      desbloqueio: null,
    });

    expect(regra).toEqual({ masteryAvg: { skills: ["fracoes"], gte: DOMINIO_DO_COLOSSO } });
  });

  it("chefão com regra escrita soma as duas", () => {
    const regra = regraEfetiva({
      tipo: "BOSS",
      competenciasExigidas: ["fracoes"],
      desbloqueio: { level: { gte: 10 } },
    });

    expect(regra).toMatchObject({ all: expect.any(Array) });
    expect(avaliarDesbloqueio(regra, estado({ nivel: 99 })).jogavel).toBe(false);
  });

  it("missão comum não ganha exigência nenhuma", () => {
    expect(
      regraEfetiva({ tipo: "STORY", competenciasExigidas: ["fracoes"], desbloqueio: null }),
    ).toBeNull();
  });

  it("chefão sem competências declaradas fica como está", () => {
    expect(
      regraEfetiva({ tipo: "BOSS", competenciasExigidas: [], desbloqueio: null }),
    ).toBeNull();
  });
});

describe("gramática", () => {
  it("aceita o exemplo de docs/08 §3", () => {
    const exemplo = {
      all: [
        { level: { gte: 12 } },
        { questCompleted: "quest_xyz" },
        { masteryAvg: { skills: ["s1", "s2"], gte: 0.6 } },
      ],
    };

    expect(regraDeDesbloqueioSchema.safeParse(exemplo).success).toBe(true);
  });

  it("recusa condição desconhecida", () => {
    // `strict()` em toda a gramática: um campo com erro de digitação vira
    // recusa na autoria, não uma regra silenciosamente ignorada em produção.
    expect(regraDeDesbloqueioSchema.safeParse({ nivel: { gte: 3 } }).success).toBe(false);
    expect(regraDeDesbloqueioSchema.safeParse({ level: { gt: 3 } }).success).toBe(false);
  });

  it("aceita aninhamento", () => {
    const aninhada = {
      all: [{ any: [{ level: { gte: 2 } }, { questCompleted: "x" }] }, { level: { gte: 1 } }],
    };
    expect(regraDeDesbloqueioSchema.safeParse(aninhada).success).toBe(true);
  });
});
