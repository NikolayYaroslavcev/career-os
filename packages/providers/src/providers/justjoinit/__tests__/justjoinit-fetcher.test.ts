import { describe, it, expect } from 'vitest';
import { parseSitemapIndex, parseSitemapEntries, parseJobPostingJsonLd, extractSourceId } from '../justjoinit-fetcher.js';

describe('parseSitemapIndex', () => {
  it('extracts child sitemap URLs from a sitemapindex', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://justjoin.it/sitemaps/active-jobs/part0.xml</loc></sitemap>
      </sitemapindex>`;
    expect(parseSitemapIndex(xml)).toEqual(['https://justjoin.it/sitemaps/active-jobs/part0.xml']);
  });
});

describe('parseSitemapEntries', () => {
  it('extracts url + lastmod pairs, skipping entries missing either field', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://justjoin.it/job-offer/acme-senior-react-developer-warszawa-react</loc>
          <lastmod>2026-08-22T07:00:39+00:00</lastmod>
          <changefreq>daily</changefreq>
        </url>
        <url>
          <loc>https://justjoin.it/job-offer/no-lastmod</loc>
        </url>
      </urlset>`;
    const entries = parseSitemapEntries(xml);
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry?.url).toBe('https://justjoin.it/job-offer/acme-senior-react-developer-warszawa-react');
    expect(entry?.lastmod.toISOString()).toBe('2026-08-22T07:00:39.000Z');
  });

  it('returns an empty array for a urlset with no entries', () => {
    expect(parseSitemapEntries('<urlset></urlset>')).toEqual([]);
  });
});

describe('parseJobPostingJsonLd', () => {
  it('extracts the JobPosting JSON-LD block from a job page', () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Senior React Developer","hiringOrganization":{"name":"Acme"},"jobLocation":{"address":{"addressLocality":"Warszawa","addressCountry":"PL"}},"employmentType":"FULL_TIME","jobLocationType":"TELECOMMUTE"}</script>
      </head><body></body></html>`;
    const jsonLd = parseJobPostingJsonLd(html);
    expect(jsonLd).not.toBeNull();
    expect(jsonLd?.title).toBe('Senior React Developer');
    expect(jsonLd?.hiringOrganization?.name).toBe('Acme');
    expect(jsonLd?.jobLocation?.address?.addressLocality).toBe('Warszawa');
  });

  it('returns null when no JobPosting JSON-LD block is present', () => {
    expect(parseJobPostingJsonLd('<html><body>no ld+json here</body></html>')).toBeNull();
  });

  it('returns null when the JSON-LD block is malformed', () => {
    const html = '<script type="application/ld+json">{not valid json</script>';
    expect(parseJobPostingJsonLd(html)).toBeNull();
  });
});

describe('extractSourceId', () => {
  it('extracts the URL slug as the stable source id', () => {
    expect(extractSourceId('https://justjoin.it/job-offer/acme-senior-react-developer-warszawa-react')).toBe('acme-senior-react-developer-warszawa-react');
  });

  it('handles a trailing slash', () => {
    expect(extractSourceId('https://justjoin.it/job-offer/acme-react-dev/')).toBe('acme-react-dev');
  });
});
