import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubOrgsDiscoverySource } from '../github-orgs-source.js';

describe('GitHubOrgsDiscoverySource', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', (fetchMock = vi.fn()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves an org login to its company name + normalized blog URL, advancing one seed at a time', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ login: 'stripe', name: 'Stripe', blog: 'stripe.dev' }),
    });

    const source = new GitHubOrgsDiscoverySource(['stripe', 'cncf']);
    const result = await source.fetch(null);

    expect(result.tuples).toEqual([
      {
        name: 'Stripe',
        url: 'https://stripe.dev',
        sourceAuthorityScore: source.defaultAuthorityScore,
        crawlMetadata: { githubOrg: 'stripe' },
      },
    ]);
    expect(result.cursor).toEqual({ index: 1 });
    expect(result.hasMore).toBe(true);
  });

  it('skips an org with no blog field without failing the batch', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ login: 'no-site', name: 'No Site' }) });

    const source = new GitHubOrgsDiscoverySource(['no-site']);
    const result = await source.fetch(null);

    expect(result.tuples).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it('sends an Authorization header when a GitHub token is configured', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ login: 'stripe', name: 'Stripe', blog: 'https://stripe.dev' }) });

    const source = new GitHubOrgsDiscoverySource(['stripe'], 'test-token');
    await source.fetch(null);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('does not fail the batch when the GitHub API call throws', async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new Error('network down'));

    const source = new GitHubOrgsDiscoverySource(['stripe']);
    const resultPromise = source.fetch(null);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.tuples).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    vi.useRealTimers();
  });
});
