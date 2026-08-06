import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CncfLandscapeDiscoverySource } from '../cncf-landscape-source.js';

const SAMPLE_LANDSCAPE_YML = `
landscape:
  - category:
    name: Provisioning
    subcategories:
      - subcategory:
        name: Automation & Configuration
        items:
          - item:
            name: Airship
            homepage_url: https://www.airshipit.org/
            project: sandbox
          - item:
            name: NoHomepage
`;

describe('CncfLandscapeDiscoverySource', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => SAMPLE_LANDSCAPE_YML });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts only items with both name and homepage_url, skipping the licensing-restricted crunchbase/twitter/logo fields', async () => {
    const source = new CncfLandscapeDiscoverySource();
    const result = await source.fetch(null);

    expect(result.tuples).toHaveLength(1);
    expect(result.tuples[0]).toMatchObject({
      name: 'Airship',
      url: 'https://www.airshipit.org/',
      sourceAuthorityScore: source.defaultAuthorityScore,
    });
    expect(result.tuples[0]?.crawlMetadata).toEqual({ landscapeProject: 'sandbox' });
    expect(result.hasMore).toBe(false);
  });

  it('paginates by item index once the corpus exceeds one page', async () => {
    const source = new CncfLandscapeDiscoverySource();
    const cursor = { itemIndex: 2 };
    const result = await source.fetch(cursor);

    expect(result.tuples).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});
