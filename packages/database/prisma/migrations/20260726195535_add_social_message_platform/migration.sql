-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('HTML_PREVIEW', 'BOT_API', 'MTPROTO', 'EXPORT');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "MessageProcessingStatus" AS ENUM ('PENDING', 'SKIPPED_PRECHECK', 'EXTRACTING', 'EXTRACTED', 'LOW_CONFIDENCE', 'SPAM', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('SUCCESS', 'PARSE_ERROR', 'PROVIDER_ERROR', 'LOW_CONFIDENCE', 'SPAM');

-- AlterTable
ALTER TABLE "TelegramChannel" ADD COLUMN     "chatId" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "defaultAiExtractionOn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultMinConfidence" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "defaultPriority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultSyncIntervalMs" INTEGER NOT NULL DEFAULT 900000,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "ownerWorkspaceId" TEXT,
ADD COLUMN     "transport" "TransportType" NOT NULL DEFAULT 'HTML_PREVIEW';

-- CreateTable
CREATE TABLE "SocialMessage" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL DEFAULT 'TELEGRAM',
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT,
    "externalMessageId" TEXT NOT NULL,
    "authorUsername" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "rawText" TEXT NOT NULL,
    "rawHtml" TEXT,
    "media" JSONB,
    "links" JSONB NOT NULL DEFAULT '[]',
    "language" TEXT,
    "contentHash" TEXT NOT NULL,
    "processingStatus" "MessageProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "transport" "TransportType" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageExtraction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "promptChecksum" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "extractedFields" JSONB NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "currency" TEXT,
    "country" TEXT,
    "city" TEXT,
    "language" TEXT,
    "category" TEXT,
    "seniority" TEXT,
    "remoteType" TEXT,
    "deterministicConfidence" INTEGER NOT NULL,
    "aiSelfReportedConfidence" DOUBLE PRECISION,
    "missingFields" JSONB NOT NULL DEFAULT '[]',
    "status" "ExtractionStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramChannelSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "syncIntervalMs" INTEGER NOT NULL DEFAULT 900000,
    "aiExtractionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minConfidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramChannelSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramChannelStats" (
    "channelId" TEXT NOT NULL,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "vacanciesExtracted" INTEGER NOT NULL DEFAULT 0,
    "extractionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spamRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duplicateRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgSalaryMin" DOUBLE PRECISION,
    "avgSalaryMax" DOUBLE PRECISION,
    "avgSeniorityRank" DOUBLE PRECISION,
    "avgTechnologiesCount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "brokenMessages" INTEGER NOT NULL DEFAULT 0,
    "processingErrors" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topTechnologies" JSONB NOT NULL DEFAULT '[]',
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramChannelStats_pkey" PRIMARY KEY ("channelId")
);

-- CreateIndex
CREATE INDEX "SocialMessage_platform_idx" ON "SocialMessage"("platform");

-- CreateIndex
CREATE INDEX "SocialMessage_sourceId_idx" ON "SocialMessage"("sourceId");

-- CreateIndex
CREATE INDEX "SocialMessage_processingStatus_idx" ON "SocialMessage"("processingStatus");

-- CreateIndex
CREATE INDEX "SocialMessage_publishedAt_idx" ON "SocialMessage"("publishedAt");

-- CreateIndex
CREATE INDEX "SocialMessage_contentHash_idx" ON "SocialMessage"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMessage_platform_sourceId_externalMessageId_key" ON "SocialMessage"("platform", "sourceId", "externalMessageId");

-- CreateIndex
CREATE INDEX "MessageExtraction_messageId_idx" ON "MessageExtraction"("messageId");

-- CreateIndex
CREATE INDEX "MessageExtraction_contentHash_idx" ON "MessageExtraction"("contentHash");

-- CreateIndex
CREATE INDEX "MessageExtraction_deterministicConfidence_idx" ON "MessageExtraction"("deterministicConfidence");

-- CreateIndex
CREATE INDEX "MessageExtraction_category_idx" ON "MessageExtraction"("category");

-- CreateIndex
CREATE INDEX "MessageExtraction_company_idx" ON "MessageExtraction"("company");

-- CreateIndex
CREATE INDEX "MessageExtraction_country_idx" ON "MessageExtraction"("country");

-- CreateIndex
CREATE INDEX "MessageExtraction_city_idx" ON "MessageExtraction"("city");

-- CreateIndex
CREATE INDEX "MessageExtraction_seniority_idx" ON "MessageExtraction"("seniority");

-- CreateIndex
CREATE INDEX "MessageExtraction_remoteType_idx" ON "MessageExtraction"("remoteType");

-- CreateIndex
CREATE INDEX "MessageExtraction_salaryMin_idx" ON "MessageExtraction"("salaryMin");

-- CreateIndex
CREATE INDEX "MessageExtraction_salaryMax_idx" ON "MessageExtraction"("salaryMax");

-- CreateIndex
CREATE INDEX "TelegramChannelSubscription_workspaceId_idx" ON "TelegramChannelSubscription"("workspaceId");

-- CreateIndex
CREATE INDEX "TelegramChannelSubscription_channelId_idx" ON "TelegramChannelSubscription"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramChannelSubscription_workspaceId_channelId_key" ON "TelegramChannelSubscription"("workspaceId", "channelId");

-- CreateIndex
CREATE INDEX "TelegramChannel_ownerWorkspaceId_idx" ON "TelegramChannel"("ownerWorkspaceId");

-- AddForeignKey
ALTER TABLE "MessageExtraction" ADD CONSTRAINT "MessageExtraction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SocialMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramChannelSubscription" ADD CONSTRAINT "TelegramChannelSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramChannelSubscription" ADD CONSTRAINT "TelegramChannelSubscription_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TelegramChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramChannelStats" ADD CONSTRAINT "TelegramChannelStats_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "TelegramChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
