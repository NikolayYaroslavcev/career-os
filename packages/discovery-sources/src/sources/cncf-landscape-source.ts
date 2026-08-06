import { parse as parseYaml } from 'yaml';
import type { DiscoveryCursor, DiscoveryFetchResult, DiscoverySourceFetcher, RawCompanyTuple } from '../types.js';
import { retryFetch } from '../http/retry-fetch.js';

const USER_AGENT = 'CareerOS-CompanyDiscovery/1.0 (+https://careeros.io/bot)';
const DEFAULT_LANDSCAPE_URL = 'https://raw.githubusercontent.com/cncf/landscape/master/landscape.yml';

/**
 * Live-verified shape (2026-07-30, parsed with the `yaml` library against
 * the real file): each list entry is a FLAT mapping where `category`/
 * `subcategory`/`item` is a null marker key, and `name`/`homepage_url`/etc.
 * are siblings on the *same* object — not nested under that marker key.
 */
interface LandscapeItem {
  readonly item?: null;
  readonly name?: string;
  readonly homepage_url?: string;
  readonly project?: string;
}

interface LandscapeSubcategory {
  readonly subcategory?: null;
  readonly name?: string;
  readonly items?: readonly LandscapeItem[];
}

interface LandscapeCategory {
  readonly category?: null;
  readonly name?: string;
  readonly subcategories?: readonly LandscapeSubcategory[];
}

interface LandscapeDocument {
  readonly landscape?: readonly LandscapeCategory[];
}

interface CncfCursor extends DiscoveryCursor {
  readonly itemIndex: number;
}

/**
 * ADR-035 §1 priority 8: CNCF landscape.yml. Live-verified (2026-07-30)
 * against raw.githubusercontent.com/cncf/landscape/master/landscape.yml —
 * a real, currently-maintained YAML file, `landscape -> category[] ->
 * subcategories[] -> items[] -> item { name, homepage_url, ... }`.
 *
 * Per research/free-provider-expansion/REPORT.md §4.4's licensing caveat
 * (already cited in ADR-035 §1: "one-time... curation of company *names*
 * [not] the full Crunchbase-blended dataset"), this extracts only `name`
 * and `homepage_url` — never the file's `crunchbase`/`twitter`/logo fields.
 * The whole file is small enough (~a few MB of YAML) to parse in one fetch,
 * so its cursor is a flat item index rather than a byte-range watermark.
 */
export class CncfLandscapeDiscoverySource implements DiscoverySourceFetcher {
  readonly id = 'cncf_landscape' as const;
  /** ADR §2 "source authority": a named, hand-curated foundation membership list — same tier ADR §2 calls out explicitly ("YC/CNCF... score higher than a bare Common Crawl domain hit"). */
  readonly defaultAuthorityScore = 70;

  constructor(private readonly landscapeUrl: string = DEFAULT_LANDSCAPE_URL) {}

  async fetch(cursor: DiscoveryCursor | null): Promise<DiscoveryFetchResult> {
    const state = (cursor as CncfCursor | null) ?? { itemIndex: 0 };

    const items = await this.loadItems();
    if (state.itemIndex >= items.length) {
      return { tuples: [], cursor: state, hasMore: false };
    }

    const pageSize = 200;
    const slice = items.slice(state.itemIndex, state.itemIndex + pageSize);
    const tuples: RawCompanyTuple[] = [];

    for (const item of slice) {
      if (!item.name || !item.homepage_url) continue;
      tuples.push({
        name: item.name,
        url: item.homepage_url,
        sourceAuthorityScore: this.defaultAuthorityScore,
        crawlMetadata: { landscapeProject: item.project },
      });
    }

    const nextIndex = state.itemIndex + slice.length;
    return { tuples, cursor: { itemIndex: nextIndex }, hasMore: nextIndex < items.length };
  }

  private async loadItems(): Promise<LandscapeItem[]> {
    const response = await retryFetch(this.landscapeUrl, { headers: { 'User-Agent': USER_AGENT } });
    const text = await response.text();
    const doc = parseYaml(text) as LandscapeDocument;

    const items: LandscapeItem[] = [];
    for (const category of doc.landscape ?? []) {
      for (const subcategory of category.subcategories ?? []) {
        for (const item of subcategory.items ?? []) {
          items.push(item);
        }
      }
    }
    return items;
  }
}
