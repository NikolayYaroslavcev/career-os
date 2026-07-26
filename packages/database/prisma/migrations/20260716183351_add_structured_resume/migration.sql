-- CreateTable
CREATE TABLE "StructuredResume" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "extractionVersion" TEXT NOT NULL,
    "extractionModel" TEXT,
    "extractionStatus" TEXT NOT NULL,
    "failureReason" TEXT,
    "extractedAt" TIMESTAMP(3),
    "summary" TEXT,
    "seniorityLevel" TEXT,
    "totalYearsOfExperience" INTEGER,
    "skills" JSONB NOT NULL,
    "technologies" JSONB NOT NULL,
    "experience" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructuredResume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StructuredResume_resumeId_key" ON "StructuredResume"("resumeId");

-- CreateIndex
CREATE INDEX "StructuredResume_extractionStatus_idx" ON "StructuredResume"("extractionStatus");

-- AddForeignKey
ALTER TABLE "StructuredResume" ADD CONSTRAINT "StructuredResume_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
