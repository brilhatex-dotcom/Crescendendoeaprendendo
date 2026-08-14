-- DropIndex
DROP INDEX "LearningProfile_academyId_idx";

-- DropIndex
DROP INDEX "LearningProfile_learnerId_academyId_key";

-- CreateIndex
CREATE INDEX "LearningProfile_learnerId_academyId_idx" ON "LearningProfile"("learnerId", "academyId");
