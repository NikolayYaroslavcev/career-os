import type { DiscoveryCursor, DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple } from '../types.js';
import { retryFetch } from '../http/retry-fetch.js';

const USER_AGENT = 'CareerOS-CompanyDiscovery/1.0 (+https://careeros.io/bot)';

interface GitHubOrgProfile {
  readonly login: string;
  readonly name?: string;
  readonly blog?: string;
}

interface GitHubOrgsCursor extends DiscoveryCursor {
  readonly index: number;
}

function normalizeBlogUrl(blog: string): string | null {
  const trimmed = blog.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * ADR-035 §1 priority 7: GitHub Organizations. Live-verified (2026-07-30):
 * `GET /orgs/{login}` returns `name` + `blog` (company site URL) for a known
 * org login — e.g. `cncf` -> "Cloud Native Computing Foundation (CNCF)" /
 * https://www.cncf.io, `stripe` -> "Stripe" / https://stripe.dev. Resolves a
 * *seed* list of org logins (CNCF members, curated awesome-lists) to company
 * websites — does not search GitHub's full org namespace (no such bulk
 * enumeration endpoint exists; `/search/users?q=type:org` requires a query
 * term, it's not a full listing).
 *
 * Unauthenticated GitHub API is rate-limited to 60 req/hour. An optional
 * `githubToken` raises this to 5,000/hour — same "conditionally registered,
 * needs credentials" pattern this codebase already uses for France Travail
 * (research/free-provider-expansion/EPIC.md Phase 2, item 5).
 */
export class GitHubOrgsDiscoverySource implements DiscoverySourceFetcher {
  readonly id = 'github_orgs' as const;
  /** ADR §2 "source authority": a curated org-login seed list resolved via GitHub's own API — higher trust than a bare crawl hit. */
  readonly defaultAuthorityScore = 55;

  constructor(
    private readonly orgLogins: readonly string[],
    private readonly githubToken?: string
  ) {}

  async fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    const state = (cursor as GitHubOrgsCursor | null) ?? { index: 0 };
    if (state.index >= this.orgLogins.length) {
      return { tuples: [], cursor: state, hasMore: false };
    }

    const login = this.orgLogins[state.index]!;
    const tuples: RawCompanyTuple[] = [];

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
      };
      if (this.githubToken) headers.Authorization = `Bearer ${this.githubToken}`;

      const response = await retryFetch(`https://api.github.com/orgs/${login}`, { headers });
      if (response.ok) {
        const profile = (await response.json()) as GitHubOrgProfile;
        const website = profile.blog ? normalizeBlogUrl(profile.blog) : null;
        if (website) {
          tuples.push({
            name: profile.name || profile.login,
            url: website,
            sourceAuthorityScore: this.defaultAuthorityScore,
            crawlMetadata: { githubOrg: profile.login },
          });
        }
      }
    } catch {
      // A single org lookup failing must not stall the rest of the seed list (ADR §13).
    }

    const nextIndex = state.index + 1;
    return { tuples, cursor: { index: nextIndex }, hasMore: nextIndex < this.orgLogins.length };
  }
}
