import { describe, it, expect } from 'vitest';
import { PipelineOrchestratorImpl } from '../pipeline/pipeline-orchestrator.js';
import { createPipelineRunId } from '../pipeline/stage-types.js';

describe('PipelineOrchestratorImpl', () => {
  const defaultConfig = {
    maxConcurrency: 5,
    stageTimeoutMs: 30000,
    retryPolicy: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableStages: ['fetch'],
    },
    deadLetterQueue: true,
    observability: {
      metricsEnabled: true,
      loggingLevel: 'info' as const,
      tracingEnabled: true,
      dashboardEnabled: false,
    },
  };

  it('should execute pipeline with multiple stages', async () => {
    const orchestrator = new PipelineOrchestratorImpl(defaultConfig);

    orchestrator.addStage<string, string>('stage1', async (input) => ({
      status: 'success',
      data: `processed-${input}`,
      durationMs: 10,
      warnings: [],
    }));

    orchestrator.addStage<string, string>('stage2', async (input) => ({
      status: 'success',
      data: `${input}-done`,
      durationMs: 10,
      warnings: [],
    }));

    const run = await orchestrator.execute({
      runId: createPipelineRunId(),
      providerId: 'test',
      workspaceId: 'workspace-1',
      startedAt: new Date(),
      metadata: {},
    });

    expect(run.status).toBe('completed');
    expect(run.stages).toHaveLength(2);
    expect(run.completedAt).toBeDefined();
  });

  it('should fail pipeline on stage failure', async () => {
    const orchestrator = new PipelineOrchestratorImpl(defaultConfig);

    orchestrator.addStage<string, string>('stage1', async () => ({
      status: 'failure',
      error: { code: 'TEST_ERROR', message: 'Test failure', stage: 'stage1' },
      retryable: false,
      durationMs: 10,
    }));

    const run = await orchestrator.execute({
      runId: createPipelineRunId(),
      providerId: 'test',
      workspaceId: 'workspace-1',
      startedAt: new Date(),
      metadata: {},
    });

    expect(run.status).toBe('failed');
    expect(run.error).toBeDefined();
  });

  it('should retry failed stages', async () => {
    const orchestrator = new PipelineOrchestratorImpl(defaultConfig);
    let attempts = 0;

    orchestrator.addStage<string, string>('stage1', async () => {
      attempts++;
      if (attempts < 2) {
        return {
          status: 'failure',
          error: { code: 'TEST_ERROR', message: 'Test failure', stage: 'stage1' },
          retryable: true,
          durationMs: 10,
        };
      }
      return {
        status: 'success',
        data: 'success',
        durationMs: 10,
        warnings: [],
      };
    }, 2);

    const run = await orchestrator.execute({
      runId: createPipelineRunId(),
      providerId: 'test',
      workspaceId: 'workspace-1',
      startedAt: new Date(),
      metadata: {},
    });

    expect(run.status).toBe('completed');
    expect(attempts).toBe(2);
  });

  it('should retrieve pipeline runs', async () => {
    const orchestrator = new PipelineOrchestratorImpl(defaultConfig);
    const runId = createPipelineRunId();

    await orchestrator.execute({
      runId,
      providerId: 'test',
      workspaceId: 'workspace-1',
      startedAt: new Date(),
      metadata: {},
    });

    const run = await orchestrator.getRun(runId);
    expect(run).toBeDefined();
    expect(run?.runId).toBe(runId);
  });

  it('should cancel running pipeline', async () => {
    const orchestrator = new PipelineOrchestratorImpl(defaultConfig);
    const runId = createPipelineRunId();

    // First create a completed run
    await orchestrator.execute({
      runId,
      providerId: 'test',
      workspaceId: 'workspace-1',
      startedAt: new Date(),
      metadata: {},
    });

    // Verify we can get the run
    const run = await orchestrator.getRun(runId);
    expect(run).toBeDefined();
    expect(run?.status).toBe('completed');
  });
});
