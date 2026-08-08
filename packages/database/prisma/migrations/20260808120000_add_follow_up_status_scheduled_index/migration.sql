-- Pre-beta stabilization audit: the reminder sweep (FollowUpRepository.findDue,
-- run by both apps/worker's scheduled BullMQ job and apps/backend's manual
-- trigger) queries `status IN ('PENDING','SNOOZED') AND scheduledAt <= before`
-- on every tick, across every user's follow-ups. The only existing index on
-- this table is on applicationId, so this query full-scans as the table
-- grows. Adds the composite index the query actually needs.
CREATE INDEX "FollowUp_status_scheduledAt_idx" ON "FollowUp"("status", "scheduledAt");
