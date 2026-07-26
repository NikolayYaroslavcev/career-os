-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[];
