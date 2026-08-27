-- AlterEnum
-- LinkedIn Feed push ingestion: additive only, does not touch existing
-- TELEGRAM SocialMessage rows or the HTML_PREVIEW/BOT_API/MTPROTO/EXPORT
-- transport values already in use.
ALTER TYPE "SocialPlatform" ADD VALUE 'LINKEDIN';

-- AlterEnum
ALTER TYPE "TransportType" ADD VALUE 'BROWSER_EXTENSION';
