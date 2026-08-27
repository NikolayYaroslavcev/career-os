import { describe, it, expect } from 'vitest';
import {
  extractPostId,
  extractRawText,
  extractAuthorName,
  extractPublishedAt,
  extractPostUrl,
  extractLinks,
  extractFeedPostCandidate,
} from '../../../src/content/linkedin-feed/extract.js';

function el(html: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.firstElementChild as HTMLElement;
}

describe('extractPostId', () => {
  it('reads a stable id from data-urn on the container', () => {
    const container = el(`<div data-urn="urn:li:activity:7123456789"></div>`);
    expect(extractPostId(container)).toBe('urn:li:activity:7123456789');
  });

  it('accepts share and ugcPost urn prefixes', () => {
    expect(extractPostId(el(`<div data-urn="urn:li:share:111"></div>`))).toBe('urn:li:share:111');
    expect(extractPostId(el(`<div data-urn="urn:li:ugcPost:222"></div>`))).toBe('urn:li:ugcPost:222');
  });

  it('falls back to a nested element carrying data-urn', () => {
    const container = el(`<div class="feed-shared-update-v2"><div class="inner" data-urn="urn:li:activity:999"></div></div>`);
    expect(extractPostId(container)).toBe('urn:li:activity:999');
  });

  it('returns null when no stable urn is present anywhere', () => {
    const container = el(`<div class="feed-shared-update-v2"><span>hello</span></div>`);
    expect(extractPostId(container)).toBeNull();
  });

  it('ignores non-post urns such as comments', () => {
    const container = el(`<div data-urn="urn:li:comment:1234"></div>`);
    expect(extractPostId(container)).toBeNull();
  });

  it('falls back to the opaque id embedded in the SDUI feed container id (no data-urn present)', () => {
    const container = el(`<div id="expandedlHA-ReKDfpro8S7gJOHpw-JOIttPx53ciZ5Ec0ACigMFeedType_MAIN_FEED_RECENT"></div>`);
    expect(extractPostId(container)).toBe('lHA-ReKDfpro8S7gJOHpw-JOIttPx53ciZ5Ec0ACigM');
  });

  it('does not match an id lacking the FeedType_ suffix', () => {
    const container = el(`<div id="expandedSomethingElse"></div>`);
    expect(extractPostId(container)).toBeNull();
  });
});

// Fixture captured 2026-08-25 from an authenticated linkedin.com/feed session
// after LinkedIn's SDUI rewrite removed data-urn/feed-shared-update-v2 from
// the feed entirely (confirmed live: document.querySelectorAll('[data-urn]')
// returned 0 with every other extension disabled). Trimmed to the structure
// that matters for extraction; class names are the real hashed atomic
// classes and carry no meaning — only the id/componentkey/data-testid
// attributes and the a[href] targets are load-bearing here.
const SDUI_FEED_POST_HTML = `
  <div id="expandedlHA-ReKDfpro8S7gJOHpw-JOIttPx53ciZ5Ec0ACigMFeedType_MAIN_FEED_RECENT" componentkey="expandedlHA-ReKDfpro8S7gJOHpw-JOIttPx53ciZ5Ec0ACigMFeedType_MAIN_FEED_RECENT">
    <div role="listitem">
      <div data-display-contents="true">
        <div componentkey="lHA-ReKDfpro8S7gJOHpw-JOIttPx53ciZ5Ec0ACigM">
          <h2><span>Публикация в ленте</span></h2>
          <div>
            <a href="https://www.linkedin.com/in/anna-krivonosova-875759230/" componentkey="a5ba8ca7-f4d0-4c49-8dd0-06b9ee0570ed">
              <div>
                <p><span>Anna Krivonosova</span></p>
                <p><span>• 1-й</span></p>
              </div>
            </a>
          </div>
          <p componentkey="feed-commentary_2ca98da3-de52-48ff-ae15-136b12317c37">
            <span data-testid="expandable-text-box">Ищу начинающего IT-рекрутера в MatchLab. Пиши мне в Telegram: @Annitco</span>
          </p>
          <a href="https://www.linkedin.com/feed/" componentkey="b319364f-d512-4410-8bde-fc202e5e07bf">image</a>
        </div>
      </div>
    </div>
  </div>
`;

describe('extractRawText', () => {
  it('reads text from the primary update-components-text block', () => {
    const container = el(`<div><div class="update-components-text">Hiring a senior engineer</div></div>`);
    expect(extractRawText(container)).toBe('Hiring a senior engineer');
  });

  it('falls back to legacy feed-shared-text selector', () => {
    const container = el(`<div><div class="feed-shared-text">Legacy layout text</div></div>`);
    expect(extractRawText(container)).toBe('Legacy layout text');
  });

  it('returns empty string for image-only posts with no text block', () => {
    const container = el(`<div><img src="photo.jpg" /></div>`);
    expect(extractRawText(container)).toBe('');
  });
});

describe('extractAuthorName', () => {
  it('reads author from update-components-actor__name', () => {
    const container = el(`<div><span class="update-components-actor__name">Jane Doe</span></div>`);
    expect(extractAuthorName(container)).toBe('Jane Doe');
  });

  it('returns undefined when no author element is present', () => {
    const container = el(`<div><span>no author here</span></div>`);
    expect(extractAuthorName(container)).toBeUndefined();
  });
});

describe('extractPublishedAt', () => {
  it('reads an ISO datetime from a time element when present', () => {
    const container = el(`<div><time datetime="2026-08-20T10:00:00Z">2h</time></div>`);
    expect(extractPublishedAt(container)).toBe('2026-08-20T10:00:00Z');
  });

  it('returns undefined when no machine-readable datetime is present', () => {
    const container = el(`<div><span class="update-components-actor__sub-description">2h</span></div>`);
    expect(extractPublishedAt(container)).toBeUndefined();
  });
});

describe('extractPostUrl', () => {
  it('prefers an explicit feed permalink anchor', () => {
    const container = el(`<div><a href="https://www.linkedin.com/feed/update/urn:li:activity:42/?x=1">link</a></div>`);
    expect(extractPostUrl(container)).toBe('https://www.linkedin.com/feed/update/urn:li:activity:42/');
  });

  // LinkedIn's SDUI feed rewrite exposes no permalink for a post's own
  // container (confirmed live 2026-08-26 — a postId-derived URL 404s with
  // "Недействительная ссылка на публикацию"), so no fallback is fabricated.
  it('returns undefined when there is no permalink anchor, rather than fabricating one', () => {
    const container = el(`<div></div>`);
    expect(extractPostUrl(container)).toBeUndefined();
  });
});

describe('extractLinks', () => {
  it('collects external links from the post text block', () => {
    const container = el(`<div><div class="update-components-text">Check <a href="https://example.com/jobs/1">this role</a></div></div>`);
    expect(extractLinks(container)).toEqual(['https://example.com/jobs/1']);
  });

  it('deduplicates repeated hrefs', () => {
    const container = el(`<div><div class="update-components-text"><a href="https://example.com/a">1</a><a href="https://example.com/a">2</a></div></div>`);
    expect(extractLinks(container)).toEqual(['https://example.com/a']);
  });

  it('excludes the post permalink itself from the links list', () => {
    const container = el(`<div><div class="update-components-text"><a href="https://www.linkedin.com/feed/update/urn:li:activity:1/">permalink</a></div></div>`);
    expect(extractLinks(container)).toEqual([]);
  });

  it('returns an empty array when there are no links', () => {
    const container = el(`<div><div class="update-components-text">no links here</div></div>`);
    expect(extractLinks(container)).toEqual([]);
  });

  // Native LinkedIn Job Card attachment — confirmed live (2026-08-26) against
  // an authenticated feed: its "Просмотреть вакансию"/"View job" button (and
  // the card itself) both carry a real linkedin.com/jobs/view/<id> href with
  // a tracking-id query string attached. This is outside every
  // LINK_CONTAINER_SELECTORS root, so it only surfaces via the whole-container
  // fallback scan — and must win priority over any other link in the post.
  it('extracts a Job Card link, stripped of tracking params, ahead of other links', () => {
    const container = el(`
      <div>
        <div class="update-components-text">Check <a href="https://example.com/about">about us</a></div>
        <a href="https://www.linkedin.com/jobs/view/4457912173/?trackingId=abc%3D%3D&isJobSearch=false">Просмотреть вакансию</a>
      </div>
    `);
    expect(extractLinks(container)).toEqual([
      'https://www.linkedin.com/jobs/view/4457912173/',
      'https://example.com/about',
    ]);
  });

  it('unwraps a safety/go redirector link to its real destination', () => {
    const container = el(`
      <div><a href="https://www.linkedin.com/safety/go/?url=http%3A%2F%2Fnexos.ai&urlhash=L1QV&isSdui=true">nexos.ai</a></div>
    `);
    expect(extractLinks(container)).toEqual(['http://nexos.ai']);
  });

  it('excludes hashtag search links, mailto contacts, and the bare site root', () => {
    const container = el(`
      <div>
        <a href="https://www.linkedin.com/search/results/all/?keywords=%23hiring">#hiring</a>
        <a href="mailto:hr@example.com">hr@example.com</a>
        <a href="https://www.linkedin.com/">Отправить</a>
      </div>
    `);
    expect(extractLinks(container)).toEqual([]);
  });
});

describe('extractFeedPostCandidate', () => {
  it('builds a full candidate for a well-formed post', () => {
    const container = el(`
      <div data-urn="urn:li:activity:555">
        <span class="update-components-actor__name">Jane Doe</span>
        <div class="update-components-text">We are hiring! <a href="https://example.com/careers">Apply here</a></div>
      </div>
    `);

    expect(extractFeedPostCandidate(container)).toEqual({
      postId: 'urn:li:activity:555',
      postUrl: undefined,
      authorName: 'Jane Doe',
      rawText: 'We are hiring! Apply here',
      publishedAt: undefined,
      links: ['https://example.com/careers'],
    });
  });

  it('returns null when the post has no stable postId (diagnostic case)', () => {
    const container = el(`<div class="feed-shared-update-v2"><div class="update-components-text">no id here</div></div>`);
    expect(extractFeedPostCandidate(container)).toBeNull();
  });

  it('builds a full candidate from the real SDUI feed markup', () => {
    const container = el(SDUI_FEED_POST_HTML);

    expect(extractFeedPostCandidate(container)).toEqual({
      postId: 'lHA-ReKDfpro8S7gJOHpw-JOIttPx53ciZ5Ec0ACigM',
      postUrl: undefined,
      authorName: 'Anna Krivonosova',
      rawText: 'Ищу начинающего IT-рекрутера в MatchLab. Пиши мне в Telegram: @Annitco',
      publishedAt: undefined,
      links: [],
    });
  });
});
