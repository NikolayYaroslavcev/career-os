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
import {
  fetchPersonioXmlFeed,
  parsePersonioFeed,
  AtsHttpError,
  type AtsRawJob,
  type PersonioPositionPayload,
} from '@careeros/ats-adapters';

export interface PersonioFetcherConfig {
  readonly company: string;
  readonly companyName: string;
  readonly language?: string;
  readonly logger: Logger;
  readonly metrics: MetricsCollector;
  readonly tracer: Tracer;
}

// Personio's `seniority` field values (per its own docs) mapped onto
// CareerOS's canonical ExperienceLevel scale. Unlike most job-board
// providers, this is read from a genuinely structured field, not inferred
// from free-text title/description regex.
const SENIORITY_MAP: Record<string, RawJob['experienceLevel']> = {
  student_intern: 'intern',
  entry_level: 'junior',
  'entry-level': 'junior',
  experienced: 'middle',
  senior: 'senior',
  executive: 'lead',
};

// Personio's `employmentType`/`schedule` fields mapped onto CareerOS's
// canonical EmploymentType scale.
function mapEmploymentType(employmentType?: string, schedule?: string): RawJob['employmentType'] {
  const text = `${employmentType ?? ''} ${schedule ?? ''}`.toLowerCase();
  if (/freelance/.test(text)) return 'freelance';
  if (/intern|apprentice/.test(text)) return 'internship';
  if (/temporary|contract/.test(text)) return 'contract';
  if (/part[\s-]?time/.test(text)) return 'part_time';
  if (/full[\s-]?time|permanent/.test(text)) return 'full_time';
  return undefined;
}

function isRemoteLocation(location: string | undefined): boolean {
  return !!location && /remote/i.test(location);
}

export class PersonioFetcher implements Fetcher {
  private readonly company: string;
  private readonly companyName: string;
  private readonly language?: string;
  private readonly logger: Logger;
  private readonly metrics: MetricsCollector;
  private readonly tracer: Tracer;

  constructor(config: PersonioFetcherConfig) {
    this.company = config.company;
    this.companyName = config.companyName;
    this.language = config.language;
    this.logger = config.logger;
    this.metrics = config.metrics;
    this.tracer = config.tracer;
  }

  async search(criteria: SearchCriteria): Promise<ProviderResult<RawJob[]>> {
    const span = this.tracer.startSpan('personio.fetcher.search', {
      providerId: 'personio',
      query: criteria.query ?? '',
    });
    const startTime = Date.now();

    try {
      this.logger.info('Fetching Personio jobs', { providerId: 'personio', operation: 'search', company: this.company });

      const xml = await fetchPersonioXmlFeed(this.transportConfig());
      const jobs = parsePersonioFeed(this.transportConfig(), xml)
        .map((raw) => this.toRawJob(raw))
        .filter((job) => matchesCriteria(job, criteria));

      const durationMs = Date.now() - startTime;
      this.metrics.recordHistogram(PROVIDER_METRICS.FETCH_DURATION, durationMs, { providerId: 'personio', operation: 'search', status: 'success' });
      this.metrics.incrementCounter(PROVIDER_METRICS.VACANCIES_FETCHED, jobs.length, { providerId: 'personio' });
      span.setAttribute('jobs.fetched', jobs.length);
      span.end();

      const meta: ResultMeta = { durationMs, providerMeta: { totalJobs: jobs.length } };
      return { ok: true, data: jobs, meta };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.metrics.incrementCounter(PROVIDER_METRICS.FETCH_FAILURE, 1, { providerId: 'personio' });
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
      cursor: { type: 'none', message: 'Personio XML feed returns the full board listing in one call' },
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
      const xml = await fetchPersonioXmlFeed(this.transportConfig());
      return { ok: true, data: xml.length > 0, meta: { durationMs: Date.now() - startTime } };
    } catch {
      return { ok: false, error: ProviderErrorType.NETWORK_ERROR, message: 'Network error', retryable: true, meta: { durationMs: Date.now() - startTime } };
    }
  }

  private transportConfig(): { company: string; language?: string } {
    return { company: this.company, language: this.language };
  }

  private toRawJob(raw: AtsRawJob): RawJob {
    const location = raw.location ?? '';
    const position = raw.rawMetadata as PersonioPositionPayload;

    return {
      sourceId: raw.externalId,
      title: raw.title,
      description: raw.description,
      companyName: this.companyName,
      location,
      // Personio's XML feed carries no salary data — `salary` stays undefined.
      experienceLevel: position.seniority ? SENIORITY_MAP[position.seniority.toLowerCase()] : undefined,
      technologies: position.keywords ? position.keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
      url: raw.url,
      publishedAt: raw.publishedAt ?? new Date(0),
      fetchedAt: new Date(),
      remote: isRemoteLocation(location),
      employmentType: mapEmploymentType(position.employmentType, position.schedule),
      extensions: {
        departments: raw.departments ? [...raw.departments] : [],
        occupation: position.occupation,
        occupationCategory: position.occupationCategory,
        yearsOfExperience: position.yearsOfExperience,
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
