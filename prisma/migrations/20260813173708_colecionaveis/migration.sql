-- CreateTable
CREATE TABLE "Collectible" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,

    CONSTRAINT "Collectible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerCollectible" (
    "learnerId" TEXT NOT NULL,
    "collectibleId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnerCollectible_pkey" PRIMARY KEY ("learnerId","collectibleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collectible_code_key" ON "Collectible"("code");

-- CreateIndex
CREATE INDEX "LearnerCollectible_learnerId_unlockedAt_idx" ON "LearnerCollectible"("learnerId", "unlockedAt");

-- AddForeignKey
ALTER TABLE "LearnerCollectible" ADD CONSTRAINT "LearnerCollectible_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerCollectible" ADD CONSTRAINT "LearnerCollectible_collectibleId_fkey" FOREIGN KEY ("collectibleId") REFERENCES "Collectible"("id") ON DELETE CASCADE ON UPDATE CASCADE;
