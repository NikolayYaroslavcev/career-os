-- CreateProviderType enum
CREATE TYPE "ProviderType" AS ENUM ('ATS', 'JOB_BOARD', 'COMMUNITY', 'MANUAL');

-- Create VacancySource table
CREATE TABLE "VacancySource" (
    "id" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vacancyId" TEXT NOT NULL,

    CONSTRAINT "VacancySource_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX "VacancySource_vacancyId_providerId_externalId_key" ON "VacancySource"("vacancyId", "providerId", "externalId");

-- Create indexes
CREATE INDEX "VacancySource_vacancyId_idx" ON "VacancySource"("vacancyId");
CREATE INDEX "VacancySource_providerId_idx" ON "VacancySource"("providerId");
CREATE INDEX "VacancySource_externalId_idx" ON "VacancySource"("externalId");
CREATE INDEX "VacancySource_providerType_idx" ON "VacancySource"("providerType");

-- Add foreign key
ALTER TABLE "VacancySource" ADD CONSTRAINT "VacancySource_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: create VacancySource for each existing Vacancy
INSERT INTO "VacancySource" ("id", "providerType", "providerId", "externalId", "sourceUrl", "discoveredAt", "lastSeenAt", "isPrimary", "metadata", "createdAt", "updatedAt", "vacancyId")
SELECT
    gen_random_uuid()::text,
    CASE
        WHEN v."providerId" IN ('greenhouse', 'lever', 'ashby', 'workday', 'smartrecruiters', 'recruitee', 'comeet', 'teamtailor') THEN 'ATS'::"ProviderType"
        WHEN v."providerId" IN ('remote_ok', 'remotive', 'hh', 'habr_career', 'linkedin', 'wellfound', 'otta', 'himalayas', 'arbeitnow', 'jobicy', 'we_work_remotely', 'working_nomads', 'nodesk') THEN 'JOB_BOARD'::"ProviderType"
        WHEN v."providerId" IN ('hn_hiring', 'rss_feed', 'company_career_page', 'telegram') THEN 'COMMUNITY'::"ProviderType"
        ELSE 'MANUAL'::"ProviderType"
    END,
    v."providerId",
    v."externalId",
    v."url",
    v."createdAt",
    v."updatedAt",
    true,
    v."metadata",
    v."createdAt",
    v."updatedAt",
    v."id"
FROM "Vacancy" v
WHERE v."providerId" IS NOT NULL AND v."externalId" IS NOT NULL;

-- Remove legacy columns from Vacancy
ALTER TABLE "Vacancy" DROP COLUMN "externalId";
ALTER TABLE "Vacancy" DROP COLUMN "providerId";
ALTER TABLE "Vacancy" DROP COLUMN "hash";
ALTER TABLE "Vacancy" DROP COLUMN "url";

-- Remove legacy indexes
DROP INDEX IF EXISTS "Vacancy_providerId_idx";
DROP INDEX IF EXISTS "Vacancy_providerId_externalId_key";

-- Add application timestamp columns
ALTER TABLE "Application" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "submittedAt" TIMESTAMP(3);

-- Add unique constraint for Application
CREATE UNIQUE INDEX "Application_userId_vacancyId_key" ON "Application"("userId", "vacancyId");
