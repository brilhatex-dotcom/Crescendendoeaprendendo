-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "sourceRef" TEXT;

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "sourceRef" TEXT;

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "sourceRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Activity_sourceRef_key" ON "Activity"("sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_sourceRef_key" ON "Chapter"("sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "Objective_skillId_name_key" ON "Objective"("skillId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_sourceRef_key" ON "Quest"("sourceRef");

