-- CreateEnum
CREATE TYPE "TailoringStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TailoringStage" AS ENUM ('QUEUED', 'PARSING_RESUME', 'PARSING_VACANCY', 'BUILDING_EVIDENCE', 'TAILORING_RESUME', 'ATS_SCORING', 'REVIEWER_VALIDATION', 'SAVING_RESULTS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "TailoredResume" (
    "id" TEXT NOT NULL,
    "status" "TailoringStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStage" "TailoringStage" NOT NULL DEFAULT 'QUEUED',
    "stageExecutions" JSONB NOT NULL DEFAULT '[]',
    "inputHash" TEXT NOT NULL DEFAULT '',
    "vacancyRequirements" JSONB,
    "skillMatrix" JSONB,
    "tailoredContent" JSONB,
    "tailoredResumeText" TEXT,
    "atsScoreBefore" JSONB,
    "atsScoreAfter" JSONB,
    "changesApplied" JSONB NOT NULL DEFAULT '[]',
    "changesRejected" JSONB NOT NULL DEFAULT '[]',
    "hallucinationCheck" JSONB,
    "confidence" DOUBLE PRECISION,
    "recruiterNotes" TEXT,
    "tailoringAlgorithmVersion" TEXT,
    "atsWeightsVersion" TEXT,
    "promptVersions" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "applicationId" TEXT,

    CONSTRAINT "TailoredResume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TailoredResume_userId_idx" ON "TailoredResume"("userId");

-- CreateIndex
CREATE INDEX "TailoredResume_vacancyId_idx" ON "TailoredResume"("vacancyId");

-- CreateIndex
CREATE INDEX "TailoredResume_applicationId_idx" ON "TailoredResume"("applicationId");

-- CreateIndex
CREATE INDEX "TailoredResume_status_idx" ON "TailoredResume"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TailoredResume_resumeId_vacancyId_key" ON "TailoredResume"("resumeId", "vacancyId");

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredResume" ADD CONSTRAINT "TailoredResume_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
