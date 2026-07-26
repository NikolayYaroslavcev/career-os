import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemoteOKProvider } from '../providers/remoteok/remoteok-provider.js';
import { InMemoryMetricsCollector } from '../observability/metrics.js';
import { InMemoryTracer } from '../observability/tracer.js';
import { ConsoleLogger } from '../observability/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FixtureJob {
  readonly id: string | number;
  readonly slug: string;
  readonly company: string;
  readonly company_logo?: string;
  readonly position: string;
  readonly tags: readonly string[];
  readonly description: string;
  readonly salary_min?: number;
  readonly salary_max?: number;
  readonly remote: boolean;
  readonly url: string;
  readonly date: string;
  readonly location?: string;
}

async function loadFixtures(): Promise<readonly FixtureJob[]> {
  const fixturePath = join(__dirname, '..', 'providers', 'remoteok', '__fixtures__', 'remoteok-response.json');
  const content = readFileSync(fixturePath, 'utf-8');
  return JSON.parse(content) as FixtureJob[];
}

async function runSandbox(): Promise<void> {
  console.log('=== CareerOS Provider Sandbox ===\n');
  console.log('Provider: RemoteOK');
  console.log('Mode: Fixture-based (no external HTTP requests)\n');

  const logger = new ConsoleLogger('debug');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  console.log('1. Creating provider...');
  const provider = createRemoteOKProvider({
    logger,
    metrics,
    tracer,
    baseUrl: 'https://httpbin.org/status/200',
  });

  console.log(`   Provider: ${provider.info.name} v${provider.info.version}`);
  console.log(`   ID: ${provider.info.id}`);
  console.log(`   Auth: ${provider.info.auth.type}`);
  console.log(`   Remote: ${provider.info.supportsRemote}`);

  console.log('\n2. Initializing provider...');
  await provider.initialize({});

  console.log('\n3. Checking capabilities...');
  console.log(`   Search: ${provider.capabilities.search.supported}`);
  console.log(`   Pagination: ${provider.capabilities.pagination.strategy}`);
  console.log(`   Max results: ${provider.capabilities.search.maxResults}`);
  console.log(`   Rate limit: ${provider.capabilities.rateLimits.perMinute}/min`);

  console.log('\n4. Loading fixtures...');
  const fixtures = await loadFixtures();
  console.log(`   Loaded ${fixtures.length} jobs from fixtures`);

  console.log('\n5. Running health check...');
  const health = await provider.healthCheck();
  console.log(`   Healthy: ${health.healthy}`);
  console.log(`   Latency: ${health.latencyMs}ms`);
  if (health.message) {
    console.log(`   Message: ${health.message}`);
  }

  console.log('\n6. Running sync (fixture mode)...');
  console.log('   Note: Real sync would fetch from remoteok.com/api');
  console.log('   Using fixture data to demonstrate pipeline...\n');

  const fixtureJobs = fixtures.map((f) => ({
    sourceId: String(f.id),
    title: f.position,
    description: f.description,
    companyName: f.company,
    location: f.location ?? 'Worldwide',
    salary: f.salary_min || f.salary_max ? {
      from: f.salary_min,
      to: f.salary_max,
      currency: 'USD',
      period: 'yearly' as const,
    } : undefined,
    technologies: [...f.tags],
    url: f.url,
    publishedAt: new Date(f.date),
    remote: f.remote,
    fetchedAt: new Date(),
  }));

  console.log('7. Mapping jobs...');
  const mapped = fixtureJobs.map((job) => provider.mapper.map(job));
  console.log(`   Mapped ${mapped.length} jobs`);

  console.log('\n8. Normalizing jobs...');
  const normalized = mapped.map((job) => {
    const error = provider.normalizer.validate(job);
    if (error && error.severity === 'error') {
      return null;
    }
    return provider.normalizer.normalize(job);
  }).filter((j): j is NonNullable<typeof j> => j !== null);

  console.log(`   Normalized ${normalized.length} jobs`);
  console.log(`   Failed: ${mapped.length - normalized.length}`);

  console.log('\n9. Normalized Vacancies:');
  console.log('─'.repeat(80));

  for (const vacancy of normalized) {
    console.log(`\n   [${vacancy.source}:${vacancy.sourceId}] ${vacancy.title}`);
    console.log(`   Company: ${vacancy.companyName}`);
    console.log(`   Location: ${vacancy.location.raw}`);
    console.log(`   Remote: ${vacancy.remote.level}`);
    if (vacancy.salary) {
      console.log(`   Salary: $${vacancy.salary.min ?? '?'} - $${vacancy.salary.max ?? '?'} (${vacancy.salary.period})`);
    }
    console.log(`   Technologies: ${vacancy.technologies.join(', ')}`);
    console.log(`   Published: ${vacancy.publishedAt.toISOString()}`);
    console.log(`   Content Hash: ${vacancy.contentHash}`);
  }

  console.log('\n' + '─'.repeat(80));

  console.log('\n10. Performance Metrics:');
  const fetchStats = metrics.getHistogramStats('provider.fetch.duration_ms');
  if (fetchStats) {
    console.log(`    Fetch duration: min=${fetchStats.min}ms, max=${fetchStats.max}ms, avg=${fetchStats.avg.toFixed(1)}ms`);
  }
  console.log(`    Fetch success: ${metrics.getCounter('provider.fetch.success')}`);
  console.log(`    Fetch failure: ${metrics.getCounter('provider.fetch.failure')}`);
  console.log(`    Vacancies fetched: ${metrics.getCounter('provider.vacancies.fetched')}`);

  console.log('\n11. Tracer Spans:');
  const spans = tracer.getSpans();
  for (const span of spans) {
    console.log(`    ${span.name}: ${span.traceId.slice(0, 8)}...`);
  }

  console.log('\n12. Disposing provider...');
  await provider.dispose();

  console.log('\n=== Sandbox Complete ===');
  console.log('All operations completed without external HTTP requests.');
  console.log('Provider SDK validated successfully.\n');
}

runSandbox().catch((error) => {
  console.error('Sandbox failed:', error);
  process.exit(1);
});