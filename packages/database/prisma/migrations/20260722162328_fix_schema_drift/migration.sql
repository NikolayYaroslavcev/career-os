-- CreateEnum
CREATE TYPE "AtsType" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'WORKDAY', 'TEAMTAILOR', 'SMARTRECRUITERS', 'RECRUITEE', 'PERSONIO', 'BAMBOOHR', 'CUSTOM_HTML', 'JSON_LD');

-- CreateEnum
CREATE TYPE "CompanyWatchEventType" AS ENUM ('NEW_JOB', 'REMOVED_JOB', 'CHANGED_JOB');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AIJobStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIBudgetPeriod" AS ENUM ('DAILY', 'MONTHLY');

-- AlterTable
ALTER TABLE "MatchResult" ADD COLUMN     "actionableItems" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "categoryScores" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "explanation" JSONB;

-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "experienceLevel" TEXT;

-- CreateTable
CREATE TABLE "CompanyWatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "country" TEXT,
    "languages" TEXT[],
    "tags" TEXT[],
    "atsType" "AtsType" NOT NULL,
    "careerUrl" TEXT NOT NULL,
    "atsEndpoint" TEXT,
    "pollingInterval" INTEGER NOT NULL DEFAULT 3600,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CompanyWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyWatchEvent" (
    "id" TEXT NOT NULL,
    "type" "CompanyWatchEventType" NOT NULL,
    "externalId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "url" TEXT,
    "location" TEXT,
    "salary" JSONB,
    "technologies" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "companyWatchId" TEXT NOT NULL,

    CONSTRAINT "CompanyWatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyWatchSyncLog" (
    "id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "jobsFound" INTEGER NOT NULL DEFAULT 0,
    "newJobs" INTEGER NOT NULL DEFAULT 0,
    "removedJobs" INTEGER NOT NULL DEFAULT 0,
    "changedJobs" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "companyWatchId" TEXT NOT NULL,

    CONSTRAINT "CompanyWatchSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "status" "AIJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "inputHash" TEXT NOT NULL,
    "cacheKey" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "input" JSONB,
    "result" JSONB,
    "error" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AICache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "cacheMiss" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProviderConfiguration" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "model" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProviderConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "period" "AIBudgetPeriod" NOT NULL,
    "maxTokens" INTEGER,
    "maxCost" DOUBLE PRECISION,
    "maxRequestsPerFeature" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyWatch_workspaceId_idx" ON "CompanyWatch"("workspaceId");

-- CreateIndex
CREATE INDEX "CompanyWatch_atsType_idx" ON "CompanyWatch"("atsType");

-- CreateIndex
CREATE INDEX "CompanyWatch_active_idx" ON "CompanyWatch"("active");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyWatch_workspaceId_name_key" ON "CompanyWatch"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "CompanyWatchEvent_companyWatchId_idx" ON "CompanyWatchEvent"("companyWatchId");

-- CreateIndex
CREATE INDEX "CompanyWatchEvent_detectedAt_idx" ON "CompanyWatchEvent"("detectedAt");

-- CreateIndex
CREATE INDEX "CompanyWatchEvent_processed_idx" ON "CompanyWatchEvent"("processed");

-- CreateIndex
CREATE INDEX "CompanyWatchSyncLog_companyWatchId_idx" ON "CompanyWatchSyncLog"("companyWatchId");

-- CreateIndex
CREATE INDEX "CompanyWatchSyncLog_startedAt_idx" ON "CompanyWatchSyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "AIJob_userId_idx" ON "AIJob"("userId");

-- CreateIndex
CREATE INDEX "AIJob_feature_idx" ON "AIJob"("feature");

-- CreateIndex
CREATE INDEX "AIJob_status_idx" ON "AIJob"("status");

-- CreateIndex
CREATE INDEX "AIJob_inputHash_idx" ON "AIJob"("inputHash");

-- CreateIndex
CREATE INDEX "AIJob_createdAt_idx" ON "AIJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AICache_cacheKey_key" ON "AICache"("cacheKey");

-- CreateIndex
CREATE INDEX "AICache_cacheKey_idx" ON "AICache"("cacheKey");

-- CreateIndex
CREATE INDEX "AICache_feature_idx" ON "AICache"("feature");

-- CreateIndex
CREATE INDEX "AICache_expiresAt_idx" ON "AICache"("expiresAt");

-- CreateIndex
CREATE INDEX "AIUsage_userId_idx" ON "AIUsage"("userId");

-- CreateIndex
CREATE INDEX "AIUsage_feature_idx" ON "AIUsage"("feature");

-- CreateIndex
CREATE INDEX "AIUsage_provider_idx" ON "AIUsage"("provider");

-- CreateIndex
CREATE INDEX "AIUsage_createdAt_idx" ON "AIUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AIProviderConfiguration_userId_idx" ON "AIProviderConfiguration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AIProviderConfiguration_userId_provider_key" ON "AIProviderConfiguration"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "AIBudget_userId_period_key" ON "AIBudget"("userId", "period");

-- CreateIndex
CREATE INDEX "Vacancy_workspaceId_idx" ON "Vacancy"("workspaceId");

-- CreateIndex
CREATE INDEX "Vacancy_providerId_idx" ON "Vacancy"("providerId");

-- CreateIndex
CREATE INDEX "Vacancy_companyId_idx" ON "Vacancy"("companyId");

-- CreateIndex
CREATE INDEX "Vacancy_publishedAt_idx" ON "Vacancy"("publishedAt");

-- CreateIndex
CREATE INDEX "Vacancy_remote_idx" ON "Vacancy"("remote");

-- CreateIndex
CREATE INDEX "Vacancy_salaryMin_idx" ON "Vacancy"("salaryMin");

-- CreateIndex
CREATE INDEX "Vacancy_salaryMax_idx" ON "Vacancy"("salaryMax");

-- CreateIndex
CREATE INDEX "Vacancy_title_idx" ON "Vacancy"("title");

-- CreateIndex
CREATE INDEX "Vacancy_experienceLevel_idx" ON "Vacancy"("experienceLevel");

-- CreateIndex
CREATE INDEX "Vacancy_employmentType_idx" ON "Vacancy"("employmentType");

-- CreateIndex
CREATE UNIQUE INDEX "Vacancy_providerId_externalId_key" ON "Vacancy"("providerId", "externalId");

-- AddForeignKey
ALTER TABLE "CompanyWatch" ADD CONSTRAINT "CompanyWatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyWatchEvent" ADD CONSTRAINT "CompanyWatchEvent_companyWatchId_fkey" FOREIGN KEY ("companyWatchId") REFERENCES "CompanyWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyWatchSyncLog" ADD CONSTRAINT "CompanyWatchSyncLog_companyWatchId_fkey" FOREIGN KEY ("companyWatchId") REFERENCES "CompanyWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsage" ADD CONSTRAINT "AIUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

