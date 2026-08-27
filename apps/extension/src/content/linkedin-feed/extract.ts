import type { LinkedInFeedPostCandidate } from './types.js';

const POST_URN_PATTERN = /^urn:li:(activity|share|ugcPost):/;

// LinkedIn's SDUI feed rewrite (2026) dropped data-urn entirely — container
// ids now look like `expanded<opaqueId>FeedType_MAIN_FEED_RECENT`, sampled
// from a live authenticated feed. The opaque id isn't a urn, just an opaque
// per-post token, but it's stable enough to dedupe on.
const EXPANDED_ID_PATTERN = /^expanded(.+?)FeedType_[A-Za-z0-9_]+$/;

const TEXT_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '.update-components-text',
  '.feed-shared-update-v2__description .feed-shared-inline-show-more-text',
  '.feed-shared-inline-show-more-text',
  '.feed-shared-text',
];

const AUTHOR_SELECTORS = [
  '.update-components-actor__name',
  '.feed-shared-actor__name',
  '[data-anonymize="person-name"]',
];

const LINK_CONTAINER_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '.update-components-text',
  '.feed-shared-text',
  '.feed-shared-article',
  '.update-components-article',
];

// A native LinkedIn Job Card attachment (shared vacancy preview with a "View
// job"/"Просмотреть вакансию" button) always carries a real, working
// linkedin.com/jobs/view/<id> href — confirmed live against an authenticated
// feed (2026-08-26). Unlike the post's own permalink, this is present in the
// DOM with no user interaction required, so it's the strongest possible
// signal and must win over any other link found in the post.
const JOB_CARD_LINK_PATTERN = /linkedin\.com\/jobs\/view\//;

// Non-vacancy LinkedIn chrome that a whole-container link scan otherwise
// picks up: hashtag search pages, the safety interstitial's own page (its
// wrapped destination is unwrapped separately, see unwrapSafetyRedirect),
// mailto: contacts, and the bare site root ("Отправить"/send-privately
// button). None of these are ever the vacancy itself.
const NON_VACANCY_LINK_PATTERN = /linkedin\.com\/(search\/|help\/)/;

function unwrapSafetyRedirect(href: string): string {
  if (!href.includes('linkedin.com/safety/go')) return href;
  try {
    const real = new URL(href).searchParams.get('url');
    return real || href;
  } catch {
    return href;
  }
}

function stripTrackingParams(href: string): string {
  try {
    const url = new URL(href);
    url.search = '';
    return url.toString();
  } catch {
    return href;
  }
}

export function extractPostId(container: Element): string | null {
  const own = container.getAttribute('data-urn');
  if (own && POST_URN_PATTERN.test(own)) return own;

  const nested = container.querySelector('[data-urn]');
  const nestedUrn = nested?.getAttribute('data-urn') ?? null;
  if (nestedUrn && POST_URN_PATTERN.test(nestedUrn)) return nestedUrn;

  const expandedMatch = container.id.match(EXPANDED_ID_PATTERN);
  if (expandedMatch) return expandedMatch[1] ?? null;

  return null;
}

// The author's display name has no stable attribute in the SDUI markup —
// it's the first non-connection-degree text inside the profile link (the
// second such line is always the "• 1st"/"• 2nd" connection degree).
function extractAuthorNameFromProfileLink(container: Element): string | undefined {
  const profileLink = container.querySelector('a[href*="linkedin.com/in/"]');
  if (!profileLink) return undefined;

  for (const p of profileLink.querySelectorAll('p')) {
    const text = p.textContent?.trim();
    if (text && !text.startsWith('•')) return text;
  }
  return undefined;
}

export function extractRawText(container: Element): string {
  for (const selector of TEXT_SELECTORS) {
    const text = container.querySelector(selector)?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

export function extractAuthorName(container: Element): string | undefined {
  for (const selector of AUTHOR_SELECTORS) {
    const text = container.querySelector(selector)?.textContent?.trim();
    if (text) return text;
  }
  return extractAuthorNameFromProfileLink(container);
}

export function extractPublishedAt(container: Element): string | undefined {
  const datetime = container.querySelector('time[datetime]')?.getAttribute('datetime')?.trim();
  return datetime || undefined;
}

// The SDUI feed rewrite (2026) dropped the post's own permalink anchor
// entirely — confirmed live (2026-08-26): every container-scoped a[href] now
// either targets a bare /feed/ placeholder or, for a repost/quote, a
// *different* embedded post's permalink, never this container's own. A
// postId-derived URL (the old fallback) was verified live to 404 with
// "Недействительная ссылка на публикацию" ("Invalid post link") — LinkedIn's
// opaque per-post token is not a resolvable urn, so that fallback is never
// constructed here; no automatic permalink means no postUrl at all.
export function extractPostUrl(container: Element): string | undefined {
  const permalink = container.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"]');
  return permalink?.href ? permalink.href.split('?')[0] : undefined;
}

function collectLinksFrom(root: ParentNode, hrefs: Set<string>, onlyJobCards: boolean): void {
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = anchor.href;
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    if (onlyJobCards && !JOB_CARD_LINK_PATTERN.test(href)) continue;
    if (href.includes('linkedin.com/feed/update/')) continue;
    if (href.includes('linkedin.com/in/')) continue;
    if (href === 'https://www.linkedin.com/feed/' || href === 'https://www.linkedin.com/') continue;
    if (NON_VACANCY_LINK_PATTERN.test(href)) continue;

    const resolved = JOB_CARD_LINK_PATTERN.test(href) ? stripTrackingParams(href) : unwrapSafetyRedirect(href);
    hrefs.add(resolved);
  }
}

// Job Card links sort first (see JOB_CARD_LINK_PATTERN) since they're the
// strongest, most direct signal LinkedIn provides automatically; everything
// else preserves DOM order.
export function extractLinks(container: Element): string[] {
  const roots = LINK_CONTAINER_SELECTORS
    .map(selector => container.querySelector(selector))
    .filter((node): node is Element => node !== null);

  const searchRoots = roots.length > 0 ? roots : [container];
  const hrefs = new Set<string>();

  for (const root of searchRoots) collectLinksFrom(root, hrefs, false);

  // A Job Card is a sibling attachment component, never nested inside the
  // text/article roots above — confirmed live (2026-08-26) — so when a root
  // above matched, it would otherwise shadow the card entirely. Scan the
  // whole container for it specifically, regardless of which roots matched.
  collectLinksFrom(container, hrefs, true);

  return [...hrefs].sort((a, b) => Number(JOB_CARD_LINK_PATTERN.test(b)) - Number(JOB_CARD_LINK_PATTERN.test(a)));
}

export function extractFeedPostCandidate(container: Element): LinkedInFeedPostCandidate | null {
  const postId = extractPostId(container);
  if (!postId) return null;

  return {
    postId,
    postUrl: extractPostUrl(container),
    authorName: extractAuthorName(container),
    rawText: extractRawText(container),
    publishedAt: extractPublishedAt(container),
    links: extractLinks(container),
  };
}
