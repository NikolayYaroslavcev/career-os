import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemotiveFetcher } from '../remotive-fetcher.js';
import { ConsoleLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';
import fixtureResponse from '../__fixtures__/remotive-response.json' with { type: 'json' };

function jsonResponse(body: unknown, init?: Partial<{ ok: boolean; status: number }>): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

function jobWithSalary(id: string, salary: string) {
  return {
    id,
    title: 'Backend Engineer',
    description: 'Build things.',
    company_name: 'Acme',
    candidate_required_location: 'Worldwide',
    salary,
    tags: [],
    url: `https://remotive.com/job/${id}`,
    publication_date: '2024-01-15T00:00:00Z',
  };
}

describe('RemotiveFetcher (contract)', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new RemotiveFetcher({
    baseUrl: 'https://remotive.com/api/remote-jobs',
    logger,
    metrics,
    tracer,
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps a recorded API response without throwing, preserving required fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(fixtureResponse));

    const result = await fetcher.search({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);

    const [full, noSalary, commaDecimal] = result.data;
    expect(full?.sourceId).toBe('1901234');
    expect(full?.title).toBe('Senior Backend Engineer');
    expect(full?.companyName).toBe('Acme Remote Inc');
    expect(full?.technologies).toEqual(['typescript', 'node.js', 'postgresql']);
    expect(full?.salary).toEqual({ from: 120000, to: 150000, currency: 'USD', period: 'yearly' });

    // Optional/empty salary is handled safely (no salary data, not a crash or a $0 range).
    expect(noSalary?.salary).toBeUndefined();
    expect(noSalary?.technologies).toEqual([]);

    expect(commaDecimal?.salary).toEqual({ from: 31200, to: 52000, currency: 'USD', period: 'yearly' });
  });

  it('does not throw and returns an empty list when the jobs array is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ job_count: 0 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('returns a network error instead of throwing on a non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NETWORK_ERROR');
  });
});

describe('RemotiveFetcher salary parsing', () => {
  const logger = new ConsoleLogger('error');
  const metrics = new InMemoryMetricsCollector();
  const tracer = new InMemoryTracer();

  const fetcher = new RemotiveFetcher({
    baseUrl: 'https://remotive.com/api/remote-jobs',
    logger,
    metrics,
    tracer,
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function parse(salary: string) {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ jobs: [jobWithSalary('1', salary)] }));
    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    return result.data[0]?.salary;
  }

  it('parses "$50k"', async () => {
    const salary = await parse('$50k');
    expect(salary).toEqual({ from: 50000, to: 50000, currency: 'USD', period: 'yearly' });
  });

  it('parses "$50K" (uppercase K)', async () => {
    const salary = await parse('$50K');
    expect(salary).toEqual({ from: 50000, to: 50000, currency: 'USD', period: 'yearly' });
  });

  it('parses "$31.2k" (dot decimal)', async () => {
    const salary = await parse('$31.2k');
    expect(salary?.from).toBeCloseTo(31200);
    expect(salary?.to).toBeCloseTo(31200);
  });

  it('parses "$31,2k" (comma as decimal point, since a "k" suffix is present)', async () => {
    const salary = await parse('$31,2k');
    expect(salary?.from).toBeCloseTo(31200);
    expect(salary?.to).toBeCloseTo(31200);
  });

  it('parses "$50k-$90k" as an ascending range', async () => {
    const salary = await parse('$50k-$90k');
    expect(salary).toEqual({ from: 50000, to: 90000, currency: 'USD', period: 'yearly' });
  });

  it('normalizes "$90k-$50k" (reversed range) into an ascending from/to', async () => {
    const salary = await parse('$90k-$50k');
    expect(salary?.from).toBe(50000);
    expect(salary?.to).toBe(90000);
    expect(salary?.from ?? 0).toBeLessThanOrEqual(salary?.to ?? 0);
  });

  it('returns undefined for an empty salary string without throwing', async () => {
    const salary = await parse('');
    expect(salary).toBeUndefined();
  });

  it('returns undefined for an invalid/non-numeric salary string without throwing', async () => {
    const salary = await parse('Competitive, DOE');
    expect(salary).toBeUndefined();
  });

  it('detects an hourly period from the salary text', async () => {
    const salary = await parse('$90 - $150 /hour');
    expect(salary?.period).toBe('hourly');
    expect(salary?.from).toBe(90);
    expect(salary?.to).toBe(150);
  });

  it('never throws and always returns an ascending (from <= to) range across a batch of malformed inputs', async () => {
    const malformed = ['', 'N/A', '$', 'k', '-', '$50k-', '-$50k', '50-90-120k', '💰💰💰', '   '];

    for (const raw of malformed) {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ jobs: [jobWithSalary('m', raw)] }));
      const result = await fetcher.search({});
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const salary = result.data[0]?.salary;
      if (salary) {
        expect(salary.from ?? 0).toBeLessThanOrEqual(salary.to ?? 0);
        expect(Number.isNaN(salary.from ?? 0)).toBe(false);
        expect(Number.isNaN(salary.to ?? 0)).toBe(false);
      }
    }
  });

  it('does not crash the whole sync when the jobs array contains a mix of valid and malformed salaries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        jobs: [
          jobWithSalary('1', '$50k-$90k'),
          jobWithSalary('2', ''),
          jobWithSalary('3', 'garbage'),
          jobWithSalary('4', '$90k-$50k'),
        ],
      })
    );

    const result = await fetcher.search({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(4);
    expect(result.data[0]?.salary).toEqual({ from: 50000, to: 90000, currency: 'USD', period: 'yearly' });
    expect(result.data[1]?.salary).toBeUndefined();
    expect(result.data[2]?.salary).toBeUndefined();
    expect(result.data[3]?.salary).toEqual({ from: 50000, to: 90000, currency: 'USD', period: 'yearly' });
  });
});
