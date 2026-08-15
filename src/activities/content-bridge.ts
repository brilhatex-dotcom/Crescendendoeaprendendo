import { z } from "zod";

import { varianteDeApresentacaoSchema, type AtividadeAutorada } from "@/content/schema";
import {
  criarBuscarPerfilDeAprendizagem,
  escolherApresentacao,
  type ApresentacaoCandidata,
  type CaracteristicasDaAtividade,
  type DimensaoDoPerfil,
} from "@/modules/learning-profile";
import { criarRepositorioPrismaDePerfilDeAprendizagem } from "@/modules/learning-profile/infrastructure/prisma-learning-profile-repository";
import { refDeAtividade, refDeMissao } from "@/modules/content";
import { carregarAcervo, type MissaoCarregada } from "@/content/loader";
import { systemClock } from "@/shared/kernel";
import { db } from "@/server/db";

import { DIFICULDADE_INICIAL } from "./difficulty";
import type { AtividadeNaSessao, FaseNaSessao, MissaoNaSessao } from "./session";

/**
 * Motor de Aprendizagem Adaptativa (Fase 3) — montado uma vez, aqui e não em
 * `src/modules/learning-profile`: este é o único arquivo de `src/activities`
 * liberado a importar `src/modules`/Prisma (`.dependency-cruiser.cjs`, regra
 * `motor-e-puro`), e o único ponto por onde toda atividade — autorada ou de
 * slot — passa antes da tela. Ver `escolherApresentacaoDoConteudo` e
 * `escolherApresentacaoDoBanco` abaixo.
 */
const buscarPerfilDeAprendizagem = criarBuscarPerfilDeAprendizagem({
  repositorio: criarRepositorioPrismaDePerfilDeAprendizagem(db),
  clock: systemClock,
});

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

  // Sem criança, não há perfil a consultar — e nenhuma escolha a fazer além
  // da apresentação padrão. Preserva o caminho que não toca o banco.
  if (!learnerId) {
    return encontrada ? construirDoConteudo(encontrada, []) : null;
  }

  const perfil = await buscarPerfilRelevante(learnerId, encontrada?.academia);
  const doConteudo = encontrada ? construirDoConteudo(encontrada, perfil) : null;

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
  const atividadesResolvidas = await atividadesDosSlots(slotsPendentes, resolvidos, perfil);
  if (atividadesResolvidas.length === 0) return base;

  return mesclarNasFases(base, atividadesResolvidas);
}

/**
 * Perfil relevante para esta missão: por academia quando o conteúdo declara
 * uma (a maioria), global quando não há — missão só de banco (Fila de
 * Revisão), ou a academia ainda não foi encontrada por algum motivo.
 */
async function buscarPerfilRelevante(
  learnerId: string,
  academiaSlug: string | undefined,
): Promise<readonly DimensaoDoPerfil[]> {
  const academyId = academiaSlug ? await idDaAcademia(academiaSlug) : null;
  return buscarPerfilDeAprendizagem(learnerId, academyId);
}

async function idDaAcademia(slug: string): Promise<string | null> {
  const academia = await db.academy.findFirst({ where: { slug }, select: { id: true } });
  return academia?.id ?? null;
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

function construirDoConteudo(
  encontrada: MissaoCarregada,
  perfil: readonly DimensaoDoPerfil[],
): MissaoNaSessao {
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
      atividades: fase.atividades.map((atividade) => {
        const { config, presentationTag } = escolherApresentacaoDoConteudo(atividade, perfil);
        return {
          slug: atividade.slug,
          // A mesma função que o importador usa para gravar `Activity.sourceRef`.
          // Duas implementações da regra de nomeação seria o jeito garantido de
          // um dia a busca não encontrar a linha que ela própria criou.
          ref: refDeAtividade(encontrada, fase.slug, atividade.slug),
          tipo: atividade.tipo,
          objetivo: atividade.objetivo,
          config,
          dificuldade: atividade.dificuldade,
          recompensa: atividade.recompensa,
          presentationTag,
        };
      }),
    })),
  };
}

/**
 * Normaliza as características declaradas em `content/` (português, ver
 * `content/schema/index.ts`) para o formato que o Learning Profile entende
 * (`CaracteristicasDaAtividade`, mesmos nomes das colunas de `Activity`).
 * Só a FORMA muda de nome aqui — nenhum significado é reinterpretado.
 */
function normalizarCaracteristicas(
  caracteristicas:
    | { readonly requerLeitura?: boolean; readonly suporteVisual?: string; readonly quantidadeDeEtapas?: number }
    | undefined,
): CaracteristicasDaAtividade {
  return {
    requiresReading: caracteristicas?.requerLeitura ?? null,
    visualSupportLevel: caracteristicas?.suporteVisual ?? null,
    stepCount: caracteristicas?.quantidadeDeEtapas ?? null,
  };
}

/** Escolhe a apresentação de uma atividade autorada (conteúdo em disco). */
function escolherApresentacaoDoConteudo(
  atividade: AtividadeAutorada,
  perfil: readonly DimensaoDoPerfil[],
): { readonly config: unknown; readonly presentationTag: string | null } {
  const padrao: ApresentacaoCandidata<unknown> = {
    tag: null,
    caracteristicas: normalizarCaracteristicas(atividade.caracteristicas),
    payload: atividade.config,
  };
  const variantes: ApresentacaoCandidata<unknown>[] = (atividade.variantesDeApresentacao ?? []).map(
    (variante) => ({
      tag: variante.tag,
      caracteristicas: normalizarCaracteristicas(variante.caracteristicas),
      payload: variante.config,
    }),
  );

  const escolhida = escolherApresentacao(perfil, padrao, variantes);
  return { config: escolhida.payload, presentationTag: escolhida.tag };
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
  perfil: readonly DimensaoDoPerfil[],
): Promise<readonly { readonly fase: number; readonly atividade: AtividadeNaSessao }[]> {
  const ids = slotsPendentes
    .map((slot) => resolvidos.get(`${slot.stageId}:${slot.order}`))
    .filter((id): id is string => id !== undefined);
  if (ids.length === 0) return [];

  const atividades = await db.activity.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      objectiveId: true,
      type: true,
      config: true,
      difficulty: true,
      sourceRef: true,
      requiresReading: true,
      visualSupportLevel: true,
      stepCount: true,
      presentationVariants: true,
    },
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

    const { config, presentationTag } = escolherApresentacaoDoBanco(linha, perfil);

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
        config,
        dificuldade: rotuloDeDificuldade(Number(linha.difficulty)),
        // Sem regra de recompensa: nenhuma atividade do banco carrega uma
        // (é conceito só de autoria). A criança ainda ganha domínio e o
        // prêmio de missão ao concluir — só não ganha XP por esta resposta.
        recompensa: undefined,
        presentationTag,
      },
    });
  }
  return resultado;
}

const variantesDeApresentacaoDoBancoSchema = z.array(varianteDeApresentacaoSchema).max(5);

/**
 * Escolhe a apresentação de uma atividade que só existe no banco (Fila de
 * Revisão) — as características do padrão já vêm nas colunas de `Activity`,
 * sem tradução; as variantes são JSON cru e precisam da mesma validação que
 * `content/loader.ts` já aplica na importação (aqui, defensiva: um valor que
 * não bate mais com o schema vira "sem variantes", nunca um erro na tela).
 */
function escolherApresentacaoDoBanco(
  linha: {
    readonly config: unknown;
    readonly requiresReading: boolean | null;
    readonly visualSupportLevel: string | null;
    readonly stepCount: number | null;
    readonly presentationVariants: unknown;
  },
  perfil: readonly DimensaoDoPerfil[],
): { readonly config: unknown; readonly presentationTag: string | null } {
  const padrao: ApresentacaoCandidata<unknown> = {
    tag: null,
    caracteristicas: {
      requiresReading: linha.requiresReading,
      visualSupportLevel: linha.visualSupportLevel,
      stepCount: linha.stepCount,
    },
    payload: linha.config,
  };

  const brutas = variantesDeApresentacaoDoBancoSchema.safeParse(linha.presentationVariants);
  const variantes: ApresentacaoCandidata<unknown>[] = brutas.success
    ? brutas.data.map((variante) => ({
        tag: variante.tag,
        caracteristicas: normalizarCaracteristicas(variante.caracteristicas),
        payload: variante.config,
      }))
    : [];

  const escolhida = escolherApresentacao(perfil, padrao, variantes);
  return { config: escolhida.payload, presentationTag: escolhida.tag };
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
