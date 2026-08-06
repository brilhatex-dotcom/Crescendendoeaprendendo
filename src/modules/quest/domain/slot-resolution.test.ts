import { describe, expect, it } from "vitest";

import type { DadosDaMissao } from "./quest-run";
import { agruparSlotsPendentes, faixaCompativel, mesclarAtividades } from "./slot-resolution";

/**
 * A parte pura da seleção adaptativa (docs/08 §7): agrupar o pedido e juntar o
 * resultado de volta à missão. Nada aqui consulta banco ou chama o seletor —
 * é `application/resolve-slots.test.ts` que cobre a orquestração.
 */

describe("agrupar slots pendentes", () => {
  it("slots do mesmo objetivo e mesmo ajuste caem no mesmo grupo", () => {
    const grupos = agruparSlotsPendentes([
      { stageId: "stg1", order: 0, fase: 0, regra: { objectiveId: "obj1", difficultyDelta: 0 } },
      { stageId: "stg1", order: 1, fase: 0, regra: { objectiveId: "obj1", difficultyDelta: 0 } },
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.slots).toHaveLength(2);
  });

  it("objetivo diferente, ou mesmo ajuste diferente, vira grupo separado", () => {
    const grupos = agruparSlotsPendentes([
      { stageId: "stg1", order: 0, fase: 0, regra: { objectiveId: "obj1", difficultyDelta: 0 } },
      { stageId: "stg1", order: 1, fase: 0, regra: { objectiveId: "obj2", difficultyDelta: 0 } },
      { stageId: "stg1", order: 2, fase: 0, regra: { objectiveId: "obj1", difficultyDelta: -100 } },
    ]);

    expect(grupos).toHaveLength(3);
  });

  it("slot com regra irreconhecível não entra em grupo nenhum", () => {
    const grupos = agruparSlotsPendentes([
      { stageId: "stg1", order: 0, fase: 0, regra: null },
    ]);

    expect(grupos).toHaveLength(0);
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
    slotsPendentes: [
      { stageId: "stg1", order: 1, fase: 0, regra: { objectiveId: "obj1", difficultyDelta: 0 } },
    ],
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
      slotsPendentes: [
        { stageId: "stg2", order: 0, fase: 1, regra: { objectiveId: "obj1", difficultyDelta: 0 } },
      ],
    };
    const resolvidos = new Map([["stg2:0", "slot-fase-2"]]);

    expect(mesclarAtividades(missao, resolvidos)).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "slot-fase-2", fase: 1 },
    ]);
  });
});
