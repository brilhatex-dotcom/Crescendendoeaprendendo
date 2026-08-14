import {
  type ActivityType,
  type AgeBand,
  ContentOrigin,
  ContentStatus,
  Prisma,
  type PrismaClient,
  type QuestKind,
} from "@prisma/client";

import type { EscritorDeConteudo, ResumoDaEscrita } from "../application/ports";
import type { PlanoDeImportacao } from "../domain/plan";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESCRITOR PRISMA — grava o plano no Postgres
 *
 *  Duas propriedades sustentam este arquivo:
 *
 *  1. **Idempotência.** Cada linha é gravada por `upsert` sobre a chave
 *     natural, nunca por `create`. Publicar duas vezes o mesmo conteúdo deixa
 *     o banco idêntico. Isso não é elegância: `Attempt` aponta para
 *     `Activity.id`, então uma atividade duplicada apagaria o histórico de
 *     quem já jogou aquela missão.
 *
 *  2. **Atomicidade.** Tudo em uma transação. Um acervo meio gravado é uma
 *     criança abrindo uma missão cuja fase seguinte não existe.
 *
 *  Nada aqui apaga conteúdo. Remover uma missão de `content/` não a remove do
 *  banco — despublicar é uma decisão editorial com efeito sobre progresso
 *  gravado, e por isso é operação separada e explícita.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** O timeout padrão de 5s é curto para um acervo que cresce. */
const TIMEOUT_DA_TRANSACAO_MS = 120_000;

export function criarEscritorPrismaDeConteudo(db: PrismaClient): EscritorDeConteudo {
  return {
    async gravar(plano: PlanoDeImportacao): Promise<ResumoDaEscrita> {
      return db.$transaction(
        async (tx) => {
          // ── Academia ─────────────────────────────────────────────────────
          const idPorAcademia = new Map<string, string>();

          for (const linha of plano.academias) {
            const dados = {
              name: linha.nome,
              islandName: linha.ilha,
              guardian: linha.guardiao,
              theme: {
                schemaVersion: 1,
                de: linha.tema.de,
                para: linha.tema.para,
                brilho: linha.tema.brilho,
              },
              order: linha.ordem,
            };

            const academia = await tx.academy.upsert({
              where: { slug: linha.slug },
              create: { slug: linha.slug, ...dados },
              update: dados,
            });

            idPorAcademia.set(linha.slug, academia.id);
          }

          // ── Disciplina ───────────────────────────────────────────────────
          const idPorDisciplina = new Map<string, string>();

          for (const linha of plano.disciplinas) {
            const academyId = idPorAcademia.get(linha.academiaSlug);
            if (academyId === undefined) continue;

            const disciplina = await tx.subject.upsert({
              where: { code: linha.codigo },
              create: {
                code: linha.codigo,
                academyId,
                name: linha.nome,
                order: linha.ordem,
              },
              update: { academyId, name: linha.nome, order: linha.ordem },
            });

            idPorDisciplina.set(linha.codigo, disciplina.id);
          }

          // ── Eixo (Strand) ────────────────────────────────────────────────
          const idPorEixo = new Map<string, string>();

          for (const linha of plano.eixos) {
            const subjectId = idPorDisciplina.get(linha.disciplinaCodigo);
            if (subjectId === undefined) continue;

            const eixo = await tx.strand.upsert({
              where: { subjectId_code: { subjectId, code: linha.codigo } },
              create: {
                subjectId,
                code: linha.codigo,
                name: linha.nome,
                order: linha.ordem,
              },
              update: { name: linha.nome, order: linha.ordem },
            });

            idPorEixo.set(`${linha.disciplinaCodigo}/${linha.codigo}`, eixo.id);
          }

          // ── Competência (Skill) ──────────────────────────────────────────
          const idPorCompetencia = new Map<string, string>();

          for (const linha of plano.competencias) {
            const strandId = idPorEixo.get(`${linha.disciplinaCodigo}/${linha.eixoCodigo}`);
            if (strandId === undefined) continue;

            const dados = {
              bnccCode: linha.codigoBncc,
              description: linha.descricao,
              /*
               * O currículo é agnóstico de idade — quem carrega faixa é a
               * atividade, e é lá que a seleção adaptativa filtra.
               */
              minAgeBand: "SPROUT" satisfies AgeBand as AgeBand,
              maxAgeBand: "VANGUARD" satisfies AgeBand as AgeBand,
              difficultyRef: linha.dificuldadeRef,
              order: linha.ordem,
            };

            const competencia = await tx.skill.upsert({
              where: { strandId_name: { strandId, name: linha.nome } },
              create: { strandId, name: linha.nome, ...dados },
              update: dados,
            });

            idPorCompetencia.set(
              `${linha.disciplinaCodigo}/${linha.nome}`,
              competencia.id,
            );
          }

          // ── Objetivo (Objective) ─────────────────────────────────────────
          const idPorObjetivo = new Map<string, string>();

          for (const linha of plano.objetivos) {
            const skillId = idPorCompetencia.get(
              `${linha.disciplinaCodigo}/${linha.competenciaNome}`,
            );
            if (skillId === undefined) continue;

            const objetivo = await tx.objective.upsert({
              where: { skillId_name: { skillId, name: linha.nome } },
              create: { skillId, name: linha.nome, order: linha.ordem },
              update: { order: linha.ordem },
            });

            idPorObjetivo.set(`${linha.disciplinaCodigo}/${linha.nome}`, objetivo.id);
          }

          // ── Pré-requisito (aresta do DAG) ────────────────────────────────
          let preRequisitosGravados = 0;

          for (const linha of plano.preRequisitos) {
            const skillId = idPorCompetencia.get(
              `${linha.disciplinaCodigo}/${linha.competenciaNome}`,
            );
            const prerequisiteId = idPorCompetencia.get(
              `${linha.disciplinaCodigo}/${linha.preRequisitoNome}`,
            );
            if (skillId === undefined || prerequisiteId === undefined) continue;

            await tx.skillPrerequisite.upsert({
              where: { skillId_prerequisiteId: { skillId, prerequisiteId } },
              create: { skillId, prerequisiteId },
              update: {},
            });
            preRequisitosGravados += 1;
          }

          // ── Mundo (World) ────────────────────────────────────────────────
          const idPorMundo = new Map<string, string>();

          for (const linha of plano.mundos) {
            const academyId = idPorAcademia.get(linha.academiaSlug);
            if (academyId === undefined) continue;

            const dados = {
              name: linha.nome,
              minLevel: linha.nivelMinimo,
              order: linha.ordem,
              /*
               * `schemaVersion` viaja com o layout desde antes de existir
               * conteúdo nenhum — evita ter que adivinhar, no dia em que um
               * segundo formato aparecer, se um layout vazio é "sem mapa" ou
               * "mapa no formato antigo".
               */
              mapLayout: linha.mapa
                ? {
                    schemaVersion: 1,
                    nos: linha.mapa.nos.map((no) => ({ missaoRef: no.missaoRef, x: no.x, y: no.y })),
                    arestas: linha.mapa.arestas.map((aresta) => ({ de: aresta.de, para: aresta.para })),
                  }
                : { schemaVersion: 1, nos: [], arestas: [] },
            };

            const mundo = await tx.world.upsert({
              where: { academyId_slug: { academyId, slug: linha.slug } },
              create: { academyId, slug: linha.slug, ...dados },
              update: dados,
            });

            idPorMundo.set(linha.slug, mundo.id);
          }

          // ── Capítulo (Chapter) ───────────────────────────────────────────
          const idPorCapitulo = new Map<string, string>();

          for (const linha of plano.capitulos) {
            const worldId = idPorMundo.get(linha.mundoSlug);
            if (worldId === undefined) continue;

            const dados = {
              worldId,
              name: linha.nome,
              order: linha.ordem,
              story: { schemaVersion: 1 },
            };

            const capitulo = await tx.chapter.upsert({
              where: { sourceRef: linha.ref },
              create: { sourceRef: linha.ref, ...dados },
              update: dados,
            });

            idPorCapitulo.set(linha.ref, capitulo.id);
          }

          // ── Missão (Quest) ───────────────────────────────────────────────
          const idPorMissao = new Map<string, string>();

          for (const linha of plano.missoes) {
            const chapterId = idPorCapitulo.get(linha.capituloRef);
            if (chapterId === undefined) continue;

            const dados = {
              chapterId,
              kind: linha.tipo as QuestKind,
              name: linha.nome,
              narrative: { schemaVersion: 1, ...linha.narrativa },
              rewardXp: linha.xp,
              rewardCoins: linha.moedas,
              rewardCrystals: linha.cristais,
              rewardCollectibles: [...linha.colecionaveis],
              requiredSkills: [...linha.competenciasExigidas],
              /*
               * A gramática de desbloqueio é avaliada pelo módulo `quest`, que
               * ainda não existe. Guardar o objeto cru preserva o que o autor
               * escreveu sem inventar semântica aqui.
               */
              unlockRule: (linha.regraDeDesbloqueio ?? {}) as object,
              order: linha.ordem,
            };

            const missao = await tx.quest.upsert({
              where: { sourceRef: linha.ref },
              create: { sourceRef: linha.ref, ...dados },
              update: dados,
            });

            idPorMissao.set(linha.ref, missao.id);
          }

          // ── Fase (Stage) ─────────────────────────────────────────────────
          const idPorFase = new Map<string, string>();

          for (const linha of plano.fases) {
            const questId = idPorMissao.get(linha.missaoRef);
            if (questId === undefined) continue;

            const rule = { schemaVersion: 1, ...linha.regra };

            const fase = await tx.stage.upsert({
              where: { questId_order: { questId, order: linha.ordem } },
              create: { questId, order: linha.ordem, rule },
              update: { rule },
            });

            idPorFase.set(`${linha.missaoRef}#${linha.ordem}`, fase.id);
          }

          // ── Atividade (Activity) ─────────────────────────────────────────
          const idPorAtividade = new Map<string, string>();

          for (const linha of plano.atividades) {
            const objectiveId = idPorObjetivo.get(
              `${linha.disciplinaCodigo}/${linha.objetivoNome}`,
            );
            if (objectiveId === undefined) continue;

            const dados = {
              objectiveId,
              type: linha.tipo as ActivityType,
              config: linha.config as object,
              difficulty: linha.dificuldade,
              estimatedSec: linha.duracaoEstimadaSeg,
              minAgeBand: linha.faixaMinima as AgeBand,
              maxAgeBand: linha.faixaMaxima as AgeBand,
              // Motor de Aprendizagem Adaptativa (docs/08 §13) — sempre opcionais.
              requiresReading: linha.requerLeitura,
              visualSupportLevel: linha.suporteVisual,
              interactionType: linha.tipoDeInteracao,
              stepCount: linha.quantidadeDeEtapas,
              // `Prisma.DbNull`, nunca `undefined`: precisa limpar de verdade
              // quando o conteúdo deixa de declarar variantes — `undefined`
              // no `update` do Prisma significa "não mexe", e deixaria
              // variante velha presa no banco depois de removida do arquivo.
              // Bare `null` não é aceito pelo tipo gerado do Prisma para
              // colunas `Json?` — é preciso o sentinela `Prisma.DbNull`.
              presentationVariants:
                linha.variantesDeApresentacao === null
                  ? Prisma.DbNull
                  : (linha.variantesDeApresentacao as Prisma.InputJsonValue),
              origin: ContentOrigin.CURATED,
              /*
               * Conteúdo que passou pelo validador está publicado. A revisão
               * pedagógica acontece antes do arquivo entrar na `main`, não
               * depois de estar no banco.
               */
              status: ContentStatus.PUBLISHED,
            };

            const atividade = await tx.activity.upsert({
              where: { sourceRef: linha.ref },
              create: { sourceRef: linha.ref, ...dados },
              update: dados,
            });

            idPorAtividade.set(linha.ref, atividade.id);
          }

          // ── Vínculo fase↔atividade (StageActivity) ───────────────────────
          let vinculosGravados = 0;

          for (const linha of plano.vinculos) {
            const stageId = idPorFase.get(`${linha.missaoRef}#${linha.faseOrdem}`);
            const activityId = idPorAtividade.get(linha.atividadeRef);
            if (stageId === undefined || activityId === undefined) continue;

            await tx.stageActivity.upsert({
              where: { stageId_order: { stageId, order: linha.ordem } },
              create: { stageId, order: linha.ordem, activityId },
              update: { activityId },
            });
            vinculosGravados += 1;
          }

          // ── Colecionável (Collectible) ────────────────────────────────────
          let colecionaveisGravados = 0;

          for (const linha of plano.colecionaveis) {
            await tx.collectible.upsert({
              where: { code: linha.code },
              create: { code: linha.code, name: linha.nome, symbol: linha.simbolo },
              update: { name: linha.nome, symbol: linha.simbolo },
            });
            colecionaveisGravados += 1;
          }

          // ── Conquista (Achievement) ────────────────────────────────────────
          // `rewardXp` fica em 0 (padrão da coluna): a concessão de XP por
          // conquista ainda não está encanada (docs/HANDOFF.md, "Conquistas").
          let conquistasGravadas = 0;

          for (const linha of plano.conquistas) {
            const dados = {
              name: linha.nome,
              description: linha.descricao,
              family: linha.familia,
              tier: linha.grau,
              hidden: linha.oculta,
              criteria: { tipo: linha.criterio.tipo, minimo: linha.criterio.minimo },
            };

            await tx.achievement.upsert({
              where: { code: linha.code },
              create: { code: linha.code, ...dados },
              update: dados,
            });
            conquistasGravadas += 1;
          }

          return {
            academias: idPorAcademia.size,
            disciplinas: idPorDisciplina.size,
            eixos: idPorEixo.size,
            competencias: idPorCompetencia.size,
            objetivos: idPorObjetivo.size,
            preRequisitos: preRequisitosGravados,
            mundos: idPorMundo.size,
            capitulos: idPorCapitulo.size,
            missoes: idPorMissao.size,
            fases: idPorFase.size,
            atividades: idPorAtividade.size,
            vinculos: vinculosGravados,
            colecionaveis: colecionaveisGravados,
            conquistas: conquistasGravadas,
          };
        },
        { timeout: TIMEOUT_DA_TRANSACAO_MS },
      );
    },
  };
}
