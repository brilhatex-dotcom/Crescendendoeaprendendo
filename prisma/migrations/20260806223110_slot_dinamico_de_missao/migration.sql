-- CreateTable
CREATE TABLE "QuestRunSlot" (
    "questRunId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "activityId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestRunSlot_pkey" PRIMARY KEY ("questRunId","stageId","order")
);

-- CreateIndex
CREATE INDEX "QuestRunSlot_activityId_idx" ON "QuestRunSlot"("activityId");

-- AddForeignKey
ALTER TABLE "QuestRunSlot" ADD CONSTRAINT "QuestRunSlot_questRunId_fkey" FOREIGN KEY ("questRunId") REFERENCES "QuestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestRunSlot" ADD CONSTRAINT "QuestRunSlot_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
