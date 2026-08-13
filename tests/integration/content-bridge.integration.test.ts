import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seletorPorProximidade } from "@/activities";
import { carregarMissaoParaSessao } from "@/activities/content-bridge";
import { carregarAcervo } from "@/content/loader";
import {
  criarCreditoDeMissao as criarCreditoDeMissaoNaCarteira,
  criarCreditoDeRecompensa,
} from "@/modules/economy";
import { criarRepositorioPrismaDeCarteira } from "@/modules/economy/infrastructure/prisma-wallet-repository";
import {
  criarCobrancaDeFolego,
  criarCreditoDeMissao as criarCreditoDeMissaoNaLuz,
  criarCreditoDeTentativa,
} from "@/modules/progression";
import { criarRepositorioPrismaDeProgresso } from "@/modules/progression/infrastructure/prisma-progress-repository";
import { criarAbrirJogada, criarAvancoDaCorrida } from "@/modules/quest";
import { criarLeituraPrismaDoMapa } from "@/modules/quest/infrastructure/prisma-map-reader";
import { criarRepositorioPrismaDeMissoes } from "@/modules/quest/infrastructure/prisma-quest-repository";
import { criarRepositorioPrismaDeSlots } from "@/modules/quest/infrastructure/prisma-slot-repository";
import { criarBarramento } from "@/server/event-bus";
import { criarUnidadeDeTrabalho } from "@/server/unit-of-work";
import { systemClock, type EventHandler } from "@/shared/kernel";

/**
 * A PONTE DE CONTEÚDO SABE LER O BANCO — Postgres de verdade.
 *
 * `carregarMissaoParaSessao` é o que a página e as três Server Actions de
 * `app/(play)/missao/[slug]/` chamam para montar a sessão que o navegador
 * recebe. Este teste cobre exatamente o achado registrado em
 * `docs/HANDOFF.md`: sem `learnerId`, a função nunca toca o banco (prova
 * completa em `tests/motor/jornada-da-missao.test.ts`, que roda sem Postgres);
 * com ele, um slot já resolvido (docs/08 §7) chega pronto para a tela, e a
 * "Fila de Revisão" — que não existe em `content/` — é montada inteira a
 * partir do banco.
 */

const db = new PrismaClient();

const progresso = criarRepositorioPrismaDeProgresso(db);
const carteira = criarRepositorioPrismaDeCarteira(db);
const missoes = criarRepositorioPrismaDeMissoes();
const slots = criarRepositorioPrismaDeSlots();
const leitura = criarLeituraPrismaDoMapa(db);

const MANIPULADORES: readonly EventHandler[] = [
  criarCobrancaDeFolego({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeTentativa({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeRecompensa({ repositorio: carteira }),
  criarAvancoDaCorrida({ repositorio: missoes, slots, seletor: seletorPorProximidade, clock: systemClock }),
  criarCreditoDeMissaoNaLuz({ repositorio: progresso, clock: systemClock }),
  criarCreditoDeMissaoNaCarteira({ repositorio: carteira }),
] as readonly EventHandler[];

const unidadeDeTrabalho = criarUnidadeDeTrabalho(db);
const barramento = criarBarramento(MANIPULADORES);

const abrir = criarAbrirJogada({
  repositorio: missoes,
  leitura,
  slots,
  seletor: seletorPorProximidade,
  unidadeDeTrabalho,
  barramento,
  clock: systemClock,
});

const REF_DA_FILA = "sistema/fila-de-revisao";

async function garantirFixtureDeRevisao(): Promise<void> {
  await db.academy.upsert({
    where: { id: "sys_academia_revisao" },
    update: {},
    create: {
      id: "sys_academia_revisao",
      slug: "sistema",
      name: "Sistema",
      islandName: "Farol",
      guardian: "SISTEMA",
      theme: {},
      order: 9999,
      minLevel: 1,
    },
  });
  await db.world.upsert({
    where: { id: "sys_mundo_revisao" },
    update: {},
    create: {
      id: "sys_mundo_revisao",
      academyId: "sys_academia_revisao",
      slug: "fila-de-revisao",
      name: "Fila de Revisão",
      mapLayout: { schemaVersion: 1, nos: [], arestas: [] },
      minLevel: 1,
      order: 0,
    },
  });
  await db.chapter.upsert({
    where: { id: "sys_capitulo_revisao" },
    update: {},
    create: { id: "sys_capitulo_revisao", worldId: "sys_mundo_revisao", name: "Revisão", story: {}, order: 0 },
  });
  await db.quest.upsert({
    where: { id: "sys_missao_revisao" },
    update: {},
    create: {
      id: "sys_missao_revisao",
      chapterId: "sys_capitulo_revisao",
      kind: "REVIEW",
      name: "Fila de Revisão",
      narrative: {
        introducao: "Hora de olhar de novo para o que você já aprendeu.",
        conclusao: "Isso ficou guardado.",
      },
      rewardXp: 20,
      rewardCoins: 5,
      rewardCrystals: 0,
      requiredSkills: [],
      unlockRule: {},
      order: 0,
      sourceRef: REF_DA_FILA,
    },
  });
  await db.stage.upsert({
    where: { id: "sys_fase_revisao" },
    update: {},
    create: { id: "sys_fase_revisao", questId: "sys_missao_revisao", order: 0, rule: {} },
  });
  for (let posicao = 0; posicao < 5; posicao += 1) {
    await db.stageActivity.upsert({
      where: { stageId_order: { stageId: "sys_fase_revisao", order: posicao } },
      update: {},
      create: { stageId: "sys_fase_revisao", order: posicao, activityId: null, slotRule: { modo: "revisao" } },
    });
  }
}

/** Uma competência de teste com uma candidata publicada, pronta para vencer na fila. */
async function criarCompetenciaComCandidata(sufixo: string) {
  const academy = await db.academy.create({
    data: {
      slug: `academia-bridge-${sufixo}`,
      name: "Academia de Teste",
      islandName: "Ilha de Teste",
      guardian: "TESTE",
      theme: {},
      order: 900,
    },
  });
  const subject = await db.subject.create({
    data: { academyId: academy.id, code: `TSTBR${sufixo}`, name: "Disciplina de Teste", order: 1 },
  });
  const strand = await db.strand.create({
    data: { subjectId: subject.id, code: "T1", name: "Eixo de Teste", order: 1 },
  });
  const skill = await db.skill.create({
    data: {
      strandId: strand.id,
      name: `Competência bridge ${sufixo}`,
      description: "Competência criada só para este teste.",
      minAgeBand: "SPROUT",
      maxAgeBand: "SPROUT",
      difficultyRef: 1000,
      order: 1,
    },
  });
  const objective = await db.objective.create({
    data: { skillId: skill.id, name: `Objetivo bridge ${sufixo}`, order: 1 },
  });
  const atividade = await db.activity.create({
    data: {
      objectiveId: objective.id,
      type: "MULTIPLE_CHOICE",
      config: { pergunta: "2 + 2?", opcoes: [{ id: "a", texto: "4", correta: true }] },
      difficulty: 1060,
      estimatedSec: 30,
      minAgeBand: "SPROUT",
      maxAgeBand: "SPROUT",
      status: "PUBLISHED",
      locale: "pt-BR",
      sourceRef: `teste/bridge/${sufixo}/atividade`,
    },
  });

  return { skillId: skill.id, activityId: atividade.id, sourceRef: atividade.sourceRef! };
}

async function venceuHa(horas: number, skillId: string, learnerId: string): Promise<void> {
  await db.reviewCard.upsert({
    where: { learnerId_skillId: { learnerId, skillId } },
    update: { dueAt: new Date(Date.now() - horas * 60 * 60 * 1000) },
    create: { learnerId, skillId, dueAt: new Date(Date.now() - horas * 60 * 60 * 1000) },
  });
}

let learnerId = "";
let accountId = "";
let slugDaMissaoReal = "";

async function limparJogadas(): Promise<void> {
  await db.attempt.deleteMany();
  await db.questRun.deleteMany();
  await db.reviewCard.deleteMany();
  await db.skillMastery.deleteMany();
  await db.outboxMessage.deleteMany();
  await db.learningEvent.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.wallet.deleteMany();
  await db.unlock.deleteMany();
  await db.learnerProgress.deleteMany();
}

async function limparCompetenciasDeTeste(): Promise<void> {
  await db.activity.deleteMany({ where: { sourceRef: { startsWith: "teste/bridge/" } } });
  await db.objective.deleteMany({ where: { name: { startsWith: "Objetivo bridge" } } });
  await db.skill.deleteMany({ where: { name: { startsWith: "Competência bridge" } } });
  await db.subject.deleteMany({ where: { code: { startsWith: "TSTBR" } } });
  await db.academy.deleteMany({ where: { slug: { startsWith: "academia-bridge-" } } });
}

beforeAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany();
  await db.learner.deleteMany();
  await db.account.deleteMany({ where: { email: "bridge@teste.local" } });
  await limparCompetenciasDeTeste();
  await garantirFixtureDeRevisao();

  const { acervo } = await carregarAcervo();
  const primeira = acervo.missoes[0];
  expect(primeira).toBeDefined();
  slugDaMissaoReal = primeira!.missao.slug;

  const conta = await db.account.create({
    data: { email: "bridge@teste.local", name: "Responsável de Teste" },
  });
  accountId = conta.id;

  const crianca = await db.learner.create({
    data: {
      displayName: "Teste",
      birthYear: 2019,
      ageBand: "SPROUT",
      avatarConfig: { schemaVersion: 1 },
      guardians: { create: { accountId: conta.id, relation: "mãe", isPrimary: true } },
    },
  });
  learnerId = crianca.id;
});

beforeEach(limparJogadas);

afterAll(async () => {
  await limparJogadas();
  await db.guardianLink.deleteMany({ where: { accountId } });
  await db.learner.deleteMany({ where: { id: learnerId } });
  await db.account.deleteMany({ where: { id: accountId } });
  await limparCompetenciasDeTeste();
  await db.$disconnect();
});

describe("carregarMissaoParaSessao — sem learnerId", () => {
  it("missão do acervo real continua vindo só de content/", async () => {
    const missao = await carregarMissaoParaSessao(slugDaMissaoReal);
    expect(missao).not.toBeNull();
    expect(missao!.fases.reduce((total, f) => total + f.atividades.length, 0)).toBe(3);
  });

  it("a Fila de Revisão não existe sem aceitar o banco", async () => {
    // Sem `learnerId`, a função nunca consulta o banco — e é lá que a Fila
    // de Revisão mora inteira. `content/` não tem esse slug.
    expect(await carregarMissaoParaSessao("fila-de-revisao")).toBeNull();
  });
});

describe("carregarMissaoParaSessao — com learnerId", () => {
  it("missão sem slot continua idêntica (caminho rápido)", async () => {
    const semLearner = await carregarMissaoParaSessao(slugDaMissaoReal);
    const comLearner = await carregarMissaoParaSessao(slugDaMissaoReal, learnerId);

    expect(comLearner).toEqual(semLearner);
  });

  it("a Fila de Revisão abre com fases vazias antes de qualquer jogada", async () => {
    const missao = await carregarMissaoParaSessao("fila-de-revisao", learnerId);

    expect(missao).not.toBeNull();
    expect(missao!.nome).toBe("Fila de Revisão");
    expect(missao!.introducao.length).toBeGreaterThan(0);
    // Nenhuma jogada aberta ainda: nenhum slot foi resolvido. É este estado
    // que faz `MissaoRunner` precisar mostrar a abertura antes de checar se
    // há atividade (docs/HANDOFF.md).
    expect(missao!.fases.every((fase) => fase.atividades.length === 0)).toBe(true);
  });

  it("depois de abrir a jogada, a atividade resolvida aparece pronta para a tela", async () => {
    const { skillId, activityId, sourceRef } = await criarCompetenciaComCandidata("pronta");
    await venceuHa(1, skillId, learnerId);

    const aberta = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    expect(aberta.ok).toBe(true);

    const missao = await carregarMissaoParaSessao("fila-de-revisao", learnerId);
    expect(missao).not.toBeNull();

    const todasAtividades = missao!.fases.flatMap((f) => f.atividades);
    expect(todasAtividades).toHaveLength(1);

    const atividade = todasAtividades[0]!;
    // O slug é sintético (o id da atividade no banco) porque ela nunca teve
    // slug de autoria — mas o `ref` precisa ser o `sourceRef` de verdade,
    // porque é ele que `submeterTentativa` usa para achar a linha.
    expect(atividade.slug).toBe(activityId);
    expect(atividade.ref).toBe(sourceRef);
    expect(atividade.tipo).toBe("MULTIPLE_CHOICE");
    expect(atividade.config).toEqual({
      pergunta: "2 + 2?",
      opcoes: [{ id: "a", texto: "4", correta: true }],
    });
  });

  it("retomar não troca a atividade — `carregarMissaoParaSessao` lê o mesmo slot já gravado", async () => {
    const { skillId } = await criarCompetenciaComCandidata("retomar");
    await venceuHa(1, skillId, learnerId);

    const primeira = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    expect(primeira.ok).toBe(true);

    const antes = await carregarMissaoParaSessao("fila-de-revisao", learnerId);
    const idAntes = antes!.fases.flatMap((f) => f.atividades)[0]?.slug;

    // Reabrir (retomada) não deveria mudar nada — nem a corrida, nem o slot.
    const segunda = await abrir({ learnerId, refDaMissao: REF_DA_FILA, traceId: "t" });
    expect(segunda.ok).toBe(true);
    if (segunda.ok) expect(segunda.value.retomada).toBe(true);

    const depois = await carregarMissaoParaSessao("fila-de-revisao", learnerId);
    const idDepois = depois!.fases.flatMap((f) => f.atividades)[0]?.slug;

    expect(idDepois).toBe(idAntes);
  });
});
