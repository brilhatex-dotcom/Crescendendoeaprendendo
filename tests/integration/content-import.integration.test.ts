import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { carregarAcervo } from "@/content/loader";
import { criarImportarConteudo, planejarImportacao } from "@/modules/content";
import { criarEscritorPrismaDeConteudo } from "@/modules/content/infrastructure/prisma-content-writer";

/**
 * Teste de integração do importador — Postgres de verdade.
 *
 * O teste de `domain/plan.test.ts` prova o *mapeamento* sem banco. Este prova o
 * que dublê nenhum alcança:
 *
 *  · que os `upsert` sobre chave natural realmente não duplicam;
 *  · que a escala Elo do motor cabe nas colunas (`Decimal(7,3)`);
 *  · que a transação inteira grava ou nada grava;
 *  · que o acervo real de `content/` fecha todas as referências.
 *
 * O terceiro item é o que mais importa: `Attempt` aponta para `Activity.id`.
 * Uma reimportação que duplicasse atividade apagaria o histórico de quem já
 * jogou aquela missão — e o sintoma só apareceria semanas depois.
 */

const db = new PrismaClient();

const importar = criarImportarConteudo({
  escritor: criarEscritorPrismaDeConteudo(db),
});

async function limpar(): Promise<void> {
  // Ordem inversa da dependência: filho antes do pai.
  await db.stageActivity.deleteMany();
  await db.stage.deleteMany();
  await db.quest.deleteMany();
  await db.chapter.deleteMany();
  await db.world.deleteMany();
  await db.activity.deleteMany();
  await db.objective.deleteMany();
  await db.skillPrerequisite.deleteMany();
  await db.skill.deleteMany();
  await db.strand.deleteMany();
  await db.subject.deleteMany();
  await db.academy.deleteMany();
}

async function contar() {
  const [academias, disciplinas, competencias, objetivos, missoes, fases, atividades, vinculos] =
    await Promise.all([
      db.academy.count(),
      db.subject.count(),
      db.skill.count(),
      db.objective.count(),
      db.quest.count(),
      db.stage.count(),
      db.activity.count(),
      db.stageActivity.count(),
    ]);

  return { academias, disciplinas, competencias, objetivos, missoes, fases, atividades, vinculos };
}

beforeEach(limpar);

afterAll(async () => {
  await limpar();
  await db.$disconnect();
});

describe("importação do acervo real de content/", () => {
  it("o acervo em disco fecha todas as referências", async () => {
    const { acervo, problemas } = await carregarAcervo();

    expect(problemas).toEqual([]);

    const { problemas: problemasDePlano } = planejarImportacao(acervo);
    expect(problemasDePlano).toEqual([]);
  });

  it("grava o acervo e o deixa jogável", async () => {
    const { acervo } = await carregarAcervo();
    const resultado = await importar({ acervo });

    expect(resultado.ok).toBe(true);

    const contagem = await contar();
    expect(contagem.academias).toBeGreaterThan(0);
    expect(contagem.missoes).toBeGreaterThan(0);
    expect(contagem.atividades).toBeGreaterThan(0);

    // Toda atividade tem que estar pendurada em alguma fase: atividade órfã é
    // conteúdo que ninguém alcança.
    expect(contagem.vinculos).toBe(contagem.atividades);

    // Publicada, porque a revisão pedagógica acontece antes de entrar na main.
    const naoPublicadas = await db.activity.count({
      where: { status: { not: "PUBLISHED" } },
    });
    expect(naoPublicadas).toBe(0);
  });

  it("é idempotente: importar duas vezes não duplica nada", async () => {
    const { acervo } = await carregarAcervo();

    await importar({ acervo });
    const depoisDaPrimeira = await contar();

    await importar({ acervo });
    const depoisDaSegunda = await contar();

    expect(depoisDaSegunda).toEqual(depoisDaPrimeira);
  });

  it("reimportar preserva o id da atividade — é o que protege o histórico", async () => {
    const { acervo } = await carregarAcervo();

    await importar({ acervo });
    const antes = await db.activity.findMany({
      select: { id: true, sourceRef: true },
      orderBy: { sourceRef: "asc" },
    });

    await importar({ acervo });
    const depois = await db.activity.findMany({
      select: { id: true, sourceRef: true },
      orderBy: { sourceRef: "asc" },
    });

    expect(depois).toEqual(antes);
  });

  it("a escala Elo do motor cabe na coluna", async () => {
    const { acervo } = await carregarAcervo();
    await importar({ acervo });

    const dificuldades = await db.activity.findMany({ select: { difficulty: true } });

    expect(dificuldades.length).toBeGreaterThan(0);
    for (const { difficulty } of dificuldades) {
      // 800 / 1000 / 1200 — não caberia em Decimal(6,3).
      expect(Number(difficulty)).toBeGreaterThanOrEqual(500);
      expect(Number(difficulty)).toBeLessThanOrEqual(2000);
    }
  });

  it("recusa o acervo inteiro quando uma referência não fecha", async () => {
    const { acervo } = await carregarAcervo();

    const primeiraMissao = acervo.missoes[0];
    expect(primeiraMissao).toBeDefined();

    const quebrado = {
      ...acervo,
      missoes: [
        {
          ...primeiraMissao!,
          missao: {
            ...primeiraMissao!.missao,
            fases: primeiraMissao!.missao.fases.map((fase, i) =>
              i === 0
                ? {
                    ...fase,
                    atividades: fase.atividades.map((a, j) =>
                      j === 0 ? { ...a, objetivo: "objetivo-inexistente" } : a,
                    ),
                  }
                : fase,
            ),
          },
        },
      ],
    };

    const resultado = await importar({ acervo: quebrado });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.code).toBe("content.plano_incompleto");
    }

    // Nada gravado: um acervo meio importado trava a criança numa tela sem saída.
    expect(await db.activity.count()).toBe(0);
    expect(await db.academy.count()).toBe(0);
  });
});
