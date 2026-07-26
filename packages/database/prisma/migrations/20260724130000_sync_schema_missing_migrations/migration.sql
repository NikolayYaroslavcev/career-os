-- Reconciles schema.prisma with the actual migration history. Drift audit
-- (2026-07-24) found:
--   1. `ApplicationStatus` was redesigned in code (SAVED/STARTED/SUBMITTED/...)
--      but the DB enum still had the original SAVED/APPLIED/... values from
--      the init migration — no migration ever applied the rename.
--   2. `VacancyRankingResult`, `UserVacancyInteraction`, and the
--      `InteractionAction` enum exist in schema.prisma but were never
--      migrated into the database.
--   3. `AIJob.vacancyId` / `AIJob.applicationId` exist in schema.prisma but
--      were never migrated into the database.
-- (`Application.appliedAt`, the fourth drift found, went the other way — the
-- DB already had it from the init migration but schema.prisma had dropped it;
-- that's fixed by editing schema.prisma directly, not by a migration.)
--
-- CAUTION: the ApplicationStatus enum swap below will fail on any database
-- that still has rows with status = 'APPLIED' (Postgres cannot cast a value
-- into an enum that no longer contains it). This migration is verified safe
-- against an empty database. Before deploying to any environment that may
-- have live 'APPLIED' rows, backfill them first, e.g.:
--   UPDATE "Application" SET status = 'STARTED' WHERE status = 'APPLIED';
-- (or 'SUBMITTED', depending on which the row's history actually reflects —
-- a product/data decision, not something to guess here).

-- CreateEnum
CREATE TYPE "InteractionAction" AS ENUM ('VIEW', 'SAVE', 'APPLY', 'HIDE', 'IGNORE');

-- AlterEnum
BEGIN;
CREATE TYPE "ApplicationStatus_new" AS ENUM ('SAVED', 'STARTED', 'SUBMITTED', 'WAITING', 'HR_INTERVIEW', 'TECHNICAL_INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'ARCHIVED');
ALTER TABLE "public"."Application" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Application" ALTER COLUMN "status" TYPE "ApplicationStatus_new" USING ("status"::text::"ApplicationStatus_new");
ALTER TYPE "ApplicationStatus" RENAME TO "ApplicationStatus_old";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
DROP TYPE "public"."ApplicationStatus_old";
ALTER TABLE "Application" ALTER COLUMN "status" SET DEFAULT 'SAVED';
COMMIT;

-- AlterTable
ALTER TABLE "AIJob" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "vacancyId" TEXT;

-- CreateTable
CREATE TABLE "VacancyRankingResult" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "matchedSkills" JSONB NOT NULL DEFAULT '[]',
    "missingSkills" JSONB NOT NULL DEFAULT '[]',
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,

    CONSTRAINT "VacancyRankingResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVacancyInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "action" "InteractionAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVacancyInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VacancyRankingResult_userId_idx" ON "VacancyRankingResult"("userId");

-- CreateIndex
CREATE INDEX "VacancyRankingResult_vacancyId_idx" ON "VacancyRankingResult"("vacancyId");

-- CreateIndex
CREATE INDEX "VacancyRankingResult_score_idx" ON "VacancyRankingResult"("score");

-- CreateIndex
CREATE UNIQUE INDEX "VacancyRankingResult_userId_vacancyId_key" ON "VacancyRankingResult"("userId", "vacancyId");

-- CreateIndex
CREATE INDEX "UserVacancyInteraction_userId_idx" ON "UserVacancyInteraction"("userId");

-- CreateIndex
CREATE INDEX "UserVacancyInteraction_vacancyId_idx" ON "UserVacancyInteraction"("vacancyId");

-- CreateIndex
CREATE INDEX "UserVacancyInteraction_userId_action_idx" ON "UserVacancyInteraction"("userId", "action");

-- CreateIndex
CREATE INDEX "UserVacancyInteraction_createdAt_idx" ON "UserVacancyInteraction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserVacancyInteraction_userId_vacancyId_action_key" ON "UserVacancyInteraction"("userId", "vacancyId", "action");

-- CreateIndex
CREATE INDEX "AIJob_vacancyId_idx" ON "AIJob"("vacancyId");

-- CreateIndex
CREATE INDEX "AIJob_applicationId_idx" ON "AIJob"("applicationId");

-- AddForeignKey
ALTER TABLE "VacancyRankingResult" ADD CONSTRAINT "VacancyRankingResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyRankingResult" ADD CONSTRAINT "VacancyRankingResult_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVacancyInteraction" ADD CONSTRAINT "UserVacancyInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVacancyInteraction" ADD CONSTRAINT "UserVacancyInteraction_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
