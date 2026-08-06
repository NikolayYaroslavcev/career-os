import type { Fetcher, FetchResult } from '../../interfaces/fetcher.js';
import type { ProviderResult, ResultMeta } from '../../interfaces/result.js';
import type { RawJob } from '../../interfaces/raw-job.js';
import type { SearchCriteria } from '../../interfaces/search-criteria.js';
import type { SyncCursor, CursorState } from '../../interfaces/sync-cursor.js';
import type { Logger } from '../../observability/logger.js';
import type { MetricsCollector } from '../../observability/metrics.js';
import type { Tracer } from '../../observability/tracer.js';
import { PROVIDER_METRICS } from '../../observability/metrics.js';
import { ProviderErrorType } from '../../errors/provider-errors.js';
import { extractTechnologiesFromText } from '../../shared/tech-keywords.js';
import {
  fetchWorkableWidget,
  parseWorkableJobsResponse,
  AtsHttpError,
  type AtsRawJob,
  type WorkableJobPayload,
} from '@careeros/ats-adapters';

export interface WorkableFetcherConfig {
  readonly accountSlug: string;
  readonly companyName: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

// Workable's `experience` field uses a LinkedIn-style taxonomy, mapped onto
// CareerOS's canonical ExperienceLevel scale. Structured field, not free-text
// inference.
const EXPERIENCE_MAP: Record<string, RawJob['experienceLevel']> = {
  'internship': 'intern',
  'entry level': 'junior',
  'associate': 'junior',
  'mid-senior level': 'middle',
  'director': 'lead',
  'executive': 'principal',
};

function mapEmploymentType(employmentType?: string): RawJob['employmentType'] {
  switch ((employmentType ?? '').toLowerCase()) {
    case 'full-time': return 'full_time';
    case 'part-time': return 'part_time';
    case 'contract': return 'contract';
    case 'temporary': return 'contract';
    case 'internship': return 'internship';
    default: return undefined;
  }
}

export class WorkableFetcher implements Fetcher {
  private readonly accountSlug: string;
  private readonly companyName: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: WorkableFetcherConfig) {
    this.accountSlug = config.accountSlug;
    this.companyName = config.companyName;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('workable.fetcher.search', {
      providerId: 'workable',
      query: criteria.query ?? '',
    });
    const startTime = Date.now();

    try {
      this.logger.info('Fetching Workable jobs', { providerId: 'workable', operation: 'search', accountSlug: this.accountSlug });

      const payload = await fetchWorkableWidget({ accountSlug: this.accountSlug });
      const jobs = parseWorkableJobsResponse(payload)
        .map((raw) => this.toRawJob(raw))
        .filter((job) => matchesCriteria(job, criteria));

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'workable', operation: 'search', status: 'success' });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'workable' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      const meta: ResultMeta = { durationMs, providerMeta: { totalJobs: jobs.length } };
      return { ok: true, data: jobs, meta };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'workable' });
      span.setAttribute('error', true);
      span.end();

      if (error instanceof AtsHttpError) {
        return {
          ok: false,
          error: error.status === 429 ? ProviderErrorType.RATE_LIMITED : ProviderErrorType.NETWORK_ERROR,
          message: `HTTP ${error.status}: ${error.statusText}`,
          retryable: true,
          meta: { durationMs },
        };
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: ProviderErrorType.UNKNOWN_ERROR, message, retryable: false, meta: { durationMs } };
    }
  }

  async getVacancy(sourceId: string): Promise<ProviderResult<RawJob | null>> {
    const result = await this.search({});
    if (!result.ok) return result;
    return { ok: true, data: result.data.find((job) => job.sourceId === sourceId) ?? null, meta: result.meta };
  }

  async fetchWithCursor(criteria: SearchCriteria, _cursor: SyncCursor): Promise<ProviderResult<FetchResult>> {
    const startTime = Date.now();
    const result = await this.search(criteria);
    if (!result.ok) return result;

    const durationMs = Date.now() - startTime;
    const cursorState: CursorState = {
      cursor: { type: 'none', message: 'Workable widget endpoint returns the full current job list in one call' },
      strategy: 'none',
      exhausted: true,
      fetchedCount: result.data.length,
    };
    const fetchResult: FetchResult = { jobs: result.data, cursor: cursorState, hasMore: false, meta: { totalJobs: result.data.length } };
    return { ok: true, data: fetchResult, meta: { durationMs } };
  }

  async ping(): Promise<ProviderResult<boolean>> {
    const startTime = Date.now();
    try {
      const payload = await fetchWorkableWidget({ accountSlug: this.accountSlug });
      return { ok: true, data: !!payload, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private toRawJob(raw: AtsRawJob): RawJob {
    const position = raw.rawMetadata as WorkableJobPayload;

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      companyName: this.companyName,
      location: raw.location ?? '',
      // Workable's widget carries no salary data — `salary` stays undefined.
      experienceLevel: position.experience ? EXPERIENCE_MAP[position.experience.toLowerCase()] : undefined,
      technologies: extractTechnologiesFromText(raw.description),
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(0),
      fetchedAt: new Date(),
      remote: position.telecommuting,
      employmentType: mapEmploymentType(position.employment_type),
      extensions: {
        departments: raw.departments ? [...raw.departments] : [],
        function: position.function,
        industry: position.industry,
        education: position.education,
      },
    };
  }
}

function matchesCriteria(job: RawJob, criteria: SearchCriteria): boolean {
  if (criteria.query) {
    const query = criteria.query.toLowerCase();
    if (!job.title.toLowerCase().includes(query) && !job.description.toLowerCase().includes(query)) {
      return false;
    }
  }

  if (criteria.technologies && criteria.technologies.length > 0) {
    const jobTechs = new Set(job.technologies.map((t) => t.toLowerCase()));
    const hasMatch = criteria.technologies.some((t) => jobTechs.has(t.toLowerCase()));
    if (!hasMatch && jobTechs.size > 0) {
      return false;
    }
  }

  if (criteria.remoteOnly && !job.remote) {
    return false;
  }

  if (criteria.location) {
    const location = criteria.location.toLowerCase();
    if (!job.location.toLowerCase().includes(location)) {
      return false;
    }
  }

  return true;
}
