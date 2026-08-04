import { describe, expect, it } from "vitest";

import type { EvaluationResult, RegraDeRecompensa } from "@/activities";
import { FixedClock } from "@/shared/kernel";

import type { DomainEvent, EventBus, Transacao, UnidadeDeTrabalho } from "@/shared/kernel";

import type { ContextoDaTentativa, PlanoDaTentativa } from "../domain/attempt-plan";
import { TOPICO_TELEMETRIA_DE_TENTATIVA, TOPICO_TENTATIVA_AVALIADA } from "../domain/events";
import {
  DominioMudouNoMeio,
  TentativaJaRegistrada,
  type RepositorioDeAvaliacao,
} from "./ports";
import { criarSubmeterTentativa } from "./submit-attempt";

/**
 * O caso de uso é testado com repositório em memória, sem banco e sem espera
 * real. É o que a arquitetura de portas existe para permitir — e o que torna
 * viável cobrir os caminhos que num teste de integração seriam caros ou
 * impossíveis de forçar: a corrida de versão, o retry esgotado, a chave
 * repetida chegando depois.
 */

const AGORA = new Date("2026-03-01T10:00:00Z");

const CONTEXTO: ContextoDaTentativa = {
  learnerId: "lrn_1",
  pseudonymId: "psd_1",
  activityId: "act_1",
  activityType: "MULTIPLE_CHOICE",
  objectiveId: "obj_1",
  skillId: "skl_1",
  dificuldade: 1000,
  dificuldadeDeReferencia: 1000,
  dominio: null,
  revisao: null,
  tentativasNaAtividade: 0,
  semFolego: false,
};

const ACERTOU: EvaluationResult = {
  outcome: "CORRECT",
  scoreRatio: 1,
  feedback: { tom: "CELEBRA", mensagem: "Isso!" },
};

const PULOU: EvaluationResult = { outcome: "SKIPPED", scoreRatio: 0 };

const RECOMPENSA: RegraDeRecompensa = {
  porDesfecho: {
    CORRECT: {
      xp: 10,
      moedas: 5,
      cristais: 0,
      diamantes: 0,
      folego: 0,
      itens: [],
      conquistas: [],
      desbloqueios: [],
      colecionaveis: [],
    },
    PARTIAL: vazio(),
    INCORRECT: vazio(),
  },
  multiplicadorPorDica: [1, 0.6, 0.4],
  decaimentoPorRepeticao: [1, 0.3, 0.1, 0],
  aplicarFatorDeDificuldade: true,
};

function vazio() {
  return {
    xp: 0,
    moedas: 0,
    cristais: 0,
    diamantes: 0,
    folego: 0,
    itens: [],
    conquistas: [],
    desbloqueios: [],
    colecionaveis: [],
  };
}

const entrada = (parcial: Record<string, unknown> = {}) => ({
  learnerId: "lrn_1",
  refDaAtividade: "conhecimento/matematica/SPROUT/n1/m1/missao-1/fase-1/atividade-1",
  resultado: ACERTOU,
  probabilidadeDeChute: 0.25,
  regraDeRecompensa: RECOMPENSA,
  resposta: { escolha: 2 },
  dicasUsadas: 0,
  duracaoMs: 4000,
  questRunId: null,
  idempotencyKey: "0199aa11-2233-4455-6677-8899aabbccdd",
  avaliadaNoCliente: true,
  traceId: "trace-1",
  ...parcial,
});

/**
 * Desfecho programado de uma gravação.
 *
 * Os dois erros são os que o caso de uso trata: um vira "já registrada", o
 * outro vira releitura. Qualquer outro tem que subir.
 */
type Desfecho = "gravado" | "duplicada" | "conflito";

/** Repositório em memória com desfechos de gravação programáveis. */
function repositorioFalso(
  opcoes: {
    contexto?: ContextoDaTentativa | null;
    desfechos?: readonly Desfecho[];
  } = {},
) {
  const registradas = new Set<string>();
  const gravados: PlanoDaTentativa[] = [];
  const desfechos = [...(opcoes.desfechos ?? [])];
  let leituras = 0;

  const repositorio: RepositorioDeAvaliacao = {
    async jaRegistrada(chave) {
      return registradas.has(chave);
    },

    async carregarContexto() {
      leituras += 1;
      return opcoes.contexto === undefined ? CONTEXTO : opcoes.contexto;
    },

    async gravar(plano) {
      const desfecho = desfechos.shift() ?? "gravado";

      if (desfecho === "duplicada") {
        throw new TentativaJaRegistrada(plano.tentativa.idempotencyKey);
      }
      if (desfecho === "conflito") throw new DominioMudouNoMeio();

      registradas.add(plano.tentativa.idempotencyKey);
      gravados.push(plano);
      return String(gravados.length);
    },
  };

  return {
    repositorio,
    gravados,
    registradas,
    get leituras() {
      return leituras;
    },
  };
}

/**
 * Unidade de trabalho de mentira: executa o trabalho sem transação nenhuma.
 *
 * Não desfaz nada — e não precisa. O que este teste prova é a *decisão* do caso
 * de uso diante de cada desfecho. Que a transação realmente desfaça é o que o
 * teste de integração prova, contra Postgres, porque nenhum dublê consegue.
 */
const TX_FALSA = {} as Transacao;

const unidadeDeTrabalhoFalsa: UnidadeDeTrabalho = {
  executar: (trabalho) => trabalho(TX_FALSA),
};

function barramentoFalso() {
  const publicados: DomainEvent[] = [];
  const barramento: EventBus = {
    async publicar(eventos) {
      publicados.push(...eventos);
    },
  };
  return { barramento, publicados };
}

const deps = (repositorio: RepositorioDeAvaliacao) => {
  const esperas: number[] = [];
  const { barramento, publicados } = barramentoFalso();

  return {
    esperas,
    publicados,
    deps: {
      repositorio,
      unidadeDeTrabalho: unidadeDeTrabalhoFalsa,
      barramento,
      clock: new FixedClock(AGORA),
      dormir: async (ms: number) => {
        esperas.push(ms);
      },
    },
  };
};

describe("submeterTentativa", () => {
  it("grava a tentativa, o domínio, a revisão e os dois eventos", async () => {
    const falso = repositorioFalso();
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    const resultado = await submeter(entrada());

    expect(resultado.ok).toBe(true);
    expect(falso.gravados).toHaveLength(1);

    const plano = falso.gravados[0]!;
    expect(plano.tentativa.outcome).toBe("CORRECT");
    expect(plano.dominio).not.toBeNull();
    expect(plano.revisao).not.toBeNull();
    expect(plano.eventos.map((e) => e.name)).toEqual([
      TOPICO_TENTATIVA_AVALIADA,
      TOPICO_TELEMETRIA_DE_TENTATIVA,
    ]);
  });

  it("o prêmio é calculado, e sai no evento para a economia creditar", async () => {
    const falso = repositorioFalso();
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    const resultado = await submeter(entrada());

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.value.premio?.xp).toBeGreaterThan(0);
    expect(falso.gravados[0]!.eventos[0].payload.premio).toEqual(resultado.value.premio);
  });

  it("pular não move domínio nem revisão — mas a tentativa fica no histórico", async () => {
    const falso = repositorioFalso();
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    await submeter(entrada({ resultado: PULOU }));

    const plano = falso.gravados[0]!;
    expect(plano.tentativa.outcome).toBe("SKIPPED");
    expect(plano.dominio).toBeNull();
    expect(plano.revisao).toBeNull();
  });

  it("a mesma chave duas vezes registra uma tentativa só", async () => {
    const falso = repositorioFalso();
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    const primeira = await submeter(entrada());
    const segunda = await submeter(entrada());

    expect(primeira.ok && primeira.value.repetida).toBe(false);
    expect(segunda.ok && segunda.value.repetida).toBe(true);
    expect(falso.gravados).toHaveLength(1);
  });

  it("nada é concedido na repetição — mostrar prêmio de novo seria mentir", async () => {
    const falso = repositorioFalso();
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    await submeter(entrada());
    const segunda = await submeter(entrada());

    expect(segunda.ok && segunda.value.premio).toBeNull();
  });

  it("chave duplicada detectada só na gravação também não duplica", async () => {
    // O caminho da corrida: duas requisições passam pela consulta prévia e é o
    // índice único que decide. Quem perde precisa responder "já registrado",
    // nunca erro.
    const falso = repositorioFalso({ desfechos: ["duplicada"] });
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    const resultado = await submeter(entrada());

    expect(resultado.ok && resultado.value.repetida).toBe(true);
    expect(falso.gravados).toHaveLength(0);
  });

  it("conflito de versão faz reler e recalcular, não reenviar o mesmo plano", async () => {
    const falso = repositorioFalso({
      desfechos: ["conflito", "gravado"],
    });
    const montado = deps(falso.repositorio);
    const submeter = criarSubmeterTentativa(montado.deps);

    const resultado = await submeter(entrada());

    expect(resultado.ok).toBe(true);
    // Duas leituras: reaproveitar o plano aplicaria o BKT sobre uma
    // probabilidade que já não existe.
    expect(falso.leituras).toBe(2);
    expect(montado.esperas).toHaveLength(1);
  });

  it("desiste depois de três rodadas, com erro de conflito", async () => {
    const falso = repositorioFalso({
      desfechos: ["conflito", "conflito", "conflito"],
    });
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    const resultado = await submeter(entrada());

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.code).toBe("assessment.concurrent_update");
    expect(falso.leituras).toBe(3);
  });

  it("atividade fora do banco é NOT_FOUND com instrução acionável", async () => {
    const falso = repositorioFalso({ contexto: null });
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    const resultado = await submeter(entrada());

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.kind).toBe("NOT_FOUND");
    expect(resultado.error.code).toBe("assessment.activity_not_published");
  });

  it("a telemetria não carrega o id real da criança", async () => {
    const falso = repositorioFalso();
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    await submeter(entrada());

    const telemetria = falso.gravados[0]!.eventos[1];
    const serializado = JSON.stringify(telemetria.payload);

    expect(telemetria.payload.pseudonymId).toBe("psd_1");
    expect(serializado).not.toContain(CONTEXTO.learnerId);
  });

  it("o prêmio usa a habilidade de antes da tentativa", async () => {
    const falso = repositorioFalso({
      contexto: {
        ...CONTEXTO,
        dominio: {
          probabilidade: 0.4,
          habilidade: 1400,
          tentativas: 5,
          acertos: 3,
          sequencia: 1,
          dominadaEm: null,
          ultimaTentativaEm: new Date("2026-02-28T10:00:00Z"),
          versao: 5,
        },
      },
    });
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    const resultado = await submeter(entrada());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    /*
     * Habilidade 1400 contra dificuldade 1000: o fator cai para 0.6 (piso), e
     * 10 de XP viram 6. Se o cálculo usasse a habilidade *depois* da tentativa,
     * o número mudaria — e quem acertasse algo difícil seria pago como se
     * tivesse feito algo fácil.
     */
    expect(resultado.value.premio?.xp).toBe(6);
    expect(falso.gravados[0]!.dominio?.versaoEsperada).toBe(5);
  });

  it("sem Fôlego, XP continua integral e a moeda não", async () => {
    const falso = repositorioFalso({ contexto: { ...CONTEXTO, semFolego: true } });
    const submeter = criarSubmeterTentativa(deps(falso.repositorio).deps);

    const resultado = await submeter(entrada());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // Regra ética de docs/08 §4: energia nunca impede aprender.
    expect(resultado.value.premio?.xp).toBeGreaterThan(0);
    expect(resultado.value.premio?.moedas).toBe(0);
  });
});
