import type { AtsType } from '../domain/value-objects/ats-type.js';
import { assertSafeUrl } from '../utils/url-safety.js';

export interface DiscoveryResult {
  atsType: AtsType | null;
  careerUrl: string | null;
  apiEndpoint: string | null;
  jsonLd: unknown[];
  rss: string | null;
  sitemap: string | null;
  metadata: Record<string, unknown>;
}

export class CompanyDiscoveryService {
  async discover(url: string): Promise<DiscoveryResult> {
    try {
      await assertSafeUrl(url);

      const response = await fetch(url, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; CareerOS/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }

      const html = await response.text();
      const baseUrl = new URL(url).origin;

      const atsType = this.detectAtsType(html, url);
      const careerUrl = this.findCareersPage(html, url);
      const apiEndpoint = this.detectApiEndpoint(html, url, atsType);
      const jsonLd = this.extractJsonLd(html);
      const rss = this.detectRssFeed(html, baseUrl);
      const sitemap = this.detectSitemap(baseUrl);
      const metadata = this.extractMetadata(html, atsType);

      return {
        atsType,
        careerUrl: careerUrl || url,
        apiEndpoint,
        jsonLd,
        rss,
        sitemap,
        metadata,
      };
    } catch {
      return {
        atsType: null,
        careerUrl: null,
        apiEndpoint: null,
        jsonLd: [],
        rss: null,
        sitemap: null,
        metadata: {},
      };
    }
  }

  private detectAtsType(html: string, url: string): AtsType | null {
    // Greenhouse
    if (url.includes('greenhouse.io') || html.includes('greenhouse.io') || html.includes('boards-api.greenhouse.io')) {
      return 'GREENHOUSE';
    }

    // Lever
    if (url.includes('lever.co') || html.includes('lever.co') || html.includes('api.lever.co')) {
      return 'LEVER';
    }

    // Ashby
    if (url.includes('ashbyhq.com') || html.includes('ashbyhq.com') || html.includes('jobs.ashbyhq.com')) {
      return 'ASHBY';
    }

    // Workday
    if (url.includes('myworkdayjobs.com') || html.includes('myworkdayjobs.com') || html.includes('workday')) {
      return 'WORKDAY';
    }

    // Teamtailor
    if (url.includes('teamtailor.com') || html.includes('teamtailor.com') || html.includes('api.teamtailor.com')) {
      return 'TEAMTAILOR';
    }

    // SmartRecruiters
    if (html.includes('smartrecruiters.com') || html.includes('smartrecruiters')) {
      return 'SMARTRECRUITERS';
    }

    // Recruitee
    if (html.includes('recruitee.com') || html.includes('recruitee')) {
      return 'RECRUITEE';
    }

    // Personio
    if (html.includes('personio') || html.includes('career.personio.de')) {
      return 'PERSONIO';
    }

    // BambooHR
    if (html.includes('bamboohr.com') || html.includes('bamboohr')) {
      return 'BAMBOOHR';
    }

    // Check for JSON-LD JobPosting
    const jsonLd = this.extractJsonLd(html);
    if (jsonLd.some((item: unknown) => typeof item === 'object' && item !== null && (item as Record<string, unknown>)['@type'] === 'JobPosting')) {
      return 'JSON_LD';
    }

    // Default to custom HTML scraping
    return 'CUSTOM_HTML';
  }

  private findCareersPage(html: string, url: string): string | null {
    const patterns = [
      /href=["']([^"']*\/careers?[^"']*)["']/gi,
      /href=["']([^"']*\/jobs?[^"']*)["']/gi,
      /href=["']([^"']*\/positions?[^"']*)["']/gi,
      /href=["']([^"']*\/openings?[^"']*)["']/gi,
      /href=["']([^"']*\/hiring[^"']*)["']/gi,
    ];

    const baseUrl = new URL(url).origin;

    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match && match[1]) {
        const href = match[1];
        if (href.startsWith('http')) return href;
        if (href.startsWith('/')) return `${baseUrl}${href}`;
      }
    }

    return null;
  }

  private detectApiEndpoint(html: string, url: string, atsType: AtsType | null): string | null {
    switch (atsType) {
      case 'GREENHOUSE': {
        const boardMatch = html.match(/boards-api\.greenhouse\.io\/v1\/boards\/([^/]+)/);
        if (boardMatch) {
          return `https://boards-api.greenhouse.io/v1/boards/${boardMatch[1]}/jobs`;
        }
        break;
      }
      case 'LEVER': {
        const companyMatch = html.match(/api\.lever\.co\/v0\/postings\/([^/]+)/);
        if (companyMatch) {
          return `https://api.lever.co/v0/postings/${companyMatch[1]}`;
        }
        break;
      }
      case 'ASHBY': {
        return 'https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams';
      }
      case 'WORKDAY': {
        const tenantMatch = html.match(/([a-z0-9]+)\.wd[0-9]+\.myworkdayjobs\.com/i);
        if (tenantMatch) {
          return `https://${tenantMatch[1]}.myworkdayjobs.com`;
        }
        break;
      }
      case 'TEAMTAILOR': {
        return 'https://api.teamtailor.com/v1';
      }
    }

    return null;
  }

  private extractJsonLd(html: string): unknown[] {
    const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const results: unknown[] = [];

    let match;
    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const matchContent = match[1];
        if (!matchContent) continue;
        const data = JSON.parse(matchContent);
        if (Array.isArray(data)) {
          results.push(...data);
        } else {
          results.push(data);
        }
      } catch {
        // Skip invalid JSON-LD
      }
    }

    return results;
  }

  private detectRssFeed(html: string, baseUrl: string): string | null {
    const rssPatterns = [
      /<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/gi,
      /<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/gi,
    ];

    for (const pattern of rssPatterns) {
      const match = pattern.exec(html);
      if (match && match[1]) {
        const href = match[1];
        if (href.startsWith('http')) return href;
        if (href.startsWith('/')) return `${baseUrl}${href}`;
      }
    }

    return null;
  }

  private detectSitemap(baseUrl: string): string | null {
    return `${baseUrl}/sitemap.xml`;
  }

  private extractMetadata(html: string, atsType: AtsType | null): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    switch (atsType) {
      case 'GREENHOUSE': {
        const boardMatch = html.match(/boards-api\.greenhouse\.io\/v1\/boards\/([^/]+)/);
        if (boardMatch) {
          metadata.boardToken = boardMatch[1];
        }
        break;
      }
      case 'LEVER': {
        const companyMatch = html.match(/api\.lever\.co\/v0\/postings\/([^/]+)/);
        if (companyMatch) {
          metadata.company = companyMatch[1];
        }
        break;
      }
      case 'ASHBY': {
        metadata.jobBoardName = 'default';
        break;
      }
      case 'WORKDAY': {
        const tenantMatch = html.match(/([a-z0-9]+)\.wd([0-9]+)\.myworkdayjobs\.com/i);
        if (tenantMatch) {
          metadata.tenant = tenantMatch[1];
          metadata.site = tenantMatch[2];
        }
        break;
      }
    }

    return metadata;
  }
}
