export type PipelineRunId = string & { readonly __brand: 'PipelineRunId' };
export type StageExecutionId = string & { readonly __brand: 'StageExecutionId' };

export function createPipelineRunId(): PipelineRunId {
  return crypto.randomUUID() as PipelineRunId;
}

export function createStageExecutionId(): StageExecutionId {
  return crypto.randomUUID() as StageExecutionId;
}

export interface StageContext {
  readonly runId: PipelineRunId;
  readonly providerId: string;
  readonly workspaceId: string;
  readonly startedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type StageResult<T> = StageSuccess<T> | StageSkipped | StageFailure;

export interface StageSuccess<T> {
  readonly status: 'success';
  readonly data: T;
  readonly durationMs: number;
  readonly warnings: readonly string[];
}

export interface StageSkipped {
  readonly status: 'skipped';
  readonly reason: string;
  readonly durationMs: number;
}

export interface StageFailure {
  readonly status: 'failure';
  readonly error: PipelineError;
  readonly retryable: boolean;
  readonly durationMs: number;
}

export interface PipelineError {
  readonly code: string;
  readonly message: string;
  readonly stage: string;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
}
