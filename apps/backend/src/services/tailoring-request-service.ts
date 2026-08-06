import type { TailoredResumeRepository, TailoredResume, TailoringStage, TailoringStatus } from '@careeros/ai';
import { computeTailoringInputHash } from '@careeros/ai';
import type { ResumeTailoringQueue } from '../queues/resume-tailoring-queue.js';
import { UnauthorizedError } from '../middleware/error-handler.js';

export interface TailoringRequestParams {
  readonly userId: string;
  readonly resumeId: string;
  readonly resumeUpdatedAt: Date;
  readonly vacancyId: string;
  readonly vacancyUpdatedAt: Date;
  readonly applicationId?: string;
  readonly forceRegenerate?: boolean;
}

export interface TailoringStatusResponse {
  readonly jobId: string;
  readonly status: 'queued' | 'cached' | 'processing' | 'completed' | 'failed';
  readonly currentStage: TailoringStage;
  readonly cached: boolean;
  readonly result?: {
    readonly tailoredResumeText: string;
    readonly skillMatrix: TailoredResume['skillMatrix'];
    readonly atsScoreBefore: TailoredResume['atsScoreBefore'];
    readonly atsScoreAfter: TailoredResume['atsScoreAfter'];
    readonly changesApplied: TailoredResume['changesApplied'];
    readonly changesRejected: TailoredResume['changesRejected'];
    readonly hallucinationCheck: TailoredResume['hallucinationCheck'];
    readonly confidence?: number;
  };
  readonly error?: string;
}

function buildTailoredResumeId(resumeId: string, vacancyId: string): string {
  return `${resumeId}:${vacancyId}`;
}

function mapStatus(status: TailoringStatus): TailoringStatusResponse['status'] {
  switch (status) {
    case 'QUEUED':
      return 'queued';
    case 'PROCESSING':
      return 'processing';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
  }
}

export function mapTailoredResumeToResponse(
  row: TailoredResume | null,
  id: string,
  cached: boolean,
): TailoringStatusResponse {
  if (!row) {
    // The BullMQ job hasn't been picked up by the worker yet — the id is
    // deterministic (resumeId:vacancyId), so the frontend can start polling
    // it immediately without waiting for a row to exist.
    return { jobId: id, status: 'queued', currentStage: 'QUEUED', cached: false };
  }

  return {
    jobId: row.id,
    status: cached ? 'cached' : mapStatus(row.status),
    currentStage: row.currentStage,
    cached,
    error: row.error,
    result:
      row.status === 'COMPLETED'
        ? {
            tailoredResumeText: row.tailoredResumeText ?? '',
            skillMatrix: row.skillMatrix,
            atsScoreBefore: row.atsScoreBefore,
            atsScoreAfter: row.atsScoreAfter,
            changesApplied: row.changesApplied,
            changesRejected: row.changesRejected,
            hallucinationCheck: row.hallucinationCheck,
            confidence: row.confidence,
          }
        : undefined,
  };
}

/**
 * Single shared entry point for requesting a tailored resume (ADR-031) —
 * used by both the vacancy-scoped (`POST /api/v1/ai/tailor-resume`) and
 * application-scoped (`POST /api/v1/applications/:id/tailor-resume`) routes,
 * which previously each duplicated this logic against AIOrchestrator
 * directly. Enqueues the async pipeline (apps/worker) rather than running it
 * inline — the actual generation/scoring/review work happens there.
 */
export class TailoringRequestService {
  constructor(
    private readonly tailoredResumeRepository: TailoredResumeRepository,
    private readonly resumeTailoringQueue: ResumeTailoringQueue,
  ) {}

  async requestTailoring(params: TailoringRequestParams): Promise<TailoringStatusResponse> {
    const id = buildTailoredResumeId(params.resumeId, params.vacancyId);
    const inputHash = computeTailoringInputHash({
      resumeId: params.resumeId,
      resumeUpdatedAt: params.resumeUpdatedAt,
      vacancyId: params.vacancyId,
      vacancyUpdatedAt: params.vacancyUpdatedAt,
    });

    const existing = await this.tailoredResumeRepository.findById(id);

    if (
      existing &&
      existing.status === 'COMPLETED' &&
      existing.inputHash === inputHash &&
      !params.forceRegenerate
    ) {
      return mapTailoredResumeToResponse(existing, id, true);
    }

    await this.resumeTailoringQueue.enqueue({
      resumeId: params.resumeId,
      vacancyId: params.vacancyId,
      userId: params.userId,
      applicationId: params.applicationId,
      forceRegenerate: params.forceRegenerate,
    });

    return { jobId: id, status: 'queued', currentStage: 'QUEUED', cached: false };
  }

  async getStatus(userId: string, resumeId: string, vacancyId: string): Promise<TailoringStatusResponse> {
    const id = buildTailoredResumeId(resumeId, vacancyId);
    return this.getStatusById(userId, id);
  }

  async getStatusById(userId: string, id: string): Promise<TailoringStatusResponse> {
    const row = await this.tailoredResumeRepository.findById(id);
    if (row && row.userId !== userId) {
      throw new UnauthorizedError('Not your tailored resume');
    }
    return mapTailoredResumeToResponse(row, id, false);
  }
}
