-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "interactionType" TEXT,
ADD COLUMN     "presentationVariants" JSONB,
ADD COLUMN     "requiresReading" BOOLEAN,
ADD COLUMN     "stepCount" INTEGER,
ADD COLUMN     "visualSupportLevel" TEXT;

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "presentationTag" TEXT;

-- AlterTable
ALTER TABLE "LearnerSettings" ADD COLUMN     "extraTimeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fontScale" DECIMAL(3,2),
ADD COLUMN     "oneTaskAtATime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pictogramsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "simplifiedInterface" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "soundVolume" INTEGER,
ADD COLUMN     "stepByStepInstructions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "payload" JSONB;

-- CreateTable
CREATE TABLE "LearningProfile" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "academyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningProfileDimension" (
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(4,3) NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "observationsCount" INTEGER NOT NULL DEFAULT 0,
    "lastObservedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProfileDimension_pkey" PRIMARY KEY ("profileId","key")
);

-- CreateTable
CREATE TABLE "LearningProfileEvent" (
    "id" BIGSERIAL NOT NULL,
    "profileId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "previousValue" DECIMAL(4,3),
    "newValue" DECIMAL(4,3) NOT NULL,
    "previousConfidence" DECIMAL(4,3),
    "newConfidence" DECIMAL(4,3) NOT NULL,
    "trigger" TEXT NOT NULL,
    "evidenceSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningProfileEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningProfile_academyId_idx" ON "LearningProfile"("academyId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProfile_learnerId_academyId_key" ON "LearningProfile"("learnerId", "academyId");

-- CreateIndex
CREATE INDEX "LearningProfileEvent_profileId_dimensionKey_createdAt_idx" ON "LearningProfileEvent"("profileId", "dimensionKey", "createdAt");

-- AddForeignKey
ALTER TABLE "LearningProfile" ADD CONSTRAINT "LearningProfile_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProfile" ADD CONSTRAINT "LearningProfile_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProfileDimension" ADD CONSTRAINT "LearningProfileDimension_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearningProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProfileEvent" ADD CONSTRAINT "LearningProfileEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearningProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
