import { refDeAtividade, refDeMissao } from "@/modules/content";
import { carregarAcervo, type MissaoCarregada } from "@/content/loader";
import { db } from "@/server/db";

import { DIFICULDADE_INICIAL } from "./difficulty";
import type { AtividadeNaSessao, FaseNaSessao, MissaoNaSessao } from "./session";

/**
 * Ponte entre o acervo (arquivo e banco) e a sessão de missão.
 *
 * Existe para que o executor de missão não conheça `content/` nem Prisma: ele
 * recebe uma `MissaoNaSessao` e mais nada.
 *
 * ── Duas fontes, uma sessão ──
 * A narrativa e a atividade fixa continuam vindo de `content/` — é a fonte
 * versionada, e reescrever esse caminho não tinha porquê. O que só o banco
 * sabe é **o slot resolvido** (docs/08 §7): `StageActivity.activityId` nulo
 * vira atividade de verdade em `QuestRunSlot`, e nenhum arquivo em disco um
 * dia soube disso — nem podia, porque a escolha é por criança. A "Fila de
 * Revisão" vai além: não tem `content/` nenhum, porque não é conteúdo
 * pedagógico autorado (`docs/HANDOFF.md`).
 *
 * `learnerId` é opcional de propósito: sem ele, esta função **nunca toca o
 * banco** — o caminho que `tests/motor/jornada-da-missao.test.ts` exercita, e
 * que prova que o motor não depende de infraestrutura. Com ele, o banco entra
 * só para completar o que `content/` não pode saber.
 *
 * Roda apenas no servidor.
 */
export async function carregarMissaoParaSessao(
  slug: string,
  learnerId?: string,
): Promise<MissaoNaSessao | null> {
  const { acervo } = await carregarAcervo();
  const encontrada = acervo.missoes.find((m) => m.missao.slug === slug);
  const doConteudo = encontrada ? construirDoConteudo(encontrada) : null;

  if (!learnerId) return doConteudo;

  const arvore = await buscarArvoreDaMissao(
    doConteudo ? { ref: doConteudo.ref } : { slug },
  );
  // Conteúdo existe em disco mas ainda não foi importado (`npm run
  // content:import`), ou a missão não existe em lugar nenhum: não há árvore
  // de `Stage`/`StageActivity` para completar. Devolve o que há — jogar vai
  // falhar mais adiante, com o erro de sempre (`quest.not_published`).
  if (!arvore) return doConteudo;

  const slotsPendentes = arvore.stages.flatMap((fase, indice) =>
    fase.activities
      .filter((atividade) => atividade.activityId === null)
      .map((atividade) => ({ stageId: atividade.stageId, order: atividade.order, fase: indice })),
  );

  const base = doConteudo ?? construirDoBanco(arvore);
  if (!base || slotsPendentes.length === 0) return base;

  const resolvidos = await buscarSlotsResolvidos(arvore.id, learnerId);
  const atividadesResolvidas = await atividadesDosSlots(slotsPendentes, resolvidos);
  if (atividadesResolvidas.length === 0) return base;

  return mesclarNasFases(base, atividadesResolvidas);
}

/** Todas as missões publicadas, para o mapa. */
export async function listarMissoes(): Promise<
  readonly { readonly slug: string; readonly nome: string; readonly atividades: number }[]
> {
  const { acervo } = await carregarAcervo();

  return acervo.missoes.map(({ missao }) => ({
    slug: missao.slug,
    nome: missao.nome,
    atividades: missao.fases.reduce((total, f) => total + f.atividades.length, 0),
  }));
}

// ── Conteúdo em disco → sessão ────────────────────────────────────────────

function construirDoConteudo(encontrada: MissaoCarregada): MissaoNaSessao {
  const { missao } = encontrada;

  return {
    slug: missao.slug,
    ref: refDeMissao(encontrada),
    nome: missao.nome,
    introducao: missao.introducao,
    conclusao: missao.conclusao,
    recompensaDaMissao: missao.recompensaDaMissao,
    fases: missao.fases.map((fase) => ({
      slug: fase.slug,
      nome: fase.nome,
      atividades: fase.atividades.map((atividade) => ({
        slug: atividade.slug,
        // A mesma função que o importador usa para gravar `Activity.sourceRef`.
        // Duas implementações da regra de nomeação seria o jeito garantido de
        // um dia a busca não encontrar a linha que ela própria criou.
        ref: refDeAtividade(encontrada, fase.slug, atividade.slug),
        tipo: atividade.tipo,
        objetivo: atividade.objetivo,
        config: atividade.config,
        dificuldade: atividade.dificuldade,
        recompensa: atividade.recompensa,
      })),
    })),
  };
}

// ── Banco → sessão (slot e missão de sistema) ─────────────────────────────

type ArvoreDaMissao = NonNullable<Awaited<ReturnType<typeof buscarArvoreDaMissao>>>;

async function buscarArvoreDaMissao(chave: { readonly ref: string } | { readonly slug: string }) {
  return db.quest.findFirst({
    where:
      "ref" in chave
        ? { sourceRef: chave.ref }
        : { sourceRef: { endsWith: `/${chave.slug}` } },
    select: {
      id: true,
      name: true,
      narrative: true,
      sourceRef: true,
      stages: {
        orderBy: { order: "asc" },
        select: {
          activities: {
            orderBy: { order: "asc" },
            select: { stageId: true, order: true, activityId: true },
          },
        },
      },
    },
  });
}

/**
 * Missão que só existe no banco — a Fila de Revisão, hoje; qualquer futura
 * missão de sistema, depois. `Stage` não guarda slug nem nome de fase (só
 * conteúdo autorado tem isso); o sintético abaixo nunca é lido por ninguém —
 * nem o executor, nem `encontrarAtividade` — que navegam por índice.
 */
function construirDoBanco(arvore: ArvoreDaMissao): MissaoNaSessao | null {
  if (!arvore.sourceRef) return null;

  const { introducao, conclusao } = textoDaNarrativa(arvore.narrative);

  return {
    slug: arvore.sourceRef.slice(arvore.sourceRef.lastIndexOf("/") + 1),
    ref: arvore.sourceRef,
    nome: arvore.name,
    introducao,
    conclusao,
    recompensaDaMissao: undefined,
    fases: arvore.stages.map((_fase, indice) => ({
      slug: `fase-${indice}`,
      nome: arvore.name,
      atividades: [],
    })),
  };
}

function textoDaNarrativa(bruta: unknown): { readonly introducao: string; readonly conclusao: string } {
  if (bruta && typeof bruta === "object") {
    const { introducao, conclusao } = bruta as Record<string, unknown>;
    if (typeof introducao === "string" && typeof conclusao === "string") {
      return { introducao, conclusao };
    }
  }
  return { introducao: "", conclusao: "" };
}

/** Slots já resolvidos na jogada mais recente desta criança nesta missão. Chave: `stageId:order`. */
async function buscarSlotsResolvidos(
  questId: string,
  learnerId: string,
): Promise<ReadonlyMap<string, string>> {
  const corrida = await db.questRun.findFirst({
    where: { learnerId, questId },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (!corrida) return new Map();

  const linhas = await db.questRunSlot.findMany({
    where: { questRunId: corrida.id },
    select: { stageId: true, order: true, activityId: true },
  });
  return new Map(linhas.map((linha) => [`${linha.stageId}:${linha.order}`, linha.activityId]));
}

interface SlotNaArvore {
  readonly stageId: string;
  readonly order: number;
  readonly fase: number;
}

/** Atividade de cada slot já resolvido, pronta para entrar na sessão — slot sem resolução some. */
async function atividadesDosSlots(
  slotsPendentes: readonly SlotNaArvore[],
  resolvidos: ReadonlyMap<string, string>,
): Promise<readonly { readonly fase: number; readonly atividade: AtividadeNaSessao }[]> {
  const ids = slotsPendentes
    .map((slot) => resolvidos.get(`${slot.stageId}:${slot.order}`))
    .filter((id): id is string => id !== undefined);
  if (ids.length === 0) return [];

  const atividades = await db.activity.findMany({
    where: { id: { in: ids } },
    select: { id: true, objectiveId: true, type: true, config: true, difficulty: true, sourceRef: true },
  });
  const porId = new Map(atividades.map((atividade) => [atividade.id, atividade]));

  const resultado: { fase: number; atividade: AtividadeNaSessao }[] = [];
  for (const slot of slotsPendentes) {
    const activityId = resolvidos.get(`${slot.stageId}:${slot.order}`);
    if (!activityId) continue;

    const linha = porId.get(activityId);
    /*
     * Sem `sourceRef` a atividade não tem como ser referenciada por
     * `submeterTentativa` (docs/HANDOFF.md — é a ponte entre arquivo e
     * histórico). Nunca acontece com atividade importada de verdade; cair
     * fora é mais seguro que entregar uma tela que não sabe responder por si.
     */
    if (!linha || !linha.sourceRef) continue;

    resultado.push({
      fase: slot.fase,
      atividade: {
        // Sintético: esta atividade nunca teve slug de autoria. O id do
        // banco é único e estável — o suficiente para o executor achá-la nas
        // ações seguintes (`encontrarAtividade`).
        slug: linha.id,
        ref: linha.sourceRef,
        tipo: linha.type,
        // `AtividadeNaSessao.objetivo` não é lido em lugar nenhum hoje (é
        // metadado) — o id real é mais honesto que inventar um slug.
        objetivo: linha.objectiveId,
        config: linha.config,
        dificuldade: rotuloDeDificuldade(Number(linha.difficulty)),
        // Sem regra de recompensa: nenhuma atividade do banco carrega uma
        // (é conceito só de autoria). A criança ainda ganha domínio e o
        // prêmio de missão ao concluir — só não ganha XP por esta resposta.
        recompensa: undefined,
      },
    });
  }
  return resultado;
}

/**
 * Converte a dificuldade calibrada (Elo) de volta ao rótulo de autoria.
 *
 * Existe só para preencher um campo que o tipo exige — nenhum consumidor
 * de uma atividade sem `recompensa` chega a ler `dificuldade` (`premioDaAtividade`
 * devolve cedo). Fronteiras nos mesmos pontos de `DIFICULDADE_INICIAL`.
 */
function rotuloDeDificuldade(numero: number): AtividadeNaSessao["dificuldade"] {
  if (numero <= (DIFICULDADE_INICIAL.FACIL + DIFICULDADE_INICIAL.MEDIO) / 2) return "FACIL";
  if (numero >= (DIFICULDADE_INICIAL.MEDIO + DIFICULDADE_INICIAL.DIFICIL) / 2) return "DIFICIL";
  return "MEDIO";
}

function mesclarNasFases(
  base: MissaoNaSessao,
  resolvidas: readonly { readonly fase: number; readonly atividade: AtividadeNaSessao }[],
): MissaoNaSessao {
  const extrasPorFase = new Map<number, AtividadeNaSessao[]>();
  for (const { fase, atividade } of resolvidas) {
    const lista = extrasPorFase.get(fase) ?? [];
    lista.push(atividade);
    extrasPorFase.set(fase, lista);
  }

  const fases: FaseNaSessao[] = base.fases.map((fase, indice) => {
    const extras = extrasPorFase.get(indice);
    return extras ? { ...fase, atividades: [...fase.atividades, ...extras] } : fase;
  });

  return { ...base, fases };
}
