import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../.env') });

import { Queue, Worker } from 'bullmq';
import {
  loadConfig,
  createLogger,
  getRedis,
  VACANCY_ANALYSIS_QUEUE_NAME,
  RedisAiBatchBacklog,
  FOLLOW_UP_REMINDER_QUEUE_NAME,
  FOLLOW_UP_REMINDER_JOB_NAME,
  FOLLOW_UP_REMINDER_SWEEP_INTERVAL_MS,
  RESUME_TAILORING_QUEUE_NAME,
  COMPANY_WATCH_QUEUE,
  COMPANY_WATCH_SCHEDULER_QUEUE_NAME,
  COMPANY_WATCH_SCHEDULER_JOB_NAME,
  COMPANY_WATCH_SCHEDULER_SWEEP_INTERVAL_MS,
  DISCOVERY_SOURCE_RUN_QUEUE,
  DISCOVERY_SOURCE_SCHEDULER_QUEUE_NAME,
  DISCOVERY_SOURCE_SCHEDULER_JOB_NAME,
  DISCOVERY_SOURCE_SCHEDULER_SWEEP_INTERVAL_MS,
  type VacancyAnalysisJob,
  type ResumeTailoringJob,
  type CompanyWatchSyncJob,
  type DiscoverySourceRunJob,
} from '@careeros/shared';
import { ConsoleAILogger } from '@careeros/ai';
import { connectDatabase, disconnectDatabase } from '@careeros/database';
import { buildWorkerContainer } from './container.js';
import { createVacancyAnalysisJobHandler } from './jobs/vacancy-analysis-processor.js';
import { createFollowUpReminderJobHandler } from './jobs/follow-up-reminder-processor.js';
import { createResumeTailoringJobHandler } from './jobs/resume-tailoring-processor.js';
import { createCompanyWatchSchedulerJobHandler } from './jobs/company-watch-scheduler-processor.js';
import { createCompanyWatchSyncJobHandler } from './jobs/company-watch-sync-processor.js';
import { createDiscoverySourceSchedulerJobHandler } from './jobs/discovery-source-scheduler-processor.js';
import { createDiscoverySourceRunJobHandler } from './jobs/discovery-source-run-processor.js';
import { createContinuationHandler } from './continuation.js';
import { startHealthServer } from './health-server.js';

const start = async (): Promise<void> => {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);

  await connectDatabase();

  const container = await buildWorkerContainer(config);
  const handler = createVacancyAnalysisJobHandler({
    vacancyRepository: container.repositories.vacancy,
    searchProfileRepository: container.repositories.searchProfile,
    resumeRepository: container.repositories.resume,
    companyRepository: container.repositories.company,
    matchResultRepository: container.repositories.matchResult,
    matchingEngine: container.matchingEngine,
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
  });

  // Continuous background processing (EPIC-17 Part 6): apps/backend pushes
  // every triage-ranked candidate beyond the first batch into this backlog
  // (see AiBatchBacklog); once a job completes, this same worker process
  // pulls the next AI_BATCH_SIZE candidates for that search profile and
  // enqueues them, repeating until the backlog drains. This mirrors the
  // follow-up-reminder queue below, which is also both produced and consumed
  // in this process.
  const vacancyAnalysisQueue = new Queue<VacancyAnalysisJob>(VACANCY_ANALYSIS_QUEUE_NAME, {
    connection: { url: config.REDIS_URL },
  });
  const continueBatch = createContinuationHandler({
    backlog: new RedisAiBatchBacklog(getRedis(config.REDIS_URL)),
    queue: vacancyAnalysisQueue,
    batchSize: config.AI_BATCH_SIZE,
    logger,
  });

  const worker = new Worker<VacancyAnalysisJob>(
    VACANCY_ANALYSIS_QUEUE_NAME,
    async (job) => {
      logger.info('Worker picked job', {
        jobId: job.id,
        jobName: job.name,
        vacancyId: job.data.vacancyId,
        searchProfileId: job.data.searchProfileId,
      });
      const result = await handler(job);
      logger.info('Worker finished', { jobId: job.id, status: result.status });
      return result;
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: config.WORKER_CONCURRENCY,
      lockDuration: 120_000,
      stalledInterval: 60_000,
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('Job completed', { jobId: job.id, status: result?.status });
    void continueBatch(job.data.searchProfileId);
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job?.id, error: err.message });
    // Continuation must not stall just because one vacancy's AI call failed
    // (e.g. a rate limit) — BullMQ marks a thrown job 'failed', not
    // 'completed', so without this the backlog would never drain past a
    // failing vacancy. Safe to call on every retry attempt too: popping an
    // empty backlog is a no-op.
    if (job) {
      void continueBatch(job.data.searchProfileId);
    }
  });

  // EPIC-08 reminder worker: a self-scheduling recurring sweep — this process
  // both produces its own repeatable trigger and consumes it, unlike vacancy
  // analysis (produced on-demand by apps/backend). Re-registering the
  // repeatable job on every boot is a no-op once it already exists (BullMQ
  // dedupes by queue+name+repeat pattern).
  const followUpReminderQueue = new Queue(FOLLOW_UP_REMINDER_QUEUE_NAME, {
    connection: { url: config.REDIS_URL },
  });
  await followUpReminderQueue.add(
    FOLLOW_UP_REMINDER_JOB_NAME,
    {},
    { repeat: { every: FOLLOW_UP_REMINDER_SWEEP_INTERVAL_MS }, removeOnComplete: true, removeOnFail: true }
  );

  const followUpReminderHandler = createFollowUpReminderJobHandler(container.followUpReminderService);
  const followUpReminderWorker = new Worker(
    FOLLOW_UP_REMINDER_QUEUE_NAME,
    async (job) => {
      const stats = await followUpReminderHandler(job);
      console.log(`Follow-up reminder sweep completed: ${JSON.stringify(stats)}`);
      return stats;
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: 1,
      lockDuration: 60_000,
      stalledInterval: 30_000,
    }
  );

  followUpReminderWorker.on('failed', (job, err) => {
    console.error(`Follow-up reminder sweep ${job?.id} failed:`, err);
  });

  // ADR-031: resume-tailoring pipeline worker. Each job resumes from its own
  // checkpointed stage (see runTailoringPipeline), so BullMQ's own retry
  // (configured on the producer side, BullMqResumeTailoringQueue) re-drives
  // only the failed stage instead of the whole pipeline.
  const resumeTailoringHandler = createResumeTailoringJobHandler({
    vacancyRepository: container.repositories.vacancy,
    resumeRepository: container.repositories.resume,
    companyRepository: container.repositories.company,
    pipelineDeps: container.tailoringPipelineDeps,
  });
  const resumeTailoringWorker = new Worker<ResumeTailoringJob>(
    RESUME_TAILORING_QUEUE_NAME,
    async (job) => {
      logger.info('Resume tailoring job picked', { jobId: job.id, resumeId: job.data.resumeId, vacancyId: job.data.vacancyId });
      const result = await resumeTailoringHandler(job);
      logger.info('Resume tailoring job finished', { jobId: job.id, status: result.status });
      return result;
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: config.WORKER_CONCURRENCY,
      lockDuration: 180_000,
      stalledInterval: 60_000,
    }
  );

  resumeTailoringWorker.on('failed', (job, err) => {
    logger.error('Resume tailoring job failed', { jobId: job?.id, error: err.message });
  });

  // ADR-035 Phase 0: COMPANY_WATCH_QUEUE was declared (packages/shared) but had
  // no producer or consumer — every sync was a manual POST /company-watch/:id/sync.
  // Same self-scheduling shape as the follow-up-reminder pair above: this process
  // both produces the repeatable sweep trigger and consumes the per-company sync
  // jobs it enqueues. The sync queue/worker replaces CompanyWatchService.syncAll()'s
  // old serial for-await loop with worker-concurrency-bounded parallel jobs (ADR-035 §14).
  const companyWatchSyncQueue = new Queue<CompanyWatchSyncJob>(COMPANY_WATCH_QUEUE, {
    connection: { url: config.REDIS_URL },
  });
  const companyWatchSyncHandler = createCompanyWatchSyncJobHandler(container.companyWatchService);
  const companyWatchSyncWorker = new Worker<CompanyWatchSyncJob>(
    COMPANY_WATCH_QUEUE,
    async (job) => {
      logger.info('Company watch sync job picked', { jobId: job.id, companyWatchId: job.data.companyWatchId });
      const result = await companyWatchSyncHandler(job);
      logger.info('Company watch sync job finished', { jobId: job.id, success: result.success });
      return result;
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: config.WORKER_CONCURRENCY,
      lockDuration: 120_000,
      stalledInterval: 60_000,
    }
  );

  companyWatchSyncWorker.on('failed', (job, err) => {
    logger.error('Company watch sync job failed', { jobId: job?.id, error: err.message });
  });

  const companyWatchSchedulerQueue = new Queue(COMPANY_WATCH_SCHEDULER_QUEUE_NAME, {
    connection: { url: config.REDIS_URL },
  });
  await companyWatchSchedulerQueue.add(
    COMPANY_WATCH_SCHEDULER_JOB_NAME,
    {},
    { repeat: { every: COMPANY_WATCH_SCHEDULER_SWEEP_INTERVAL_MS }, removeOnComplete: true, removeOnFail: true }
  );

  const companyWatchSchedulerHandler = createCompanyWatchSchedulerJobHandler({
    companyWatchRepository: container.companyWatchRepository,
    syncQueue: companyWatchSyncQueue,
  });
  const companyWatchSchedulerWorker = new Worker(
    COMPANY_WATCH_SCHEDULER_QUEUE_NAME,
    async (job) => {
      const result = await companyWatchSchedulerHandler(job);
      logger.info('Company watch sweep completed', { scanned: result.scanned, enqueued: result.enqueued });
      return result;
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: 1,
      lockDuration: 60_000,
      stalledInterval: 30_000,
    }
  );

  companyWatchSchedulerWorker.on('failed', (job, err) => {
    logger.error('Company watch sweep failed', { jobId: job?.id, error: err.message });
  });

  // ADR-035 Phase 4: same self-scheduling sweep/run pair as Company Watch's
  // scheduler/sync queues above, applied to bulk DiscoverySource ingestion —
  // this process both produces the repeatable sweep trigger and consumes the
  // per-source run jobs it enqueues.
  const discoverySourceRunQueue = new Queue<DiscoverySourceRunJob>(DISCOVERY_SOURCE_RUN_QUEUE, {
    connection: { url: config.REDIS_URL },
  });
  const discoverySourceRunHandler = createDiscoverySourceRunJobHandler(container.discoveryBulkIngestService);
  const discoverySourceRunWorker = new Worker<DiscoverySourceRunJob>(
    DISCOVERY_SOURCE_RUN_QUEUE,
    async (job) => {
      logger.info('Discovery source run picked', { jobId: job.id, sourceId: job.data.sourceId });
      const result = await discoverySourceRunHandler(job);
      logger.info('Discovery source run finished', { jobId: job.id, found: result.found, enrolled: result.enrolled });
      return result;
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: 1,
      lockDuration: 300_000,
      stalledInterval: 60_000,
    }
  );

  discoverySourceRunWorker.on('failed', (job, err) => {
    logger.error('Discovery source run failed', { jobId: job?.id, error: err.message });
  });

  const discoverySourceSchedulerQueue = new Queue(DISCOVERY_SOURCE_SCHEDULER_QUEUE_NAME, {
    connection: { url: config.REDIS_URL },
  });
  await discoverySourceSchedulerQueue.add(
    DISCOVERY_SOURCE_SCHEDULER_JOB_NAME,
    {},
    { repeat: { every: DISCOVERY_SOURCE_SCHEDULER_SWEEP_INTERVAL_MS }, removeOnComplete: true, removeOnFail: true }
  );

  const discoverySourceSchedulerHandler = createDiscoverySourceSchedulerJobHandler({
    configRepository: container.discoverySourceConfigRepository,
    runQueue: discoverySourceRunQueue,
  });
  const discoverySourceSchedulerWorker = new Worker(
    DISCOVERY_SOURCE_SCHEDULER_QUEUE_NAME,
    async (job) => {
      const result = await discoverySourceSchedulerHandler(job);
      logger.info('Discovery source sweep completed', { scanned: result.scanned, enqueued: result.enqueued });
      return result;
    },
    {
      connection: { url: config.REDIS_URL },
      concurrency: 1,
      lockDuration: 60_000,
      stalledInterval: 30_000,
    }
  );

  discoverySourceSchedulerWorker.on('failed', (job, err) => {
    logger.error('Discovery source sweep failed', { jobId: job?.id, error: err.message });
  });

  const healthServer = startHealthServer(config.WORKER_HEALTH_PORT, [
    worker,
    followUpReminderWorker,
    resumeTailoringWorker,
    companyWatchSyncWorker,
    companyWatchSchedulerWorker,
    discoverySourceRunWorker,
    discoverySourceSchedulerWorker,
  ]);

  console.log('Worker started, waiting for vacancy analysis jobs...');
  console.log(`Follow-up reminder sweep scheduled every ${FOLLOW_UP_REMINDER_SWEEP_INTERVAL_MS}ms.`);
  console.log('Resume tailoring worker listening for jobs...');
  console.log(`Company watch sweep scheduled every ${COMPANY_WATCH_SCHEDULER_SWEEP_INTERVAL_MS}ms.`);
  console.log(`Discovery source sweep scheduled every ${DISCOVERY_SOURCE_SCHEDULER_SWEEP_INTERVAL_MS}ms.`);
  console.log(`Worker health server listening on port ${config.WORKER_HEALTH_PORT}.`);

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down worker...');
    await worker.close();
    await followUpReminderWorker.close();
    await followUpReminderQueue.close();
    await resumeTailoringWorker.close();
    await companyWatchSyncWorker.close();
    await companyWatchSyncQueue.close();
    await companyWatchSchedulerWorker.close();
    await companyWatchSchedulerQueue.close();
    await discoverySourceRunWorker.close();
    await discoverySourceRunQueue.close();
    await discoverySourceSchedulerWorker.close();
    await discoverySourceSchedulerQueue.close();
    await disconnectDatabase();
    healthServer.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
