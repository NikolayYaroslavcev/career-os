-- EPIC-21 Phase 3: backend RBAC for admin-only routes (provider settings,
-- Telegram channel management, diagnostics, global AI config).
--
-- The domain User entity (packages/career) has always modeled a `role`
-- (UserRole: JOB_SEEKER/RECRUITER/ADMIN), but it was never persisted --
-- UserMapper.toDomain hardcoded every user to JOB_SEEKER. This migration
-- adds the missing column so a real, server-verifiable role can be issued
-- into the JWT and checked by the new requireAdmin route guard, instead of
-- relying on the frontend's temporary email-allowlist stand-in
-- (apps/dashboard/src/lib/access/nav-visibility.ts).
CREATE TYPE "UserRole" AS ENUM ('JOB_SEEKER', 'RECRUITER', 'ADMIN');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'JOB_SEEKER';
