import { describe, expect, it } from "vitest";

import { CUSTO_DE_FOLEGO, custoDeFolego } from "./energy-cost";
import {
  atividadesRestantes,
  missaoConcluida,
  posicaoDaRetomada,
  type DadosDaMissao,
} from "./quest-run";

/**
 * A promessa que este módulo existe para cumprir é uma frase: **fechar o app
 * nunca custa progresso**. Os testes daqui verificam essa frase — onde ela
 * volta, quanto falta, e se a missão de fato acabou.
 */

const missao: DadosDaMissao = {
  questId: "q1",
  tipo: "STORY",
  nome: "A Contagem da Orla",
  premio: { xp: 40, moedas: 10, cristais: 0, colecionaveis: [] },
  competenciasExigidas: [],
  desbloqueio: null,
  atividades: [
    { activityId: "a1", fase: 0 },
    { activityId: "a2", fase: 0 },
    { activityId: "a3", fase: 1 },
  ],
  slotsPendentes: [],
};

describe("posição da retomada", () => {
  it("quem nunca respondeu começa do zero", () => {
    expect(posicaoDaRetomada(missao, new Set())).toEqual({ indice: 0, fase: 0 });
  });

  it("volta na primeira que ainda falta", () => {
    expect(posicaoDaRetomada(missao, new Set(["a1"]))).toEqual({ indice: 1, fase: 0 });
  });

  it("atravessa a fase junto com a criança", () => {
    expect(posicaoDaRetomada(missao, new Set(["a1", "a2"]))).toEqual({ indice: 2, fase: 1 });
  });

  it("respondeu fora de ordem: volta no buraco, não no fim", () => {
    /*
     * Acontece de verdade — "seguir em frente" é sempre possível no executor.
     * Voltar para o fim deixaria a atividade pulada invisível para sempre, e a
     * missão nunca fecharia.
     */
    expect(posicaoDaRetomada(missao, new Set(["a1", "a3"]))).toEqual({ indice: 1, fase: 0 });
  });

  it("tudo respondido: a posição é o fim", () => {
    expect(posicaoDaRetomada(missao, new Set(["a1", "a2", "a3"])).indice).toBe(3);
  });
});

describe("conclusão", () => {
  it("só acaba quando toda atividade foi respondida", () => {
    expect(missaoConcluida(missao, new Set(["a1", "a2"]))).toBe(false);
    expect(missaoConcluida(missao, new Set(["a1", "a2", "a3"]))).toBe(true);
  });

  it("responder não é acertar", () => {
    /*
     * A regra que faz a missão ser terminável por quem mais precisa terminá-la.
     * "Seguir em frente" é sempre possível — travar a criança numa atividade
     * que ela não consegue é o oposto de ensinar —, então exigir acerto tornaria
     * a conclusão impossível justamente para ela.
     *
     * O conjunto aqui é de atividades *respondidas*; o desfecho de cada uma não
     * entra na conta, e é isso que este teste fixa.
     */
    expect(missaoConcluida(missao, new Set(["a1", "a2", "a3"]))).toBe(true);
  });

  it("missão sem atividade nenhuma nunca conclui", () => {
    // Conteúdo quebrado não pode virar recompensa de graça.
    expect(missaoConcluida({ ...missao, atividades: [] }, new Set())).toBe(false);
  });

  it("conta quantas faltam, para a tela poder dizer", () => {
    expect(atividadesRestantes(missao, new Set(["a1"]))).toBe(2);
    expect(atividadesRestantes(missao, new Set(["a1", "a2", "a3"]))).toBe(0);
  });
});

describe("custo de Fôlego", () => {
  it("campanha custa 5, revisão custa 3 (docs/08 §4)", () => {
    expect(custoDeFolego("STORY")).toBe(5);
    expect(custoDeFolego("BOSS")).toBe(5);
    expect(custoDeFolego("REVIEW")).toBe(3);
  });

  it("projeto, família e desafio diário não custam nada", () => {
    // Cobrar por criar, por um momento com um adulto, ou por ter aparecido
    // hoje — cada um seria uma lição errada.
    expect(custoDeFolego("PROJECT")).toBe(0);
    expect(custoDeFolego("FAMILY")).toBe(0);
    expect(custoDeFolego("DAILY")).toBe(0);
  });

  it("tipo desconhecido sai de graça", () => {
    // A direção do erro importa: um tipo novo que ninguém mapeou não pode
    // cobrar Fôlego de uma criança por um descuido nosso.
    expect(custoDeFolego("TIPO_QUE_NAO_EXISTE")).toBe(0);
  });

  it("nenhum custo é negativo — Fôlego não se ganha por começar", () => {
    for (const valor of Object.values(CUSTO_DE_FOLEGO)) {
      expect(valor).toBeGreaterThanOrEqual(0);
    }
  });
});
