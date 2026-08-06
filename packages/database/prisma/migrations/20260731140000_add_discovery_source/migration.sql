-- CreateTable
-- ADR-035 Phase 4: per-source config/enable/cursor row feeding the bulk
-- DiscoverySource -> CompanyCandidate pipeline (packages/discovery-sources).
-- sourceId is the DiscoverySourceId string constant, not a foreign key.
CREATE TABLE "DiscoverySource" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cursor" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunError" TEXT,
    "candidatesFound" INTEGER NOT NULL DEFAULT 0,
    "candidatesEnrolled" INTEGER NOT NULL DEFAULT 0,
    "candidatesRejected" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverySource_sourceId_key" ON "DiscoverySource"("sourceId");

-- CreateIndex
CREATE INDEX "DiscoverySource_enabled_idx" ON "DiscoverySource"("enabled");
