import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import {
  createRemotiveProvider,
  createArbeitnowProvider,
  createJobicyProvider,
  createWWRProvider,
  createPyJobsProvider,
  createDjangoJobsProvider,
  createSpeedrunProvider,
  createWorkingNomadsProvider,
  createNoDeskProvider,
  createHNHiringProvider,
  createLinkedInProvider,
  createHHProvider,
  createHabrCareerProvider,
  ConsoleLogger as ProviderConsoleLogger,
  InMemoryMetricsCollector as ProviderInMemoryMetricsCollector,
  InMemoryTracer as ProviderInMemoryTracer,
  DefaultProviderJob,
} from '@careeros/providers';

const logger = new ProviderConsoleLogger('info');

function createMetrics(): ProviderInMemoryMetricsCollector {
  return new ProviderInMemoryMetricsCollector();
}

function createTracer(): ProviderInMemoryTracer {
  return new ProviderInMemoryTracer();
}

async function testProvider(name: string, providerFactory: () => DefaultProviderJob): Promise<void> {
  console.log(`\n=== Testing ${name} ===`);
  const provider = providerFactory();
  try {
    const result = await provider.sync();
    if (result.ok) {
      console.log(`  Status: SUCCESS`);
      console.log(`  Imported: ${result.data.imported.length}`);
      console.log(`  Metrics:`, JSON.stringify(result.data.metrics));
      const sample = result.data.imported[0];
      if (sample) {
        console.log(`  Sample title: ${sample.title}`);
        console.log(`  Sample company: ${sample.companyName}`);
        console.log(`  Sample url: ${sample.url}`);
      }
    } else {
      console.log(`  Status: FAILED`);
      console.log(`  Error: ${result.message}`);
    }
  } catch (error) {
    console.log(`  Status: ERROR`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`  Stack: ${error instanceof Error ? error.stack?.substring(0, 500) : 'N/A'}`);
  }
}

async function main(): Promise<void> {
  console.log('Starting provider sync tests...');
  
  const providers: Array<[string, () => DefaultProviderJob]> = [
    ['hh', (): DefaultProviderJob => createHHProvider({ accessToken: process.env.HH_ACCESS_TOKEN, areas: (process.env.HH_AREAS ?? '113,16,40,97,48,9').split(',').map((a) => a.trim()).filter(Boolean), logger, metrics: createMetrics(), tracer: createTracer() })],
    ['habr_career', (): DefaultProviderJob => createHabrCareerProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['remotive', (): DefaultProviderJob => createRemotiveProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['arbeitnow', (): DefaultProviderJob => createArbeitnowProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['jobicy', (): DefaultProviderJob => createJobicyProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['we_work_remotely', (): DefaultProviderJob => createWWRProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['pyjobs', (): DefaultProviderJob => createPyJobsProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['django_jobs', (): DefaultProviderJob => createDjangoJobsProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['speedrun', (): DefaultProviderJob => createSpeedrunProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['working_nomads', (): DefaultProviderJob => createWorkingNomadsProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['nodesk', (): DefaultProviderJob => createNoDeskProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['hn_hiring', (): DefaultProviderJob => createHNHiringProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
    ['linkedin', (): DefaultProviderJob => createLinkedInProvider({ logger, metrics: createMetrics(), tracer: createTracer() })],
  ];
  
  console.log(`Testing ${providers.length} providers...`);
  
  for (const [name, factory] of providers) {
    await testProvider(name, factory);
  }
  
  console.log('\n=== All tests complete ===');
}

main().catch(console.error);
