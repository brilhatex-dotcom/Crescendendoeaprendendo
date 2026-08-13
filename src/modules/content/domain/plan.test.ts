import { describe, expect, it } from "vitest";

import type { Acervo } from "@/content/loader";

import { planejarImportacao, refDeAtividade, refDeMissao } from "./plan";

/**
 * O mapeamento é onde moram os erros sutis de uma importação: uma referência
 * que aponta para o lugar errado não quebra o build nem o banco — só produz
 * uma criança exercitando a competência errada. Por isso ele é função pura, e
 * por isso estes testes não precisam de Postgres.
 */

const ACERVO_MINIMO: Acervo = {
  curriculos: [
    {
      slug: "matematica",
      nome: "Matemática",
      competencias: [
        {
          slug: "contagem",
          nome: "Contagem",
          descricao: "Contar e comparar quantidades até 10.",
          objetivos: [
            {
              slug: "contar-ate-10",
              descricao: "Contar objetos de um conjunto até dez.",
              codigoBncc: "EF01MA01",
              preRequisitos: [],
            },
            {
              slug: "comparar-quantidades",
              descricao: "Dizer qual conjunto tem mais elementos.",
              preRequisitos: ["contar-ate-10"],
            },
          ],
        },
      ],
    },
  ],
  academias: [
    {
      slug: "conhecimento",
      nome: "Academia do Conhecimento",
      ilha: "Ilha das Mil Perguntas",
      guardiao: "ORLA",
      descricao: "Onde as perguntas viram luz.",
      ordem: 0,
      paleta: { de: "#4F46E5", para: "#22D3EE", brilho: "rgba(79,70,229,0.45)" },
    },
  ],
  disciplinas: [
    {
      academia: "conhecimento",
      disciplina: { slug: "matematica", nome: "Matemática", curriculo: "matematica" },
    },
  ],
  niveis: [{ slug: "nivel-01", nome: "Primeiros Passos", ordem: 0, nivelMinimo: 1 }],
  modulos: [{ slug: "modulo-01", nome: "Números até 10", ordem: 0 }],
  colecionaveis: [],
  missoes: [
    {
      academia: "conhecimento",
      disciplina: "matematica",
      faixa: "SPROUT",
      nivel: "nivel-01",
      modulo: "modulo-01",
      caminho: "content/…/missao-01.json",
      missao: {
        slug: "missao-01",
        nome: "A Contagem da Orla",
        tipo: "PRACTICE",
        introducao: "ORLA precisa saber quantas conchas sobraram na praia.",
        conclusao: "A praia voltou a ter cor.",
        ordem: 0,
        competenciasExigidas: [],
        fases: [
          {
            slug: "fase-01",
            nome: "Conchas",
            atividades: [
              {
                slug: "atividade-01",
                tipo: "MULTIPLE_CHOICE",
                objetivo: "contar-ate-10",
                dificuldade: "FACIL",
                duracaoEstimadaSeg: 30,
                faixaMinima: "SPROUT",
                faixaMaxima: "SPROUT",
                config: { pergunta: "Quantas?" },
              },
              {
                slug: "atividade-02",
                tipo: "ORDER_SEQUENCE",
                objetivo: "comparar-quantidades",
                dificuldade: "MEDIO",
                duracaoEstimadaSeg: 45,
                faixaMinima: "SPROUT",
                faixaMaxima: "EXPLORER",
                config: { itens: ["1", "2"] },
              },
            ],
          },
        ],
      },
    },
  ],
};

describe("planejarImportacao", () => {
  it("mapeia a hierarquia inteira sem problema", () => {
    const { plano, problemas } = planejarImportacao(ACERVO_MINIMO);

    expect(problemas).toEqual([]);
    expect(plano.academias).toHaveLength(1);
    expect(plano.disciplinas).toHaveLength(1);
    expect(plano.eixos).toHaveLength(1);
    expect(plano.competencias).toHaveLength(2);
    expect(plano.objetivos).toHaveLength(2);
    expect(plano.mundos).toHaveLength(1);
    expect(plano.capitulos).toHaveLength(1);
    expect(plano.missoes).toHaveLength(1);
    expect(plano.fases).toHaveLength(1);
    expect(plano.atividades).toHaveLength(2);
    expect(plano.vinculos).toHaveLength(2);
    expect(plano.colecionaveis).toHaveLength(0);
  });

  it("mapeia o catálogo de colecionáveis 1:1", () => {
    const { plano } = planejarImportacao({
      ...ACERVO_MINIMO,
      colecionaveis: [{ code: "concha-da-orla", nome: "Concha da Orla", simbolo: "🐚" }],
    });

    expect(plano.colecionaveis).toEqual([
      { code: "concha-da-orla", nome: "Concha da Orla", simbolo: "🐚" },
    ]);
  });

  it("leva o código BNCC do objetivo para a competência", () => {
    const { plano } = planejarImportacao(ACERVO_MINIMO);

    const contar = plano.competencias.find((c) => c.nome === "contar-ate-10");
    const comparar = plano.competencias.find((c) => c.nome === "comparar-quantidades");

    expect(contar?.codigoBncc).toBe("EF01MA01");
    // Metade do que a plataforma ensina não está na BNCC — o código é opcional.
    expect(comparar?.codigoBncc).toBeNull();
  });

  it("transforma pré-requisito de objetivo em aresta do DAG", () => {
    const { plano } = planejarImportacao(ACERVO_MINIMO);

    expect(plano.preRequisitos).toEqual([
      {
        disciplinaCodigo: "conhecimento.matematica",
        competenciaNome: "comparar-quantidades",
        preRequisitoNome: "contar-ate-10",
      },
    ]);
  });

  it("gera chaves de origem estáveis — é o que torna a reimportação segura", () => {
    const missao = ACERVO_MINIMO.missoes[0]!;

    expect(refDeMissao(missao)).toBe(
      "conhecimento/matematica/SPROUT/nivel-01/modulo-01/missao-01",
    );
    expect(refDeAtividade(missao, "fase-01", "atividade-01")).toBe(
      "conhecimento/matematica/SPROUT/nivel-01/modulo-01/missao-01/fase-01/atividade-01",
    );
  });

  it("é determinístico: o mesmo acervo produz o mesmo plano", () => {
    const primeiro = planejarImportacao(ACERVO_MINIMO).plano;
    const segundo = planejarImportacao(ACERVO_MINIMO).plano;

    expect(segundo).toEqual(primeiro);
  });

  it("traduz a etiqueta de dificuldade para a escala Elo", () => {
    const { plano } = planejarImportacao(ACERVO_MINIMO);

    expect(plano.atividades[0]?.dificuldade).toBe(800); // FACIL
    expect(plano.atividades[1]?.dificuldade).toBe(1000); // MEDIO
  });

  it("acusa atividade que aponta para objetivo inexistente", () => {
    const acervo: Acervo = {
      ...ACERVO_MINIMO,
      missoes: [
        {
          ...ACERVO_MINIMO.missoes[0]!,
          missao: {
            ...ACERVO_MINIMO.missoes[0]!.missao,
            fases: [
              {
                ...ACERVO_MINIMO.missoes[0]!.missao.fases[0]!,
                atividades: [
                  {
                    ...ACERVO_MINIMO.missoes[0]!.missao.fases[0]!.atividades[0]!,
                    objetivo: "objetivo-que-nao-existe",
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const { plano, problemas } = planejarImportacao(acervo);

    expect(problemas).toHaveLength(1);
    expect(problemas[0]?.mensagem).toContain("objetivo-que-nao-existe");
    // A atividade quebrada não entra no plano — meio acervo é pior que nenhum.
    expect(plano.atividades).toHaveLength(0);
  });

  it("acusa slug de objetivo repetido no mesmo currículo", () => {
    const acervo: Acervo = {
      ...ACERVO_MINIMO,
      curriculos: [
        {
          ...ACERVO_MINIMO.curriculos[0]!,
          competencias: [
            ACERVO_MINIMO.curriculos[0]!.competencias[0]!,
            {
              slug: "outro-eixo",
              nome: "Outro eixo",
              descricao: "Repete um slug de propósito.",
              objetivos: [
                {
                  slug: "contar-ate-10",
                  descricao: "Duplicata proposital para o teste.",
                  preRequisitos: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const { problemas } = planejarImportacao(acervo);

    expect(problemas.some((p) => p.mensagem.includes("mais de uma competência"))).toBe(
      true,
    );
  });

  it("acusa disciplina que aponta para currículo inexistente", () => {
    const acervo: Acervo = {
      ...ACERVO_MINIMO,
      disciplinas: [
        {
          academia: "conhecimento",
          disciplina: { slug: "ciencias", nome: "Ciências", curriculo: "nao-existe" },
        },
      ],
      missoes: [],
    };

    const { problemas } = planejarImportacao(acervo);

    expect(problemas).toHaveLength(1);
    expect(problemas[0]?.mensagem).toContain("nao-existe");
  });

  it("o mundo carrega faixa e disciplina na chave, para não colidir entre trilhas", () => {
    const { plano } = planejarImportacao(ACERVO_MINIMO);

    expect(plano.mundos[0]?.slug).toBe("matematica-sprout-nivel-01");
  });
});
