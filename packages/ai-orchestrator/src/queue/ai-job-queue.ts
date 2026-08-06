import { Queue, Worker, type Job } from 'bullmq';
import type { AIProvider } from '@careeros/ai';
import { estimateCost, getModelPricing } from '@careeros/ai';
import type { AIJobRepository, AIUsageRepository } from '@careeros/database';
import type { AIFeature, AIOrchestratorConfig, JobHandler } from '../orchestrator-config.js';

export const AI_REQUESTS_QUEUE = 'ai-requests';
export const AI_REQUEST_JOB = 'ai-request';

export interface AIJobPayload {
  readonly jobId: string;
  readonly feature: AIFeature;
  readonly userId: string;
  readonly input: unknown;
  readonly inputHash: string;
  readonly provider?: string;
  readonly model?: string;
}

export interface AIJobResult {
  readonly status: 'completed' | 'failed';
  readonly result?: unknown;
  readonly error?: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly latencyMs: number;
  readonly provider: string;
  readonly model: string;
}

export class AIJobQueue {
  private readonly queue: Queue<AIJobPayload>;
  private readonly jobRepository: AIJobRepository;
  private readonly usageRepository: AIUsageRepository;
  private readonly handlers: Map<AIFeature, JobHandler>;
  private readonly config: AIOrchestratorConfig;

  constructor(
    redisUrl: string,
    jobRepository: AIJobRepository,
    usageRepository: AIUsageRepository,
    handlers: Map<AIFeature, JobHandler>,
    config: AIOrchestratorConfig
  ) {
    this.queue = new Queue<AIJobPayload>(AI_REQUESTS_QUEUE, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: config.maxRetries ?? 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
    this.jobRepository = jobRepository;
    this.usageRepository = usageRepository;
    this.handlers = handlers;
    this.config = config;
  }

  async enqueue(payload: AIJobPayload): Promise<void> {
    await this.queue.add(AI_REQUEST_JOB, payload, {
      jobId: payload.jobId,
      priority: 0,
    });
  }

  createWorker(
    resolveProvider: (feature: AIFeature, userId: string) => Promise<AIProvider>
  ): Worker<AIJobPayload, AIJobResult> {
    return new Worker<AIJobPayload, AIJobResult>(
      AI_REQUESTS_QUEUE,
      async (job: Job<AIJobPayload>) => {
        const { jobId, feature, userId, input } = job.data;
        const handler = this.handlers.get(feature);

        if (!handler) {
          throw new Error(`No handler registered for feature: ${feature}`);
        }

        // Update job status to processing
        await this.jobRepository.update(jobId, {
          status: 'PROCESSING',
          startedAt: new Date(),
        });

        const startTime = Date.now();
        const provider = await resolveProvider(feature, userId);

        try {
          const { result, usage } = await handler.execute(input, provider);
          const latencyMs = Date.now() - startTime;

          const tokensIn = usage.promptTokens;
          const tokensOut = usage.completionTokens;
          const totalTokens = usage.totalTokens;
          const estimatedCost = estimateCost(usage, getModelPricing(provider.name, provider.defaultModel));

          // Update job with result
          await this.jobRepository.update(jobId, {
            status: 'COMPLETED',
            result,
            provider: provider.name,
            model: provider.defaultModel,
            latencyMs,
            completedAt: new Date(),
          });

          return {
            status: 'completed',
            result,
            tokensIn,
            tokensOut,
            totalTokens,
            estimatedCost,
            latencyMs,
            provider: provider.name,
            model: provider.defaultModel,
          };
        } catch (error) {
          const latencyMs = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);

          await this.jobRepository.update(jobId, {
            status: 'FAILED',
            error: errorMessage,
            latencyMs,
            completedAt: new Date(),
          });

          throw error;
        }
      },
      {
        connection: { url: this.config.redisUrl },
        concurrency: 5,
        lockDuration: 120_000,
        stalledInterval: 60_000,
      }
    );
  }

  async getJob(jobId: string): Promise<Job<AIJobPayload> | undefined> {
    return this.queue.getJob(jobId);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
