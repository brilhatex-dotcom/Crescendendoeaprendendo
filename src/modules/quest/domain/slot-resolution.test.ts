import { describe, expect, it } from "vitest";

import type { DadosDaMissao } from "./quest-run";
import {
  agruparSlotsPendentes,
  faixaCompativel,
  mesclarAtividades,
  slotsDeRevisaoPendentes,
} from "./slot-resolution";

/**
 * A parte pura da seleção adaptativa (docs/08 §7): agrupar o pedido e juntar o
 * resultado de volta à missão. Nada aqui consulta banco ou chama o seletor —
 * é `application/resolve-slots.test.ts` que cobre a orquestração.
 */

const objetivo = (objectiveId: string, difficultyDelta = 0) =>
  ({ modo: "objetivo", objectiveId, difficultyDelta }) as const;

const revisao = () => ({ modo: "revisao" }) as const;

describe("agrupar slots pendentes", () => {
  it("slots do mesmo objetivo e mesmo ajuste caem no mesmo grupo", () => {
    const grupos = agruparSlotsPendentes([
      { stageId: "stg1", order: 0, fase: 0, regra: objetivo("obj1") },
      { stageId: "stg1", order: 1, fase: 0, regra: objetivo("obj1") },
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.slots).toHaveLength(2);
  });

  it("objetivo diferente, ou mesmo ajuste diferente, vira grupo separado", () => {
    const grupos = agruparSlotsPendentes([
      { stageId: "stg1", order: 0, fase: 0, regra: objetivo("obj1") },
      { stageId: "stg1", order: 1, fase: 0, regra: objetivo("obj2") },
      { stageId: "stg1", order: 2, fase: 0, regra: objetivo("obj1", -100) },
    ]);

    expect(grupos).toHaveLength(3);
  });

  it("slot com regra irreconhecível não entra em grupo nenhum", () => {
    const grupos = agruparSlotsPendentes([
      { stageId: "stg1", order: 0, fase: 0, regra: null },
    ]);

    expect(grupos).toHaveLength(0);
  });

  it("slot do modo revisão não entra em grupo de objetivo", () => {
    const grupos = agruparSlotsPendentes([
      { stageId: "stg1", order: 0, fase: 0, regra: revisao() },
    ]);

    expect(grupos).toHaveLength(0);
  });
});

describe("slots de revisão pendentes", () => {
  it("separa só o modo revisão, em ordem de posição", () => {
    const slots = slotsDeRevisaoPendentes([
      { stageId: "stg1", order: 2, fase: 0, regra: revisao() },
      { stageId: "stg1", order: 0, fase: 0, regra: objetivo("obj1") },
      { stageId: "stg1", order: 1, fase: 0, regra: revisao() },
    ]);

    expect(slots.map((s) => s.order)).toEqual([1, 2]);
  });

  it("regra irreconhecível não é revisão", () => {
    expect(
      slotsDeRevisaoPendentes([{ stageId: "stg1", order: 0, fase: 0, regra: null }]),
    ).toHaveLength(0);
  });
});

describe("faixa etária compatível", () => {
  it("a faixa da criança precisa estar entre o mínimo e o máximo da atividade", () => {
    expect(faixaCompativel("SPROUT", "EXPLORER", "SPROUT")).toBe(true);
    expect(faixaCompativel("SPROUT", "EXPLORER", "EXPLORER")).toBe(true);
    expect(faixaCompativel("SPROUT", "SPROUT", "EXPLORER")).toBe(false);
    expect(faixaCompativel("PIONEER", "VANGUARD", "SPROUT")).toBe(false);
  });
});

describe("mesclar atividade fixa e slot resolvido", () => {
  const missaoBase: DadosDaMissao = {
    questId: "q1",
    tipo: "STORY",
    nome: "Missão com slot",
    premio: { xp: 10, moedas: 0, cristais: 0 },
    competenciasExigidas: [],
    desbloqueio: null,
    atividades: [{ activityId: "fixa-1", fase: 0 }],
    slotsPendentes: [{ stageId: "stg1", order: 1, fase: 0, regra: objetivo("obj1") }],
  };

  it("sem slot pendente, devolve a mesma lista de atividades — zero custo para o acervo de hoje", () => {
    const semSlot: DadosDaMissao = { ...missaoBase, slotsPendentes: [] };
    expect(mesclarAtividades(semSlot, new Map())).toBe(semSlot.atividades);
  });

  it("slot resolvido entra ao final da fase, depois da atividade fixa", () => {
    const resolvidos = new Map([["stg1:1", "slot-escolhida"]]);
    expect(mesclarAtividades(missaoBase, resolvidos)).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "slot-escolhida", fase: 0 },
    ]);
  });

  it("slot sem resolução some da missão — o mesmo destino de um slot sem dono", () => {
    expect(mesclarAtividades(missaoBase, new Map())).toEqual([{ activityId: "fixa-1", fase: 0 }]);
  });

  it("fase que só tem slot aparece na sequência mesmo sem atividade fixa", () => {
    const missao: DadosDaMissao = {
      ...missaoBase,
      atividades: [{ activityId: "fixa-1", fase: 0 }],
      slotsPendentes: [{ stageId: "stg2", order: 0, fase: 1, regra: objetivo("obj1") }],
    };
    const resolvidos = new Map([["stg2:0", "slot-fase-2"]]);

    expect(mesclarAtividades(missao, resolvidos)).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "slot-fase-2", fase: 1 },
    ]);
  });

  it("slot de revisão resolvido também entra na fase, do mesmo jeito que um de objetivo", () => {
    const missao: DadosDaMissao = {
      ...missaoBase,
      slotsPendentes: [{ stageId: "stg1", order: 1, fase: 0, regra: revisao() }],
    };
    const resolvidos = new Map([["stg1:1", "slot-de-revisao"]]);

    expect(mesclarAtividades(missao, resolvidos)).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "slot-de-revisao", fase: 0 },
    ]);
  });
});
