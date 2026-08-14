import { describe, expect, it } from "vitest";

import { LAYOUT_VAZIO } from "../domain/map-layout";
import { criarMontarMapa } from "./map";
import type { DadosDoMapa, LeituraDoMapa, MissaoNoMapa, MundoNoMapa } from "./ports";

/**
 * `criarMontarMapa` tem duas responsabilidades: avaliar desbloqueio (coberto
 * por `unlock-rule.test.ts`) e — desde o mapa desenhado — traduzir o layout
 * bruto (referências de missão) no que a tela desenha (nós com a missão
 * inteira já avaliada). É a segunda que estes testes cobrem.
 */

function missaoNoMapa(parcial: Partial<MissaoNoMapa> & { ref: string }): MissaoNoMapa {
  return {
    slug: parcial.ref.slice(parcial.ref.lastIndexOf("/") + 1),
    nome: "Missão de teste",
    tipo: "PRACTICE",
    atividades: 1,
    competenciasExigidas: [],
    desbloqueio: null,
    ...parcial,
  };
}

function mundo(parcial: Partial<MundoNoMapa> & { slug: string }): MundoNoMapa {
  return {
    nome: "Mundo de teste",
    academia: "Conhecimento",
    nivelMinimo: 1,
    layout: LAYOUT_VAZIO,
    capitulos: [],
    ...parcial,
  };
}

function leituraFake(mundos: readonly MundoNoMapa[]): LeituraDoMapa {
  const dados: DadosDoMapa = {
    mundos,
    estado: { nivel: 1, missoesConcluidas: new Set(), dominioPorCompetencia: new Map() },
    concluidas: new Set(),
    emAndamento: new Set(),
  };
  return {
    async mapaDaCrianca() {
      return dados;
    },
    async estadoDeDesbloqueio() {
      return dados.estado;
    },
  };
}

const REF_1 = "conhecimento/mat/SPROUT/n1/m1/missao-01";
const REF_2 = "conhecimento/mat/SPROUT/n1/m1/missao-02";

describe("criarMontarMapa — mapa visual", () => {
  it("mundo sem layout autorado tem mapa nulo, mas mantém a lista de capítulos", async () => {
    const montarMapa = criarMontarMapa({
      leitura: leituraFake([
        mundo({
          slug: "m1",
          capitulos: [{ nome: "Cap 1", missoes: [missaoNoMapa({ ref: REF_1 })] }],
        }),
      ]),
    });

    const [resultado] = await montarMapa("learner-1");

    expect(resultado?.mapa).toBeNull();
    expect(resultado?.capitulos[0]?.missoes).toHaveLength(1);
  });

  it("traduz nós do layout para a missão inteira já avaliada, na mesma posição x/y", async () => {
    const montarMapa = criarMontarMapa({
      leitura: leituraFake([
        mundo({
          slug: "m1",
          layout: {
            nos: [
              { missaoRef: REF_1, x: 10, y: 90 },
              { missaoRef: REF_2, x: 50, y: 50 },
            ],
            arestas: [{ de: REF_1, para: REF_2 }],
          },
          capitulos: [
            {
              nome: "Cap 1",
              missoes: [missaoNoMapa({ ref: REF_1 }), missaoNoMapa({ ref: REF_2 })],
            },
          ],
        }),
      ]),
    });

    const [resultado] = await montarMapa("learner-1");

    expect(resultado?.mapa?.nos).toHaveLength(2);
    expect(resultado?.mapa?.nos[0]).toMatchObject({ x: 10, y: 90 });
    expect(resultado?.mapa?.nos[0]?.missao.ref).toBe(REF_1);
    // A missão do nó é a mesma instância avaliada da lista — jogabilidade,
    // concluída e emAndamento não são recalculadas duas vezes.
    expect(resultado?.mapa?.nos[0]?.missao).toBe(resultado?.capitulos[0]?.missoes[0]);
    expect(resultado?.mapa?.arestas).toEqual([{ de: REF_1, para: REF_2 }]);
  });

  it("nó cujo missaoRef não existe mais no mundo é descartado, não quebra a tela", async () => {
    const montarMapa = criarMontarMapa({
      leitura: leituraFake([
        mundo({
          slug: "m1",
          layout: { nos: [{ missaoRef: "missao-que-nao-existe-mais", x: 10, y: 10 }], arestas: [] },
          capitulos: [{ nome: "Cap 1", missoes: [missaoNoMapa({ ref: REF_1 })] }],
        }),
      ]),
    });

    const [resultado] = await montarMapa("learner-1");

    // Nenhum nó válido sobrou — o mundo cai de volta para a lista.
    expect(resultado?.mapa).toBeNull();
  });

  it("aresta cuja ponta não virou nó válido é filtrada, o resto do mapa continua", async () => {
    const montarMapa = criarMontarMapa({
      leitura: leituraFake([
        mundo({
          slug: "m1",
          layout: {
            nos: [{ missaoRef: REF_1, x: 10, y: 10 }],
            arestas: [{ de: REF_1, para: "missao-fantasma" }],
          },
          capitulos: [{ nome: "Cap 1", missoes: [missaoNoMapa({ ref: REF_1 })] }],
        }),
      ]),
    });

    const [resultado] = await montarMapa("learner-1");

    expect(resultado?.mapa?.nos).toHaveLength(1);
    expect(resultado?.mapa?.arestas).toEqual([]);
  });
});
