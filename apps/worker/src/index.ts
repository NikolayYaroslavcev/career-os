import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../.env') });

import { Queue, Worker } from 'bullmq';
import {
  loadConfig,
  createLogger,
  VACANCY_ANALYSIS_QUEUE_NAME,
  FOLLOW_UP_REMINDER_QUEUE_NAME,
  FOLLOW_UP_REMINDER_JOB_NAME,
  FOLLOW_UP_REMINDER_SWEEP_INTERVAL_MS,
  type VacancyAnalysisJob,
} from '@careeros/shared';
import { ConsoleAILogger } from '@careeros/ai';
import { connectDatabase, disconnectDatabase } from '@careeros/database';
import { buildWorkerContainer } from './container.js';
import { createVacancyAnalysisJobHandler } from './jobs/vacancy-analysis-processor.js';
import { createFollowUpReminderJobHandler } from './jobs/follow-up-reminder-processor.js';
import { startHealthServer } from './health-server.js';

const start = async () => {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);

  await connectDatabase();

  const container = buildWorkerContainer(config);
  const handler = createVacancyAnalysisJobHandler({
    vacancyRepository: container.repositories.vacancy,
    searchProfileRepository: container.repositories.searchProfile,
    resumeRepository: container.repositories.resume,
    companyRepository: container.repositories.company,
    matchResultRepository: container.repositories.matchResult,
    matchingEngine: container.matchingEngine,
    logger: new ConsoleAILogger(config.LOG_LEVEL === 'debug' ? 'debug' : 'info'),
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
      concurrency: 5,
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('Job completed', { jobId: job.id, status: result?.status });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job?.id, error: err.message });
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
    }
  );

  followUpReminderWorker.on('failed', (job, err) => {
    console.error(`Follow-up reminder sweep ${job?.id} failed:`, err);
  });

  const healthServer = startHealthServer(config.WORKER_HEALTH_PORT, [worker, followUpReminderWorker]);

  console.log('Worker started, waiting for vacancy analysis jobs...');
  console.log(`Follow-up reminder sweep scheduled every ${FOLLOW_UP_REMINDER_SWEEP_INTERVAL_MS}ms.`);
  console.log(`Worker health server listening on port ${config.WORKER_HEALTH_PORT}.`);

  const shutdown = async () => {
    console.log('Shutting down worker...');
    await worker.close();
    await followUpReminderWorker.close();
    await followUpReminderQueue.close();
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
