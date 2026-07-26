-- Create FollowUpType enum
CREATE TYPE "FollowUpType" AS ENUM ('FOLLOW_UP', 'INTERVIEW', 'REPLY_EXPECTED', 'CUSTOM');

-- Add type to FollowUp (null = manually scheduled, pre-dates the automatic scheduler)
ALTER TABLE "FollowUp" ADD COLUMN "type" "FollowUpType";

-- Create index on FollowUp.applicationId for lookups and duplicate-prevention checks
CREATE INDEX "FollowUp_applicationId_idx" ON "FollowUp"("applicationId");
