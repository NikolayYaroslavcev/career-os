-- CreateEnum
CREATE TYPE "CompanyWatchHealthStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'BROKEN', 'RETIRED');

-- AlterTable
ALTER TABLE "CompanyWatch" ADD COLUMN     "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "healthStatus" "CompanyWatchHealthStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "lastSuccessfulSyncAt" TIMESTAMP(3),
ADD COLUMN     "priorityScore" INTEGER NOT NULL DEFAULT 50;

-- CreateIndex
CREATE INDEX "CompanyWatch_healthStatus_idx" ON "CompanyWatch"("healthStatus");
