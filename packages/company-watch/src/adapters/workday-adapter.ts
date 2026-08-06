import type { AtsAdapter, AtsConfig, AtsJob } from './base-adapter.js';
import { extractTechnologies } from './technology-keywords.js';
import {
  WorkdayAdapter as SharedWorkdayAdapter,
  AtsHttpError,
  type AtsRawJob,
  type WorkdayAdapterConfig,
  type WorkdayJobPostingPayload,
} from '@careeros/ats-adapters';

/**
 * ADR-033 Workday migration: this **replaces**, rather than diffs against,
 * the prior company-watch `WorkdayAdapter`. That implementation built its
 * request subdomain as `wd${site}` — conflating the job board's `site` path
 * segment (e.g. `External`) with Workday's actual per-tenant pod number
 * (`wd1`, `wd2`, `wd3`, ...), which are unrelated values. Its single-job URL
 * was also missing the `/job/` path segment real Workday external paths
 * require, and it mapped `postedOn` (free text like "Posted 3 Days Ago")
 * straight through `new Date()`, which always produces `Invalid Date`. It
 * had zero test coverage. None of that was a genuine, working alternate
 * shape worth preserving (contrast Lever's real paginated-vs-bare URL
 * split). This wrapper delegates to the same documented tenant/host/site
 * URL scheme and relative-date parsing providers' fetcher already used
 * successfully. See ADR-033 addendum "Workday migration".
 *
 * Description is built from `bulletFields` here (more useful than
 * providers' placeholder "full description available at the listing page"
 * text) — a deliberate per-consumer enrichment from `rawMetadata`, same
 * pattern as Lever's wrapper computing its own `departments`.
 */
export class WorkdayAdapter implements AtsAdapter {
  readonly atsType = 'WORKDAY' as const;
  private readonly adapter = new SharedWorkdayAdapter();

  async fetchJobs(config: AtsConfig): Promise<AtsJob[]> {
    try {
      const jobs = await this.adapter.fetchJobs(this.toAdapterConfig(config));
      return jobs.map((job) => this.toAtsJob(job));
    } catch (error) {
      throw toWorkdayError(error);
    }
  }

  async fetchJob(config: AtsConfig, externalId: string): Promise<AtsJob | null> {
    try {
      const job = await this.adapter.fetchJob(this.toAdapterConfig(config), externalId);
      return job ? this.toAtsJob(job) : null;
    } catch (error) {
      throw toWorkdayError(error);
    }
  }

  async ping(config: AtsConfig): Promise<boolean> {
    try {
      return await this.adapter.ping(this.toAdapterConfig(config));
    } catch {
      return false;
    }
  }

  private toAdapterConfig(config: AtsConfig): WorkdayAdapterConfig {
    const metadata = config.metadata as { tenant?: string; site?: string; host?: string } | undefined;
    const tenant = metadata?.tenant;
    const site = metadata?.site;
    if (!tenant || !site) {
      throw new Error('Workday adapter requires tenant and site in metadata');
    }
    return { tenant, site, host: metadata?.host };
  }

  private toAtsJob(job: AtsRawJob): AtsJob {
    const raw = job.rawMetadata as WorkdayJobPostingPayload;
    return {
      externalId: job.externalId,
      title: job.title,
      description: raw.bulletFields?.join('\n') || job.description,
      url: job.url,
      location: job.location,
      technologies: extractTechnologies(raw.bulletFields?.join(' ') || ''),
      publishedAt: job.publishedAt,
    };
  }
}

/** Preserves this adapter's own thrown-error message format at the boundary (ADR-033: adapters throw typed errors; consumers compose their own message). */
function toWorkdayError(error: unknown): Error {
  if (error instanceof AtsHttpError) {
    return new Error(`Workday API error: ${error.status} ${error.statusText}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}
