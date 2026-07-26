#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { getEncryptionService, validateEncryptionConfig } from '@careeros/shared';

interface MigrationResult {
  total: number;
  encrypted: number;
  migrated: number;
  skipped: number;
  errors: string[];
}

async function migrateProviderKeys(): Promise<MigrationResult> {
  validateEncryptionConfig();

  const prisma = new PrismaClient();
  const encryption = getEncryptionService();

  const result: MigrationResult = {
    total: 0,
    encrypted: 0,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const records = await prisma.aIProviderConfiguration.findMany({
      where: {
        apiKey: { not: null },
      },
      select: {
        id: true,
        userId: true,
        provider: true,
        apiKey: true,
      },
    });

    result.total = records.length;
    console.log(`Found ${result.total} provider configurations with API keys.`);

    for (const record of records) {
      if (!record.apiKey) {
        result.skipped++;
        continue;
      }

      if (encryption.isEncrypted(record.apiKey)) {
        result.encrypted++;
        continue;
      }

      try {
        const encrypted = encryption.encrypt(record.apiKey);
        await prisma.aIProviderConfiguration.update({
          where: { id: record.id },
          data: { apiKey: encrypted },
        });
        result.migrated++;
        console.log(`  Migrated: ${record.provider} (user: ${record.userId ?? 'global'})`);
      } catch (error) {
        const msg = `Failed to migrate ${record.provider} (user: ${record.userId ?? 'global'}): ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(msg);
        console.error(`  ${msg}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

async function main(): Promise<void> {
  console.log('=== Provider Key Encryption Migration ===\n');

  try {
    const result = await migrateProviderKeys();

    console.log('\n=== Migration Summary ===');
    console.log(`Total records:   ${result.total}`);
    console.log(`Already encrypted: ${result.encrypted}`);
    console.log(`Newly migrated:  ${result.migrated}`);
    console.log(`Skipped (null):  ${result.skipped}`);

    if (result.errors.length > 0) {
      console.log(`\nErrors: ${result.errors.length}`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
      process.exit(1);
    }

    console.log('\nMigration completed successfully.');
  } catch (error) {
    console.error('\nMigration failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
