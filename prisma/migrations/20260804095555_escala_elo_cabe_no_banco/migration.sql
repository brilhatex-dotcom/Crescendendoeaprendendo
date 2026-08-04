-- A escala Elo do motor usa 800/1000/1200 (src/activities/difficulty.ts).
-- Decimal(6,3) guarda no maximo 999.999: a primeira importacao de conteudo
-- estourava com 'numeric field overflow'. Decimal(7,3) chega a 9999.999,
-- folga suficiente para Elo, que na pratica nao passa de ~3000.

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "difficulty" SET DATA TYPE DECIMAL(7,3);

-- AlterTable
ALTER TABLE "Skill" ALTER COLUMN "difficultyRef" SET DATA TYPE DECIMAL(7,3);

-- AlterTable
ALTER TABLE "SkillMastery" ALTER COLUMN "ability" SET DATA TYPE DECIMAL(7,3);

