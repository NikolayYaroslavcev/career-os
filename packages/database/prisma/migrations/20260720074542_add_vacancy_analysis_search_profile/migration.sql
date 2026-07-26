-- DropIndex
DROP INDEX "MatchResult_userId_vacancyId_resumeId_key";

-- AlterTable
ALTER TABLE "MatchResult" ADD COLUMN     "inputHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "remotePolicy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requiredSkills" TEXT[],
ADD COLUMN     "salaryObservations" TEXT,
ADD COLUMN     "searchProfileId" TEXT NOT NULL,
ADD COLUMN     "seniorityEstimation" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "summary" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "resumeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MatchResult_vacancyId_idx" ON "MatchResult"("vacancyId");

-- CreateIndex
CREATE INDEX "MatchResult_userId_idx" ON "MatchResult"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_searchProfileId_vacancyId_key" ON "MatchResult"("searchProfileId", "vacancyId");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "SearchProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

