import type { PipelineRunId, StageContext, StageResult, StageFailure } from './stage-types.js';

export interface PipelineConfig {
  readonly maxConcurrency: number;
  readonly stageTimeoutMs: number;
  readonly retryPolicy: PipelineRetryPolicy;
  readonly deadLetterQueue: boolean;
  readonly observability: ObservabilityConfig;
}

export interface PipelineRetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly retryableStages: readonly string[];
}

export interface ObservabilityConfig {
  readonly metricsEnabled: boolean;
  readonly loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly tracingEnabled: boolean;
  readonly dashboardEnabled: boolean;
}

export interface PipelineRun {
  readonly runId: PipelineRunId;
  readonly status: PipelineRunStatus;
  readonly stages: readonly StageExecution[];
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly error?: StageFailure;
}

export type PipelineRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'cancelled';

export interface StageExecution {
  readonly stageName: string;
  readonly status: StageResult<unknown>['status'];
  readonly durationMs: number;
  readonly inputSize: number;
  readonly outputSize: number;
  readonly error?: string;
  readonly retryCount: number;
}

export interface PipelineOrchestrator {
  execute(context: StageContext): Promise<PipelineRun>;
  getRun(runId: PipelineRunId): Promise<PipelineRun | null>;
  cancelRun(runId: PipelineRunId): Promise<void>;
  getRunsByProvider(providerId: string, limit?: number): Promise<readonly PipelineRun[]>;
}

type StageHandler<TInput, TOutput> = (input: TInput, context: StageContext) => Promise<StageResult<TOutput>>;

interface StageDefinition<TInput, TOutput> {
  readonly name: string;
  readonly handler: StageHandler<TInput, TOutput>;
  readonly maxAttempts: number;
}

export class PipelineOrchestratorImpl implements PipelineOrchestrator {
  private runs = new Map<PipelineRunId, PipelineRun>();
  private stages: StageDefinition<unknown, unknown>[] = [];

  constructor(private readonly config: PipelineConfig) {}

  addStage<TInput, TOutput>(
    name: string,
    handler: StageHandler<TInput, TOutput>,
    maxAttempts: number = 1,
  ): void {
    this.stages.push({
      name,
      handler: handler as StageHandler<unknown, unknown>,
      maxAttempts,
    });
  }

  async execute(context: StageContext): Promise<PipelineRun> {
    const run: PipelineRun = {
      runId: context.runId,
      status: 'running',
      stages: [],
      startedAt: context.startedAt,
    };

    this.runs.set(context.runId, run);

    let currentInput: unknown = undefined;
    const completedStages: StageExecution[] = [];

    for (const stage of this.stages) {
      const { execution, stageResult } = await this.executeStage(stage, currentInput, context);
      completedStages.push(execution);

      if (execution.status === 'failure') {
        const failedRun: PipelineRun = {
          ...run,
          status: 'failed',
          stages: completedStages,
          completedAt: new Date(),
          error: {
            status: 'failure',
            error: {
              code: 'STAGE_FAILED',
              message: execution.error ?? `Stage ${stage.name} failed`,
              stage: stage.name,
            },
            retryable: false,
            durationMs: execution.durationMs,
          },
        };
        this.runs.set(context.runId, failedRun);
        return failedRun;
      }

      if (stageResult?.status === 'success') {
        currentInput = stageResult.data;
      }
    }

    const completedRun: PipelineRun = {
      ...run,
      status: 'completed',
      stages: completedStages,
      completedAt: new Date(),
    };

    this.runs.set(context.runId, completedRun);
    return completedRun;
  }

  async getRun(runId: PipelineRunId): Promise<PipelineRun | null> {
    return this.runs.get(runId) ?? null;
  }

  async cancelRun(runId: PipelineRunId): Promise<void> {
    const run = this.runs.get(runId);
    if (run && run.status === 'running') {
      this.runs.set(runId, {
        ...run,
        status: 'cancelled',
        completedAt: new Date(),
      });
    }
  }

  async getRunsByProvider(providerId: string, limit: number = 10): Promise<readonly PipelineRun[]> {
    return Array.from(this.runs.values())
      .filter((run) => {
        const providerStage = run.stages.find((s) => s.stageName === 'provider');
        return providerStage !== undefined;
      })
      .slice(-limit);
  }

  private async executeStage(
    stage: StageDefinition<unknown, unknown>,
    input: unknown,
    context: StageContext,
  ): Promise<{ execution: StageExecution; stageResult: StageResult<unknown> | null }> {
    const startTime = Date.now();
    let lastResult: StageResult<unknown> | null = null;
    let retryCount = 0;

    for (let attempt = 1; attempt <= stage.maxAttempts; attempt++) {
      try {
        lastResult = await stage.handler(input, context);
        if (lastResult.status === 'success' || lastResult.status === 'skipped') {
          break;
        }
      } catch (error) {
        lastResult = {
          status: 'failure',
          error: {
            code: 'HANDLER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            stage: stage.name,
            cause: error instanceof Error ? error : undefined,
          },
          retryable: true,
          durationMs: Date.now() - startTime,
        };
      }

      if (attempt < stage.maxAttempts) {
        retryCount++;
        const delay = this.config.retryPolicy.baseDelayMs *
          Math.pow(this.config.retryPolicy.backoffMultiplier, attempt - 1);
        await this.sleep(Math.min(delay, this.config.retryPolicy.maxDelayMs));
      }
    }

    const durationMs = Date.now() - startTime;

    const execution: StageExecution = {
      stageName: stage.name,
      status: lastResult?.status ?? 'failure',
      durationMs,
      inputSize: Array.isArray(input) ? input.length : 0,
      outputSize: lastResult?.status === 'success' ? (
        Array.isArray(lastResult.data) ? lastResult.data.length : 1
      ) : 0,
      error: lastResult?.status === 'failure' ? lastResult.error.message : undefined,
      retryCount,
    };

    return { execution, stageResult: lastResult };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
