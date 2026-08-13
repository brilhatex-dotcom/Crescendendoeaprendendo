-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "rewardCollectibles" TEXT[] DEFAULT ARRAY[]::TEXT[];
