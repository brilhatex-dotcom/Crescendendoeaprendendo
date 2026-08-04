import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { EvaluationResult, RegraDeRecompensa } from "@/activities";
import {
  TOPICO_TELEMETRIA_DE_TENTATIVA,
  planejarTentativa,
  type ContextoDaTentativa,
} from "@/modules/assessment";

/**
 * REGRAS CONSTITUCIONAIS DA AVALIAÇÃO (docs/08 §12).
 *
 * Estes testes não medem qualidade de código: eles impedem que uma decisão que
 * define o produto seja desfeita por engano. Cada um corresponde a uma promessa
 * feita a quem confia uma criança a este sistema, e quebrá-la tem que quebrar o
 * build — não render um comentário em revisão de código.
 */

const CONTEXTO: ContextoDaTentativa = {
  learnerId: "lrn_segredo",
  pseudonymId: "psd_publico",
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

const RECOMPENSA: RegraDeRecompensa = {
  porDesfecho: {
    CORRECT: {
      xp: 10,
      moedas: 5,
      cristais: 2,
      diamantes: 0,
      folego: 0,
      itens: ["chapeu-de-palha"],
      conquistas: [],
      desbloqueios: [],
      colecionaveis: ["concha-azul"],
    },
    PARTIAL: vazio(),
    INCORRECT: vazio(),
  },
  multiplicadorPorDica: [1],
  decaimentoPorRepeticao: [1],
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

const submissao = {
  resultado: ACERTOU,
  probabilidadeDeChute: 0.25,
  regraDeRecompensa: RECOMPENSA,
  resposta: { escolha: 1 },
  dicasUsadas: 0,
  duracaoMs: 3000,
  questRunId: null,
  idempotencyKey: "chave-de-politica-0001",
  avaliadaNoCliente: false,
  traceId: "trace-politica",
  agora: new Date("2026-03-01T10:00:00Z"),
};

const ler = (caminho: string): string =>
  readFileSync(join(process.cwd(), caminho), "utf8");

describe("§12.2 — nenhum caminho bloqueia aprender por falta de Fôlego", () => {
  it("sem Fôlego, a tentativa é registrada e o domínio evolui igual", () => {
    const comFolego = planejarTentativa(CONTEXTO, submissao);
    const semFolego = planejarTentativa({ ...CONTEXTO, semFolego: true }, submissao);

    expect(semFolego.tentativa.outcome).toBe("CORRECT");
    expect(semFolego.dominio?.proximo).toEqual(comFolego.dominio?.proximo);
    expect(semFolego.revisao?.proximo).toEqual(comFolego.revisao?.proximo);
  });

  it("sem Fôlego, o XP é integral — só o cosmético e a moeda param", () => {
    const plano = planejarTentativa({ ...CONTEXTO, semFolego: true }, submissao);

    // Energia ritma a sessão; ela não é pedágio para aprender (docs/08 §4).
    expect(plano.premio?.xp).toBeGreaterThan(0);
    expect(plano.premio?.moedas).toBe(0);
    expect(plano.premio?.cristais).toBe(0);
    expect(plano.premio?.itens).toEqual([]);
    expect(plano.premio?.colecionaveis).toEqual([]);
  });
});

describe("§12.7 — telemetria jamais carrega o id real da criança", () => {
  it("o evento de telemetria leva o pseudônimo e nada mais que identifique", () => {
    const plano = planejarTentativa(CONTEXTO, submissao);
    const telemetria = plano.eventos.find((e) => e.name === TOPICO_TELEMETRIA_DE_TENTATIVA);

    expect(telemetria).toBeDefined();
    expect(telemetria!.payload.pseudonymId).toBe(CONTEXTO.pseudonymId);
    expect(JSON.stringify(telemetria!.payload)).not.toContain(CONTEXTO.learnerId);
  });

  it("os dois públicos têm tópicos separados — um evento só juntaria os dois", () => {
    const plano = planejarTentativa(CONTEXTO, submissao);
    const topicos = plano.eventos.map((e) => e.name);

    expect(new Set(topicos).size).toBe(topicos.length);
  });
});

describe("§11 — a consistência transacional não é opcional", () => {
  it("existe uma transação só, com isolamento declarado, aberta pelo caso de uso", () => {
    const unidade = ler("src/server/unit-of-work.ts");
    const casoDeUso = ler("src/modules/assessment/application/submit-attempt.ts");

    expect(unidade).toContain("$transaction");
    expect(unidade).toContain("ReadCommitted");

    /*
     * A transação é aberta **acima** do repositório de propósito: docs/08 §11
     * exige que `LearnerProgress` e `Wallet` sejam atômicos com a tentativa, e
     * esses moram em outros módulos. Se o repositório voltar a abrir a sua, a
     * Luz sai da atomicidade sem ninguém notar.
     */
    expect(casoDeUso).toContain("unidadeDeTrabalho.executar");
    expect(casoDeUso).toContain("barramento.publicar");

    const repositorio = ler(
      "src/modules/assessment/infrastructure/prisma-assessment-repository.ts",
    );
    expect(repositorio).not.toContain("$transaction");
    for (const tabela of ["attempt.create", "skillMastery", "reviewCard"]) {
      expect(repositorio).toContain(tabela);
    }
  });

  it("o outbox é gravado dentro da mesma transação da origem", () => {
    const barramento = ler("src/server/event-bus.ts");

    // Publicar depois do commit abriria a janela em que um processo derrubado
    // deixaria um efeito por acontecer para sempre.
    expect(barramento).toContain("outboxMessage.create");
    expect(barramento).toContain("clienteDaTransacao(tx)");
  });

  it("a linha quente de domínio usa atualização condicional por versão", () => {
    const fonte = ler(
      "src/modules/assessment/infrastructure/prisma-assessment-repository.ts",
    );

    // Sem o `version` no WHERE, duas respostas simultâneas na mesma competência
    // fariam a segunda sobrescrever a primeira — e a tentativa perdida
    // continuaria em `Attempt`, divergindo do modelo em silêncio.
    expect(fonte).toMatch(/updateMany\(\{[\s\S]*?version: versaoEsperada/);
  });
});

describe("§5.2 — toda ação com efeito econômico exige chave de idempotência", () => {
  it("a ação de responder atividade é declarada idempotente", () => {
    const fonte = ler("app/(play)/missao/[slug]/actions.ts");
    expect(fonte).toContain("idempotente: true");
  });

  it("o wrapper recusa a ação idempotente sem chave válida", () => {
    const fonte = ler("src/server/action.ts");

    // Fail-closed. Aceitar e seguir é o comportamento que transforma um toque
    // duplo em dois créditos.
    expect(fonte).toContain("lerChaveDeIdempotencia");
    expect(fonte).toMatch(/if \(!chave\)/);
  });

  it("a chave viaja até a linha que ela protege", () => {
    const fonte = ler("src/modules/assessment/domain/attempt-plan.ts");
    expect(fonte).toContain("idempotencyKey: submissao.idempotencyKey");
  });
});
