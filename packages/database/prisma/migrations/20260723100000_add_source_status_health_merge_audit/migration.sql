-- Create SourceStatus enum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REMOVED', 'BROKEN');

-- Create SourcePriority enum
CREATE TYPE "SourcePriority" AS ENUM ('ATS', 'JOB_BOARD', 'COMMUNITY', 'MANUAL');

-- Add status and health fields to VacancySource
ALTER TABLE "VacancySource" ADD COLUMN "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "VacancySource" ADD COLUMN "applyUrl" TEXT;
ALTER TABLE "VacancySource" ADD COLUMN "lastSuccessfulSync" TIMESTAMP(3);
ALTER TABLE "VacancySource" ADD COLUMN "lastFailedSync" TIMESTAMP(3);
ALTER TABLE "VacancySource" ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0;

-- Create VacancyMergeAudit table
CREATE TABLE "VacancyMergeAudit" (
    "id" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "reason" TEXT,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacancyMergeAudit_pkey" PRIMARY KEY ("id")
);

-- Create indexes for VacancyMergeAudit
CREATE INDEX "VacancyMergeAudit_vacancyId_idx" ON "VacancyMergeAudit"("vacancyId");
CREATE INDEX "VacancyMergeAudit_sourceId_idx" ON "VacancyMergeAudit"("sourceId");
CREATE INDEX "VacancyMergeAudit_mergedAt_idx" ON "VacancyMergeAudit"("mergedAt");

-- Add foreign key for VacancyMergeAudit
ALTER TABLE "VacancyMergeAudit" ADD CONSTRAINT "VacancyMergeAudit_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index on VacancySource.status for filtering
CREATE INDEX "VacancySource_status_idx" ON "VacancySource"("status");

-- Backfill: set lastSuccessfulSync for existing active sources
UPDATE "VacancySource" SET "lastSuccessfulSync" = "lastSeenAt" WHERE "status" = 'ACTIVE';
