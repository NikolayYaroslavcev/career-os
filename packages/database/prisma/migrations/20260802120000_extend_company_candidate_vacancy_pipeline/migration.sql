-- ADR-035 Phase 3: Extend CompanyCandidate with vacancy pipeline fields
-- for automatic discovery from the vacancy sync pipeline.

ALTER TABLE "CompanyCandidate" ADD COLUMN "firstSeenAt" TIMESTAMP(3);
ALTER TABLE "CompanyCandidate" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "CompanyCandidate" ADD COLUMN "seenCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompanyCandidate" ADD COLUMN "vacancyCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompanyCandidate" ADD COLUMN "providerCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompanyCandidate" ADD COLUMN "providers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CompanyCandidate" ADD COLUMN "lastVacancyTitle" TEXT;

-- Backfill existing rows: firstSeenAt = createdAt, lastSeenAt = updatedAt
UPDATE "CompanyCandidate" SET "firstSeenAt" = "createdAt", "lastSeenAt" = "updatedAt" WHERE "firstSeenAt" IS NULL;

CREATE INDEX "CompanyCandidate_firstSeenAt_idx" ON "CompanyCandidate"("firstSeenAt");
CREATE INDEX "CompanyCandidate_lastSeenAt_idx" ON "CompanyCandidate"("lastSeenAt");
