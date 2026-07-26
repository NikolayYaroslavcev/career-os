-- CreateEnum
CREATE TYPE "ResumeVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Untitled Resume';
ALTER TABLE "Resume" ADD COLUMN "description" TEXT;
ALTER TABLE "Resume" ADD COLUMN "language" TEXT;
ALTER TABLE "Resume" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Resume" ADD COLUMN "status" "ResumeVersionStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill title from the legacy parsedData JSON blob for existing rows
UPDATE "Resume" SET "title" = COALESCE("parsedData"->>'title', "fileName", 'Untitled Resume');

-- CreateIndex
CREATE INDEX "Resume_userId_status_idx" ON "Resume"("userId", "status");

-- CreateIndex
CREATE INDEX "Resume_userId_tags_idx" ON "Resume"("userId", "tags");
