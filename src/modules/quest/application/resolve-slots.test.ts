import { describe, expect, it } from "vitest";

import { seletorPorProximidade } from "@/activities";
import type { Transacao } from "@/shared/kernel";

import type { DadosDaMissao, SlotPendente } from "../domain/quest-run";
import type { RegraDeSlot } from "../domain/slot-rule";
import type {
  CandidataParaSlot,
  ContextoParaSlots,
  ItemDaFilaDeRevisao,
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

const objetivo = (objectiveId: string, difficultyDelta = 0): RegraDeSlot => ({
  modo: "objetivo",
  objectiveId,
  difficultyDelta,
});

const revisao = (): RegraDeSlot => ({ modo: "revisao" });

const MISSAO_SEM_SLOT: DadosDaMissao = {
  questId: "q1",
  tipo: "STORY",
  nome: "Sem slot",
  premio: { xp: 10, moedas: 0, cristais: 0, colecionaveis: [] },
  competenciasExigidas: [],
  desbloqueio: null,
  atividades: [{ activityId: "fixa-1", fase: 0 }],
  slotsPendentes: [],
};

function missaoComSlots(slots: readonly SlotPendente[]): DadosDaMissao {
  return { ...MISSAO_SEM_SLOT, nome: "Com slot", slotsPendentes: slots };
}

function missaoComUmSlot(regra: RegraDeSlot): DadosDaMissao {
  return missaoComSlots([{ stageId: "stg1", order: 0, fase: 0, regra }]);
}

interface RepositorioFalsoConfig {
  readonly contexto?: ContextoParaSlots | null;
  readonly candidatasPorObjetivo?: Record<string, readonly CandidataParaSlot[]>;
  readonly candidatasPorCompetencia?: Record<string, readonly CandidataParaSlot[]>;
  readonly vistas?: ReadonlySet<string>;
  readonly jaResolvidos?: ReadonlyMap<string, string>;
  readonly filaDeRevisao?: readonly ItemDaFilaDeRevisao[];
}

function criarRepositorioFalso(config: RepositorioFalsoConfig = {}) {
  const persistido = new Map(config.jaResolvidos ?? []);

  const chamadas = {
    contexto: 0,
    candidatas: 0,
    vistasRecentemente: 0,
    resolver: 0,
    filaDeRevisaoVencida: 0,
    candidatasPorCompetencia: 0,
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
    async filaDeRevisaoVencida(_learnerId, _agora, limite) {
      chamadas.filaDeRevisaoVencida += 1;
      return (config.filaDeRevisao ?? []).slice(0, limite);
    },
    async candidatasPorCompetencia(skillId) {
      chamadas.candidatasPorCompetencia += 1;
      return config.candidatasPorCompetencia?.[skillId] ?? [];
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

describe("resolver slots da missão — modo objetivo", () => {
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
    const missao = missaoComUmSlot(objetivo("obj1"));

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
    const missao = missaoComUmSlot(objetivo("obj1"));

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
    const missao = missaoComUmSlot(objetivo("obj1"));

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
      slotsPendentes: [{ stageId: "stg1", order: 0, fase: 0, regra: objetivo("obj1") }],
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
    const missao = missaoComUmSlot(objetivo("obj1"));

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
    const missao = missaoComUmSlot(objetivo("obj1", -300));

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
    const missao = missaoComUmSlot(objetivo("obj1"));
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
    const missao = missaoComUmSlot(objetivo("obj1"));
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
        { stageId: "stg1", order: 0, fase: 0, regra: objetivo("obj1") },
        { stageId: "stg1", order: 1, fase: 0, regra: objetivo("obj2") },
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

describe("resolver slots da missão — modo revisão", () => {
  it("preenche o slot com a competência mais vencida da fila", async () => {
    const missao = missaoComUmSlot(revisao());

    const { repositorio, chamadas } = criarRepositorioFalso({
      filaDeRevisao: [{ skillId: "skill1", ability: 1000 }],
      candidatasPorCompetencia: {
        skill1: [
          candidata({ activityId: "perto", dificuldade: 1060 }),
          candidata({ activityId: "longe", dificuldade: 1800 }),
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
      { activityId: "perto", fase: 0 },
    ]);
    expect(chamadas.candidatasPorCompetencia).toBe(1);
  });

  it("NÃO exclui atividade vista nas últimas 48h — revisar é voltar ao que já foi visto", async () => {
    const missao = missaoComUmSlot(revisao());

    const { repositorio } = criarRepositorioFalso({
      filaDeRevisao: [{ skillId: "skill1", ability: 1000 }],
      candidatasPorCompetencia: {
        skill1: [candidata({ activityId: "vista-ontem", dificuldade: 1060 })],
      },
      vistas: new Set(["vista-ontem"]),
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([
      { activityId: "fixa-1", fase: 0 },
      { activityId: "vista-ontem", fase: 0 },
    ]);
  });

  it("cada slot recebe uma competência diferente, na ordem da fila", async () => {
    const missao = missaoComSlots([
      { stageId: "stg1", order: 0, fase: 0, regra: revisao() },
      { stageId: "stg1", order: 1, fase: 0, regra: revisao() },
    ]);

    const { repositorio } = criarRepositorioFalso({
      filaDeRevisao: [
        { skillId: "mais-vencida", ability: 1000 },
        { skillId: "menos-vencida", ability: 1000 },
      ],
      candidatasPorCompetencia: {
        "mais-vencida": [candidata({ activityId: "atividade-1", dificuldade: 1060 })],
        "menos-vencida": [candidata({ activityId: "atividade-2", dificuldade: 1060 })],
      },
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades.map((a) => a.activityId)).toEqual([
      "fixa-1",
      "atividade-1",
      "atividade-2",
    ]);
  });

  it("fila mais curta que os slots: o que sobra segue pendente, sem erro", async () => {
    const missao = missaoComSlots([
      { stageId: "stg1", order: 0, fase: 0, regra: revisao() },
      { stageId: "stg1", order: 1, fase: 0, regra: revisao() },
    ]);

    const { repositorio } = criarRepositorioFalso({
      filaDeRevisao: [{ skillId: "unica-vencida", ability: 1000 }],
      candidatasPorCompetencia: {
        "unica-vencida": [candidata({ activityId: "atividade-1", dificuldade: 1060 })],
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
      { activityId: "atividade-1", fase: 0 },
    ]);
  });

  it("fila vazia: o slot some da missão, o mesmo destino de um slot sem candidata", async () => {
    const missao = missaoComUmSlot(revisao());
    const { repositorio, chamadas } = criarRepositorioFalso({ filaDeRevisao: [] });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    expect(resultado.atividades).toEqual([{ activityId: "fixa-1", fase: 0 }]);
    expect(chamadas.resolver).toBe(0);
  });

  it("slot de objetivo e slot de revisão convivem na mesma missão sem repetir atividade", async () => {
    const missao = missaoComSlots([
      { stageId: "stg1", order: 0, fase: 0, regra: objetivo("obj1") },
      { stageId: "stg1", order: 1, fase: 0, regra: revisao() },
    ]);

    const { repositorio } = criarRepositorioFalso({
      filaDeRevisao: [{ skillId: "obj1", ability: 1000 }],
      candidatasPorObjetivo: {
        obj1: [candidata({ activityId: "so-uma-candidata", dificuldade: 1060 })],
      },
      candidatasPorCompetencia: {
        // Mesmo id de competência do objetivo, de propósito: se os dois
        // caminhos não compartilhassem `usadasNestaMissao`, a mesma atividade
        // sairia escolhida duas vezes.
        obj1: [candidata({ activityId: "so-uma-candidata", dificuldade: 1060 })],
      },
    });
    const resolver = criarResolverSlots({ slots: repositorio, seletor: seletorPorProximidade });

    const resultado = await resolver(
      missao,
      { learnerId: "lrn_1", questRunId: "run_1", agora: AGORA },
      TX_FALSA,
    );

    const escolhidas = resultado.atividades.map((a) => a.activityId);
    // A candidata única foi para o slot de objetivo (resolvido primeiro); o
    // de revisão ficou sem opção e some da missão — nunca duplica.
    expect(escolhidas).toEqual(["fixa-1", "so-uma-candidata"]);
  });
});
