-- CreateProviderStatusEnum
CREATE TYPE "ProviderStatus" AS ENUM ('READY', 'BLOCKED', 'NEEDS_CONFIGURATION', 'DISABLED');

-- CreateProviderConfigTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProviderStatus" NOT NULL DEFAULT 'READY',
    "settings" JSONB,
    "qualityScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndexProviderConfigProviderId
CREATE UNIQUE INDEX "ProviderConfig_providerId_key" ON "ProviderConfig"("providerId");
CREATE INDEX "ProviderConfig_providerId_idx" ON "ProviderConfig"("providerId");
CREATE INDEX "ProviderConfig_enabled_idx" ON "ProviderConfig"("enabled");

-- CreateTelegramChannelTable
CREATE TABLE "TelegramChannel" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "description" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramChannel_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndexTelegramChannelUsername
CREATE UNIQUE INDEX "TelegramChannel_username_key" ON "TelegramChannel"("username");
CREATE INDEX "TelegramChannel_enabled_idx" ON "TelegramChannel"("enabled");
CREATE INDEX "TelegramChannel_username_idx" ON "TelegramChannel"("username");
