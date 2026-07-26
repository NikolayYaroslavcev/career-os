#!/usr/bin/env tsx
/**
 * CI schema-integrity gate. Fails (non-zero exit) if:
 *  1. schema.prisma is not syntactically valid.
 *  2. schema.prisma and prisma/migrations/ have diverged (`prisma migrate diff`
 *     is read-only — it only introspects and diffs, never writes).
 *  3. A freshly-migrated database (DATABASE_URL, expected to already have
 *     `prisma migrate deploy` applied by the caller) differs from schema.prisma.
 *  4. Any table/column this project has previously lost to schema drift is
 *     missing from the live database.
 *
 * Steps 3-4 need a real DATABASE_URL and are meant to run in CI against the
 * ephemeral Postgres service (see .github/workflows/ci.yml, job
 * `schema-validation`) — they are skipped locally when DATABASE_URL is unset
 * so this script stays safe to run against a shared/long-lived dev database.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Tables/columns that were previously lost to schema drift in this project
 * (see migration 20260722162328_fix_schema_drift) — a regression here means
 * the same class of bug (schema.prisma edited without a matching migration,
 * or a migration applied out of band) has resurfaced.
 */
const REQUIRED_SCHEMA: Record<string, readonly string[]> = {
  Vacancy: [
    'id', 'title', 'description', 'requirements',
    'experienceLevel', 'employmentType', 'salaryMin', 'salaryMax', 'currency',
    'location', 'remote', 'metadata', 'workspaceId', 'companyId',
  ],
  // Provider identity moved off Vacancy onto its own table in
  // 20260723000000_add_vacancy_source — a vacancy can have multiple sources.
  VacancySource: ['id', 'providerId', 'externalId', 'vacancyId'],
  MatchResult: [
    'id', 'overallScore', 'confidence', 'recommendation', 'categoryScores',
    'actionableItems', 'explanation', 'searchProfileId', 'vacancyId', 'userId',
  ],
  CompanyWatch: [
    'id', 'name', 'aliases', 'atsType', 'careerUrl', 'pollingInterval', 'active', 'workspaceId',
  ],
  CompanyWatchEvent: ['id', 'type', 'technologies', 'processed', 'companyWatchId'],
  CompanyWatchSyncLog: ['id', 'status', 'jobsFound', 'newJobs', 'companyWatchId'],
  User: ['id', 'email'],
  Workspace: ['id', 'name'],
  SearchProfile: ['id', 'userId', 'isActive'],
  StructuredResume: ['id', 'resumeId', 'sourceHash'],
  Application: ['id', 'vacancyId', 'userId', 'status'],
};

function runPrisma(args: string): void {
  execSync(`pnpm exec prisma ${args}`, { cwd: packageRoot, stdio: 'inherit' });
}

function validateSchema(): void {
  console.log('\n→ Validating schema.prisma syntax...');
  runPrisma('validate --schema=./prisma/schema.prisma');
  console.log('✓ schema.prisma is syntactically valid.');
}

/**
 * Computing "what schema results from replaying every migration in order"
 * requires an actual database engine (Prisma applies the SQL to a scratch
 * database internally), so this needs a `--shadow-database-url` — a
 * throwaway database Prisma is free to create objects in and drop. It must
 * NOT be the application's own DATABASE_URL.
 */
function checkMigrationDrift(shadowDatabaseUrl: string): void {
  console.log('\n→ Checking schema.prisma against prisma/migrations/ for drift...');
  try {
    runPrisma(
      `migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma ` +
        `--shadow-database-url "${shadowDatabaseUrl}" --exit-code`
    );
  } catch {
    throw new SchemaIntegrityError(
      'schema.prisma and prisma/migrations/ have diverged. Every schema.prisma change must ship with a ' +
        'matching migration — run `prisma migrate dev` locally to generate one, then commit it.'
    );
  }
  console.log('✓ schema.prisma matches the migration history exactly (no drift).');
}

function checkFreshDatabaseMatchesSchema(databaseUrl: string): void {
  console.log('\n→ Comparing a freshly-migrated database against schema.prisma...');
  try {
    runPrisma(
      `migrate diff --from-schema-datamodel ./prisma/schema.prisma --to-url "${databaseUrl}" --exit-code`
    );
  } catch {
    throw new SchemaIntegrityError(
      'The database (after `prisma migrate deploy`) differs from schema.prisma. This usually means a ' +
        'migration is missing, a migration file was hand-edited after being applied, or `db push` was used ' +
        'against this database instead of a migration.'
    );
  }
  console.log('✓ The freshly-migrated database matches schema.prisma exactly.');
}

async function checkRequiredTablesAndColumns(databaseUrl: string): Promise<void> {
  console.log('\n→ Checking required tables and columns are present...');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const rows = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
    `;

    const columnsByTable = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
      columnsByTable.get(row.table_name)!.add(row.column_name);
    }

    const missing: string[] = [];
    for (const [table, columns] of Object.entries(REQUIRED_SCHEMA)) {
      const actualColumns = columnsByTable.get(table);
      if (!actualColumns) {
        missing.push(`table "${table}" is missing entirely`);
        continue;
      }
      for (const column of columns) {
        if (!actualColumns.has(column)) {
          missing.push(`column "${table}.${column}" is missing`);
        }
      }
    }

    if (missing.length > 0) {
      throw new SchemaIntegrityError(`Required schema elements are missing:\n  - ${missing.join('\n  - ')}`);
    }

    console.log(
      `✓ All ${Object.keys(REQUIRED_SCHEMA).length} required tables and their key columns are present.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

class SchemaIntegrityError extends Error {}

async function main(): Promise<void> {
  validateSchema();

  // SHADOW_DATABASE_URL must point at a scratch database Prisma may freely
  // create/drop objects in (e.g. a second database on the same throwaway CI
  // Postgres service) — never the application's own DATABASE_URL.
  const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;
  if (shadowDatabaseUrl) {
    checkMigrationDrift(shadowDatabaseUrl);
  } else {
    console.warn(
      '\nSHADOW_DATABASE_URL is not set — skipping the migrations-vs-schema drift check (it needs a ' +
        'scratch database to replay migrations into). CI sets this to a second database on its ' +
        'throwaway Postgres service; see the `schema-validation` job in .github/workflows/ci.yml.'
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn(
      '\nDATABASE_URL is not set — skipping the live-database checks (fresh-DB-vs-schema diff, ' +
        'required tables/columns). CI runs these against the ephemeral Postgres service after ' +
        '`prisma migrate deploy`; see the `schema-validation` job in .github/workflows/ci.yml.'
    );
    return;
  }

  checkFreshDatabaseMatchesSchema(databaseUrl);
  await checkRequiredTablesAndColumns(databaseUrl);
}

main()
  .then(() => {
    console.log('\n✓ Schema integrity checks passed.\n');
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Schema integrity check failed: ${message}\n`);
    process.exit(1);
  });
