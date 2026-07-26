import type { RawJob } from '../../interfaces/raw-job.js';
import type { LinkedInIngestionPayload } from './linkedin-types.js';

export function validateIngestionPayload(payload: unknown): payload is LinkedInIngestionPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.jobId !== 'string' || p.jobId.trim().length === 0) return false;
  if (typeof p.title !== 'string' || p.title.trim().length === 0) return false;
  if (typeof p.company !== 'string' || p.company.trim().length === 0) return false;
  if (typeof p.url !== 'string' || p.url.trim().length === 0) return false;

  return true;
}

export function ingestionPayloadToRawJob(
  payload: LinkedInIngestionPayload,
  now = new Date(),
): RawJob {
  return {
    sourceId: payload.jobId,
    title: payload.title,
    description: payload.description || '',
    companyName: payload.company,
    location: payload.location || '',
    salary: parseSalary(payload.salary),
    technologies: payload.skills ?? [],
    url: payload.url,
    publishedAt: payload.postedDate ? new Date(payload.postedDate) : now,
    fetchedAt: now,
    remote: payload.location?.toLowerCase().includes('remote') ?? false,
    extensions: {
      source: 'linkedin_extension',
      easyApply: payload.easyApply,
    },
  };
}

function parseSalary(salaryStr: string | undefined): RawJob['salary'] | undefined {
  if (!salaryStr) return undefined;

  const cleaned = salaryStr.replace(/[^0-9kKmM-]/g, ' ').trim();
  const numbers = cleaned.match(/\d+/g);

  if (!numbers || numbers.length === 0) return undefined;

  const parseNumber = (s: string): number => {
    const n = parseInt(s, 10);
    if (s.toLowerCase().includes('k')) return n * 1000;
    if (s.toLowerCase().includes('m')) return n * 1000000;
    return n;
  };

  const from = parseNumber(numbers[0]!);
  const to = numbers.length > 1 ? parseNumber(numbers[1]!) : undefined;

  if (from === 0 && (!to || to === 0)) return undefined;

  return {
    from: from || undefined,
    to: to || undefined,
    currency: 'USD',
    period: 'yearly',
  };
}
