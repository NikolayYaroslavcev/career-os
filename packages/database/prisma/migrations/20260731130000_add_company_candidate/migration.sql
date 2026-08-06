-- AlterEnum
-- ADR-035 Phase 2: AtsType was missing WORKABLE even though the TS union
-- (packages/company-watch/src/domain/value-objects/ats-type.ts) and
-- AtsAdapterRegistry both already support it (free-provider-expansion Phase 1)
-- — persisting a Workable-fingerprinted CompanyCandidate/CompanyWatch would
-- otherwise fail at the DB layer.
ALTER TYPE "AtsType" ADD VALUE 'WORKABLE';

-- CreateEnum
CREATE TYPE "CompanyCandidateStatus" AS ENUM ('DISCOVERED', 'AUTO_APPROVED', 'REVIEW_REQUIRED', 'REJECTED', 'CONVERTED');

-- CreateTable
CREATE TABLE "CompanyCandidate" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "careerUrl" TEXT NOT NULL,
    "atsType" "AtsType",
    "atsEndpoint" TEXT,
    "discoverySource" TEXT NOT NULL DEFAULT 'manual',
    "confidenceScore" INTEGER,
    "status" "CompanyCandidateStatus" NOT NULL DEFAULT 'DISCOVERED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyCandidate_status_idx" ON "CompanyCandidate"("status");

-- CreateIndex
CREATE INDEX "CompanyCandidate_discoverySource_idx" ON "CompanyCandidate"("discoverySource");

-- CreateIndex
CREATE INDEX "CompanyCandidate_companyName_idx" ON "CompanyCandidate"("companyName");
