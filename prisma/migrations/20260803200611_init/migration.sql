-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('GUARDIAN', 'TEACHER', 'SCHOOL_ADMIN', 'CONTENT_AUTHOR', 'MODERATOR', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PARENTAL_DATA', 'AI_TUTOR', 'ANALYTICS', 'MEDIA_UPLOAD', 'CLASSROOM_ENROLL');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('SPROUT', 'EXPLORER', 'PIONEER', 'VANGUARD');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('MULTIPLE_CHOICE', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'WORD_BUILD', 'DRAG_MATCH', 'ORDER_SEQUENCE', 'NUMBER_LINE', 'GRID_PUZZLE', 'MEMORY_PAIRS', 'SPEED_TAP', 'STORY_BRANCH', 'CHESS_PUZZLE', 'CODE_BLOCKS', 'DRAWING_CANVAS', 'AUDIO_RECORD', 'FREE_TEXT', 'PHOTO_PROOF', 'SIMULATION', 'BUILD_3D');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentOrigin" AS ENUM ('CURATED', 'AI_GENERATED', 'AI_ASSISTED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "QuestKind" AS ENUM ('STORY', 'PRACTICE', 'CHALLENGE', 'BOSS', 'REVIEW', 'PROJECT', 'FAMILY', 'DAILY');

-- CreateEnum
CREATE TYPE "AttemptOutcome" AS ENUM ('CORRECT', 'PARTIAL', 'INCORRECT', 'SKIPPED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "QuestRunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "LevelTier" AS ENUM ('APRENDIZ', 'EXPLORADOR', 'INVENTOR', 'GUARDIAO', 'MESTRE', 'GENIO', 'SABIO', 'LENDA');

-- CreateEnum
CREATE TYPE "CurrencyKind" AS ENUM ('COIN', 'CRYSTAL', 'DIAMOND');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "parentPinHash" TEXT,
    "mfaSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountRoleAssignment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "organizationId" TEXT,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'school_basic',
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "activeLearnerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "learnerId" TEXT,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","tokenHash")
);

-- CreateTable
CREATE TABLE "Learner" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "ageBand" "AgeBand" NOT NULL,
    "avatarConfig" JSONB NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "organizationId" TEXT,
    "pseudonymId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Learner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerSettings" (
    "learnerId" TEXT NOT NULL,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "musicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "dyslexiaFont" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "textToSpeech" BOOLEAN NOT NULL DEFAULT true,
    "aiTutorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "captionsEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LearnerSettings_pkey" PRIMARY KEY ("learnerId")
);

-- CreateTable
CREATE TABLE "GuardianLink" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Academy" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "islandName" TEXT NOT NULL,
    "guardian" TEXT NOT NULL,
    "theme" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Academy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strand" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Strand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "strandId" TEXT NOT NULL,
    "bnccCode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minAgeBand" "AgeBand" NOT NULL,
    "maxAgeBand" "AgeBand" NOT NULL,
    "difficultyRef" DECIMAL(6,3) NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPrerequisite" (
    "skillId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,
    "strength" DECIMAL(3,2) NOT NULL DEFAULT 1.0,

    CONSTRAINT "SkillPrerequisite_pkey" PRIMARY KEY ("skillId","prerequisiteId")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "packId" TEXT,
    "objectiveId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "config" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "difficulty" DECIMAL(6,3) NOT NULL,
    "estimatedSec" INTEGER NOT NULL,
    "minAgeBand" "AgeBand" NOT NULL,
    "maxAgeBand" "AgeBand" NOT NULL,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'CURATED',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mapLayout" JSONB NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "story" JSONB NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "kind" "QuestKind" NOT NULL,
    "name" TEXT NOT NULL,
    "narrative" JSONB NOT NULL,
    "rewardXp" INTEGER NOT NULL,
    "rewardCoins" INTEGER NOT NULL,
    "rewardCrystals" INTEGER NOT NULL DEFAULT 0,
    "requiredSkills" TEXT[],
    "unlockRule" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "rule" JSONB NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageActivity" (
    "stageId" TEXT NOT NULL,
    "activityId" TEXT,
    "slotRule" JSONB,
    "order" INTEGER NOT NULL,

    CONSTRAINT "StageActivity_pkey" PRIMARY KEY ("stageId","order")
);

-- CreateTable
CREATE TABLE "QuestRun" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "status" "QuestRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "stageIndex" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rewardsGrantedAt" TIMESTAMP(3),

    CONSTRAINT "QuestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" BIGSERIAL NOT NULL,
    "learnerId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "questRunId" TEXT,
    "answer" JSONB NOT NULL,
    "outcome" "AttemptOutcome" NOT NULL,
    "scoreRatio" DECIMAL(4,3) NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "misconception" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "clientEvaluated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillMastery" (
    "learnerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "ability" DECIMAL(6,3) NOT NULL,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "masteredAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillMastery_pkey" PRIMARY KEY ("learnerId","skillId")
);

-- CreateTable
CREATE TABLE "ReviewCard" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lapses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerProgress" (
    "learnerId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "tier" "LevelTier" NOT NULL DEFAULT 'APRENDIZ',
    "energy" INTEGER NOT NULL DEFAULT 100,
    "energyUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "streakRecord" INTEGER NOT NULL DEFAULT 0,
    "streakShields" INTEGER NOT NULL DEFAULT 1,
    "lastActiveDate" DATE,
    "minutesToday" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LearnerProgress_pkey" PRIMARY KEY ("learnerId")
);

-- CreateTable
CREATE TABLE "Unlock" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "learnerId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "crystals" INTEGER NOT NULL DEFAULT 0,
    "diamonds" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("learnerId")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" BIGSERIAL NOT NULL,
    "learnerId" TEXT NOT NULL,
    "currency" "CurrencyKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopOffer" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "CurrencyKind" NOT NULL,
    "price" INTEGER NOT NULL,
    "itemKind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "activeFrom" TIMESTAMP(3),
    "activeTo" TIMESTAMP(3),

    CONSTRAINT "ShopOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Companion" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "affinityXp" INTEGER NOT NULL DEFAULT 0,
    "cosmetics" JSONB NOT NULL,

    CONSTRAINT "Companion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerAchievement" (
    "learnerId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),

    CONSTRAINT "LearnerAchievement_pkey" PRIMARY KEY ("learnerId","achievementId")
);

-- CreateTable
CREATE TABLE "TutorSession" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TutorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorTurn" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "modelId" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentProfile" (
    "learnerId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "dominant" TEXT,
    "confidence" DECIMAL(4,3) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentProfile_pkey" PRIMARY KEY ("learnerId")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "reason" TEXT NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomEnrollment" (
    "classroomId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomEnrollment_pkey" PRIMARY KEY ("classroomId","learnerId")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "questId" TEXT,
    "skillIds" TEXT[],
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "assignmentId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" DECIMAL(5,2),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("assignmentId","learnerId")
);

-- CreateTable
CREATE TABLE "ScreenTimeRule" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "dailyMinutes" INTEGER,
    "allowedWindows" JSONB NOT NULL,
    "freeDays" INTEGER[],
    "blockedAcademies" TEXT[],
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenTimeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" BIGSERIAL NOT NULL,
    "accountId" TEXT,
    "learnerId" TEXT,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerWeeklySnapshot" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "minutesTotal" INTEGER NOT NULL DEFAULT 0,
    "attemptsTotal" INTEGER NOT NULL DEFAULT 0,
    "correctRatio" DECIMAL(4,3) NOT NULL,
    "skillsMastered" INTEGER NOT NULL DEFAULT 0,
    "highlights" JSONB NOT NULL,
    "struggles" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnerWeeklySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "diff" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" BIGSERIAL NOT NULL,
    "pseudonymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" BIGSERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE INDEX "Account_status_createdAt_idx" ON "Account"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Account_deletedAt_idx" ON "Account"("deletedAt");

-- CreateIndex
CREATE INDEX "AccountRoleAssignment_organizationId_role_idx" ON "AccountRoleAssignment"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "AccountRoleAssignment_accountId_role_organizationId_key" ON "AccountRoleAssignment"("accountId", "role", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_deletedAt_idx" ON "Organization"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_accountId_expiresAt_idx" ON "Session"("accountId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Consent_learnerId_type_createdAt_idx" ON "Consent"("learnerId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Consent_accountId_type_createdAt_idx" ON "Consent"("accountId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "OAuthAccount_accountId_idx" ON "OAuthAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Learner_pseudonymId_key" ON "Learner"("pseudonymId");

-- CreateIndex
CREATE INDEX "Learner_organizationId_idx" ON "Learner"("organizationId");

-- CreateIndex
CREATE INDEX "Learner_ageBand_idx" ON "Learner"("ageBand");

-- CreateIndex
CREATE INDEX "Learner_deletedAt_idx" ON "Learner"("deletedAt");

-- CreateIndex
CREATE INDEX "GuardianLink_learnerId_idx" ON "GuardianLink"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianLink_accountId_learnerId_key" ON "GuardianLink"("accountId", "learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Academy_slug_key" ON "Academy"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE INDEX "Subject_academyId_order_idx" ON "Subject"("academyId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Strand_subjectId_code_key" ON "Strand"("subjectId", "code");

-- CreateIndex
CREATE INDEX "Skill_bnccCode_idx" ON "Skill"("bnccCode");

-- CreateIndex
CREATE INDEX "Skill_minAgeBand_maxAgeBand_idx" ON "Skill"("minAgeBand", "maxAgeBand");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_strandId_name_key" ON "Skill"("strandId", "name");

-- CreateIndex
CREATE INDEX "SkillPrerequisite_prerequisiteId_idx" ON "SkillPrerequisite"("prerequisiteId");

-- CreateIndex
CREATE INDEX "Objective_skillId_order_idx" ON "Objective"("skillId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPack_slug_key" ON "ContentPack"("slug");

-- CreateIndex
CREATE INDEX "ContentPack_status_publishedAt_idx" ON "ContentPack"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Activity_objectiveId_status_difficulty_idx" ON "Activity"("objectiveId", "status", "difficulty");

-- CreateIndex
CREATE INDEX "Activity_type_status_idx" ON "Activity"("type", "status");

-- CreateIndex
CREATE INDEX "Activity_minAgeBand_maxAgeBand_status_idx" ON "Activity"("minAgeBand", "maxAgeBand", "status");

-- CreateIndex
CREATE INDEX "Activity_origin_status_idx" ON "Activity"("origin", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_checksum_key" ON "Asset"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "World_academyId_slug_key" ON "World"("academyId", "slug");

-- CreateIndex
CREATE INDEX "Chapter_worldId_order_idx" ON "Chapter"("worldId", "order");

-- CreateIndex
CREATE INDEX "Quest_chapterId_order_idx" ON "Quest"("chapterId", "order");

-- CreateIndex
CREATE INDEX "Quest_kind_idx" ON "Quest"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_questId_order_key" ON "Stage"("questId", "order");

-- CreateIndex
CREATE INDEX "StageActivity_activityId_idx" ON "StageActivity"("activityId");

-- CreateIndex
CREATE INDEX "QuestRun_learnerId_status_startedAt_idx" ON "QuestRun"("learnerId", "status", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "QuestRun_learnerId_questId_startedAt_key" ON "QuestRun"("learnerId", "questId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_idempotencyKey_key" ON "Attempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Attempt_learnerId_createdAt_idx" ON "Attempt"("learnerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Attempt_activityId_outcome_idx" ON "Attempt"("activityId", "outcome");

-- CreateIndex
CREATE INDEX "Attempt_learnerId_activityId_idx" ON "Attempt"("learnerId", "activityId");

-- CreateIndex
CREATE INDEX "Attempt_questRunId_idx" ON "Attempt"("questRunId");

-- CreateIndex
CREATE INDEX "SkillMastery_learnerId_masteredAt_idx" ON "SkillMastery"("learnerId", "masteredAt");

-- CreateIndex
CREATE INDEX "SkillMastery_skillId_probability_idx" ON "SkillMastery"("skillId", "probability");

-- CreateIndex
CREATE INDEX "ReviewCard_learnerId_dueAt_idx" ON "ReviewCard"("learnerId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCard_learnerId_skillId_key" ON "ReviewCard"("learnerId", "skillId");

-- CreateIndex
CREATE INDEX "LearnerProgress_level_idx" ON "LearnerProgress"("level");

-- CreateIndex
CREATE INDEX "Unlock_learnerId_kind_idx" ON "Unlock"("learnerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Unlock_learnerId_kind_refId_key" ON "Unlock"("learnerId", "kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_learnerId_currency_createdAt_idx" ON "LedgerEntry"("learnerId", "currency", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ShopOffer_sku_key" ON "ShopOffer"("sku");

-- CreateIndex
CREATE INDEX "ShopOffer_activeFrom_activeTo_idx" ON "ShopOffer"("activeFrom", "activeTo");

-- CreateIndex
CREATE INDEX "InventoryItem_learnerId_equipped_idx" ON "InventoryItem"("learnerId", "equipped");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_learnerId_sku_key" ON "InventoryItem"("learnerId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Companion_learnerId_key" ON "Companion"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "LearnerAchievement_learnerId_unlockedAt_idx" ON "LearnerAchievement"("learnerId", "unlockedAt");

-- CreateIndex
CREATE INDEX "TutorSession_learnerId_startedAt_idx" ON "TutorSession"("learnerId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "TutorTurn_sessionId_createdAt_idx" ON "TutorTurn"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "TutorTurn_flagged_createdAt_idx" ON "TutorTurn"("flagged", "createdAt");

-- CreateIndex
CREATE INDEX "Recommendation_learnerId_consumedAt_score_idx" ON "Recommendation"("learnerId", "consumedAt", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");

-- CreateIndex
CREATE INDEX "Classroom_organizationId_archivedAt_idx" ON "Classroom"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");

-- CreateIndex
CREATE INDEX "ClassroomEnrollment_learnerId_idx" ON "ClassroomEnrollment"("learnerId");

-- CreateIndex
CREATE INDEX "Assignment_classroomId_dueAt_idx" ON "Assignment"("classroomId", "dueAt");

-- CreateIndex
CREATE INDEX "Submission_learnerId_status_idx" ON "Submission"("learnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenTimeRule_learnerId_key" ON "ScreenTimeRule"("learnerId");

-- CreateIndex
CREATE INDEX "Notification_accountId_readAt_createdAt_idx" ON "Notification"("accountId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_learnerId_createdAt_idx" ON "Notification"("learnerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LearnerWeeklySnapshot_weekStart_idx" ON "LearnerWeeklySnapshot"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerWeeklySnapshot_learnerId_weekStart_key" ON "LearnerWeeklySnapshot"("learnerId", "weekStart");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LearningEvent_name_occurredAt_idx" ON "LearningEvent"("name", "occurredAt");

-- CreateIndex
CREATE INDEX "LearningEvent_pseudonymId_occurredAt_idx" ON "LearningEvent"("pseudonymId", "occurredAt");

-- CreateIndex
CREATE INDEX "OutboxMessage_processedAt_availableAt_idx" ON "OutboxMessage"("processedAt", "availableAt");

-- AddForeignKey
ALTER TABLE "AccountRoleAssignment" ADD CONSTRAINT "AccountRoleAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRoleAssignment" ADD CONSTRAINT "AccountRoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learner" ADD CONSTRAINT "Learner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerSettings" ADD CONSTRAINT "LearnerSettings_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strand" ADD CONSTRAINT "Strand_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_strandId_fkey" FOREIGN KEY ("strandId") REFERENCES "Strand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPrerequisite" ADD CONSTRAINT "SkillPrerequisite_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPrerequisite" ADD CONSTRAINT "SkillPrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ContentPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "World" ADD CONSTRAINT "World_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageActivity" ADD CONSTRAINT "StageActivity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageActivity" ADD CONSTRAINT "StageActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestRun" ADD CONSTRAINT "QuestRun_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestRun" ADD CONSTRAINT "QuestRun_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_questRunId_fkey" FOREIGN KEY ("questRunId") REFERENCES "QuestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMastery" ADD CONSTRAINT "SkillMastery_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMastery" ADD CONSTRAINT "SkillMastery_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCard" ADD CONSTRAINT "ReviewCard_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCard" ADD CONSTRAINT "ReviewCard_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerProgress" ADD CONSTRAINT "LearnerProgress_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unlock" ADD CONSTRAINT "Unlock_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Companion" ADD CONSTRAINT "Companion_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerAchievement" ADD CONSTRAINT "LearnerAchievement_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerAchievement" ADD CONSTRAINT "LearnerAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorSession" ADD CONSTRAINT "TutorSession_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorTurn" ADD CONSTRAINT "TutorTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TutorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProfile" ADD CONSTRAINT "TalentProfile_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomEnrollment" ADD CONSTRAINT "ClassroomEnrollment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomEnrollment" ADD CONSTRAINT "ClassroomEnrollment_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenTimeRule" ADD CONSTRAINT "ScreenTimeRule_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerWeeklySnapshot" ADD CONSTRAINT "LearnerWeeklySnapshot_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
