import { describe, expect, it } from "vitest";

import { seletorPorProximidade } from "@/activities";
import type { Transacao } from "@/shared/kernel";

import type { DadosDaMissao } from "../domain/quest-run";
import type {
  CandidataParaSlot,
  ContextoParaSlots,
  RepositorioDeSlots,
  ResolucaoDeSlot,
} from "./ports";
import { criarResolverSlots } from "./resolve-slots";

/**
 * A orquestração da seleção adaptativa (docs/08 §7), com o repositório em
 * memória. O seletor usado é o de verdade (`seletorPorProximidade`) — só o
 * acesso a dados é fake, para que o teste prove a integração das duas peças,
 * não reimplemente o seletor.
 */

const TX_FALSA = {} as Transacao;
const AGORA = new Date("2026-08-06T12:00:00Z");

const MISSAO_SEM_SLOT: DadosDaMissao = {
  questId: "q1",
  tipo: "STORY",
  nome: "Sem slot",
  premio: { xp: 10, moedas: 0, cristais: 0 },
  competenciasExigidas: [],
  desbloqueio: null,
  atividades: [{ activityId: "fixa-1", fase: 0 }],
  slotsPendentes: [],
};

function missaoComUmSlot(regra: { objectiveId: string; difficultyDelta: number }): DadosDaMissao {
  return {
    ...MISSAO_SEM_SLOT,
    nome: "Com um slot",
    slotsPendentes: [{ stageId: "stg1", order: 0, fase: 0, regra }],
  };
}

interface RepositorioFalsoConfig {
  readonly contexto?: ContextoParaSlots | null;
  readonly candidatasPorObjetivo?: Record<string, readonly CandidataParaSlot[]>;
  readonly vistas?: ReadonlySet<string>;
  readonly jaResolvidos?: ReadonlyMap<string, string>;
}

function criarRepositorioFalso(config: RepositorioFalsoConfig = {}) {
  const persistido = new Map(config.jaResolvidos ?? []);

  const chamadas = {
    contexto: 0,
    candidatas: 0,
    vistasRecentemente: 0,
    resolver: 0,
  };

  const repositorio: RepositorioDeSlots = {
    async contexto() {
      chamadas.contexto += 1;
      return config.contexto ?? { ageBand: "SPROUT", locale: "pt-BR", habilidadePorObjetivo: new Map() };
    },
    async candidatas(objectiveId) {
      chamadas.candidatas += 1;
      return config.candidatasPorObjetivo?.[objectiveId] ?? [];
    },
    async vistasRecentemente() {
      chamadas.vistasRecentemente += 1;
      return config.vistas ?? new Set();
    },
    async slotsResolvidos() {
      return new Map(persistido);
    },
    async resolver(_questRunId, resolucoes: readonly ResolucaoDeSlot[]) {
      chamadas.resolver += 1;
      for (const resolucao of resolucoes) {
        persistido.set(`${resolucao.stageId}:${resolucao.order}`, resolucao.activityId);
      }
      return new Map(persistido);
    },
  };

  return { repositorio, chamadas, persistido };
}

const candidata = (parcial: Partial<CandidataParaSlot> & { activityId: string }): CandidataParaSlot => ({
  type: "MULTIPLE_CHOICE",
  dificuldade: 1000,
  minAgeBand: "SPROUT",
  maxAgeBand: "SPROUT",
  ...parcial,
});

describe("resolver slots da missão", () => {
  it("sem slot pendente, devolve a mesma missão e não toca no repositório", async () => {
    const { repositorio, chamadas } = criarRepositorioFalso();
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      MISSAO_SEM_SLOT,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado).toBe(MISSAO_SEM_SLOT);
    expect(chamadas.contexto).toBe(0);
    expect(chamadas.candidatas).toBe(0);
  });

  it("escolhe a candidata mais próxima do alvo (habilidade + 60) e grava a escolha", async () => {
    const missao = missaoComUmSlot({ objectiveId: "obj1", difficultyDelta: 0 });

    const { repositorio, chamadas, persistido } = criarRepositorioFalso({
      candidatasPorObjetivo: {
        obj1: [
          candidata({ activityId: "longe", dificuldade: 400 }),
          candidata({ activityId: "perto", dificuldade: 1060 }),
          candidata({ activityId: "tambem-longe", dificuldade: 1800 }),
        ],
      },
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    // Sem `SkillMastery`, a habilidade cai no centro da escala (1000, `ELO.centro`).
    expect(resultado.atividades).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "perto", fase: 0 },
    ]);
    expect(persistido.get("stg1:0")).toBe("perto");
    expect(chamadas.resolver).toBe(1);
  });

  it("retomada: slot já resolvido não chama contexto nem candidata de novo", async () => {
    const missao = missaoComUmSlot({ objectiveId: "obj1", difficultyDelta: 0 });

    const { repositorio, chamadas } = criarRepositorioFalso({
      jaResolvidos: new Map([["stg1:0", "escolhida-antes"]]),
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "escolhida-antes", fase: 0 },
    ]);
    expect(chamadas.contexto).toBe(0);
    expect(chamadas.candidatas).toBe(0);
    expect(chamadas.resolver).toBe(0);
  });

  it("não escolhe atividade vista nas últimas 48h, mesmo sendo a mais próxima do alvo", async () => {
    const missao = missaoComUmSlot({ objectiveId: "obj1", difficultyDelta: 0 });

    const { repositorio } = criarRepositorioFalso({
      candidatasPorObjetivo: {
        obj1: [
          candidata({ activityId: "vista-recentemente", dificuldade: 1060 }),
          candidata({ activityId: "alternativa", dificuldade: 1100 }),
        ],
      },
      vistas: new Set(["vista-recentemente"]),
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "alternativa", fase: 0 },
    ]);
  });

  it("não repete atividade já usada na própria missão", async () => {
    const missao: DadosDaMissao = {
      ...MISSAO_SEM_SLOT,
      // A atividade fixa da missão é candidata do mesmo objetivo do slot —
      // não deveria ser escolhida de novo.
      atividades: [{ activityId: "ja-na-missao", fase: 0 }],
      slotsPendentes: [
        { stageId: "stg1", order: 0, fase: 0, regra: { objectiveId: "obj1", difficultyDelta: 0 } },
      ],
    };

    const { repositorio } = criarRepositorioFalso({
      candidatasPorObjetivo: {
        obj1: [
          candidata({ activityId: "ja-na-missao", dificuldade: 1060 }),
          candidata({ activityId: "outra", dificuldade: 1100 }),
        ],
      },
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([
      { activityId: "ja-na-missao", fase: 0 },
      { activityId: "outra", fase: 0 },
    ]);
  });

  it("filtra por faixa etária antes de escolher", async () => {
    const missao = missaoComUmSlot({ objectiveId: "obj1", difficultyDelta: 0 });

    const { repositorio } = criarRepositorioFalso({
      contexto: { ageBand: "SPROUT", locale: "pt-BR", habilidadePorObjetivo: new Map() },
      candidatasPorObjetivo: {
        obj1: [
          candidata({ activityId: "faixa-errada", dificuldade: 1060, minAgeBand: "PIONEER", maxAgeBand: "VANGUARD" }),
          candidata({ activityId: "faixa-certa", dificuldade: 1200 }),
        ],
      },
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "faixa-certa", fase: 0 },
    ]);
  });

  it("difficultyDelta desloca o alvo de busca", async () => {
    const missao = missaoComUmSlot({ objectiveId: "obj1", difficultyDelta: -300 });

    const { repositorio } = criarRepositorioFalso({
      contexto: {
        ageBand: "SPROUT",
        locale: "pt-BR",
        habilidadePorObjetivo: new Map([["obj1", 1000]]),
      },
      candidatasPorObjetivo: {
        // Sem o delta, o alvo seria 1060 e "dificil" ganharia. Com delta -300,
        // o alvo cai para 760, e "facil" é quem fica mais perto.
        obj1: [
          candidata({ activityId: "facil", dificuldade: 750 }),
          candidata({ activityId: "dificil", dificuldade: 1060 }),
        ],
      },
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "facil", fase: 0 },
    ]);
  });

  it("sem candidata nenhuma, o slot some da missão em vez de quebrar", async () => {
    const missao = missaoComUmSlot({ objectiveId: "obj1", difficultyDelta: 0 });
    const { repositorio, chamadas } = criarRepositorioFalso({ candidatasPorObjetivo: {} });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([{ activityId: "fixa-1", fase: 0 }]);
    expect(chamadas.resolver).toBe(0);
  });

  it("criança não encontrada: os slots seguem pendentes, sem exceção", async () => {
    const missao = missaoComUmSlot({ objectiveId: "obj1", difficultyDelta: 0 });
    const { repositorio } = criarRepositorioFalso({ contexto: null });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_fantasma", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([{ activityId: "fixa-1", fase: 0 }]);
  });

  it("dois grupos (objetivos diferentes) chamam candidatas uma vez cada", async () => {
    const missao: DadosDaMissao = {
      ...MISSAO_SEM_SLOT,
      slotsPendentes: [
        { stageId: "stg1", order: 0, fase: 0, regra: { objectiveId: "obj1", difficultyDelta: 0 } },
        { stageId: "stg1", order: 1, fase: 0, regra: { objectiveId: "obj2", difficultyDelta: 0 } },
      ],
    };

    const { repositorio, chamadas } = criarRepositorioFalso({
      candidatasPorObjetivo: {
        obj1: [candidata({ activityId: "a1", dificuldade: 1060 })],
        obj2: [candidata({ activityId: "a2", dificuldade: 1060 })],
      },
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(chamadas.candidatas).toBe(2);
    expect(resultado.atividades.map((a) => a.activityId)).toEqual(
      expect.arrayContaining(["a1", "a2"]),
    );
  });
});
