-- AlterTable
ALTER TABLE "StructuredResume" ADD COLUMN     "certifications" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "languages" JSONB NOT NULL DEFAULT '[]';
