import { describe, it, expect } from 'vitest';
import { createLinkedInProvider, LINKEDIN_PROVIDER_INFO, LINKEDIN_PROVIDER_CAPABILITIES } from '../linkedin-provider.js';
import { NoopLogger } from '../../../observability/logger.js';
import { InMemoryMetricsCollector } from '../../../observability/metrics.js';
import { InMemoryTracer } from '../../../observability/tracer.js';

function createTestProvider() {
  return createLinkedInProvider({
    logger: new NoopLogger(),
    metrics: new InMemoryMetricsCollector(),
    tracer: new InMemoryTracer(),
  });
}

describe('LinkedInProvider', () => {
  describe('LINKEDIN_PROVIDER_INFO', () => {
    it('should have correct provider id', () => {
      expect(LINKEDIN_PROVIDER_INFO.id).toBe('linkedin');
    });

    it('should have correct provider name', () => {
      expect(LINKEDIN_PROVIDER_INFO.name).toBe('LinkedIn');
    });

    it('should have version', () => {
      expect(LINKEDIN_PROVIDER_INFO.version).toBe('1.0.0');
    });

    it('should support multiple countries', () => {
      expect(LINKEDIN_PROVIDER_INFO.supportedCountries).toContain('US');
      expect(LINKEDIN_PROVIDER_INFO.supportedCountries).toContain('GB');
      expect(LINKEDIN_PROVIDER_INFO.supportedCountries).toContain('DE');
      expect(LINKEDIN_PROVIDER_INFO.supportedCountries.length).toBeGreaterThan(5);
    });

    it('should support English language', () => {
      expect(LINKEDIN_PROVIDER_INFO.supportedLanguages).toContain('en');
    });

    it('should not require authentication', () => {
      expect(LINKEDIN_PROVIDER_INFO.auth.type).toBe('none');
      expect(LINKEDIN_PROVIDER_INFO.auth.requiresApiKey).toBe(false);
      expect(LINKEDIN_PROVIDER_INFO.auth.requiresOAuth).toBe(false);
    });

    it('should support remote', () => {
      expect(LINKEDIN_PROVIDER_INFO.supportsRemote).toBe(true);
    });

    it('should have correct base URL', () => {
      expect(LINKEDIN_PROVIDER_INFO.baseUrl).toBe('https://www.linkedin.com');
    });
  });

  describe('LINKEDIN_PROVIDER_CAPABILITIES', () => {
    it('should support search', () => {
      expect(LINKEDIN_PROVIDER_CAPABILITIES.search.supported).toBe(true);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.search.supportsKeyword).toBe(true);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.search.supportsLocation).toBe(true);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.search.supportsTechnology).toBe(true);
    });

    it('should use offset pagination strategy', () => {
      expect(LINKEDIN_PROVIDER_CAPABILITIES.pagination.strategy).toBe('offset');
      expect(LINKEDIN_PROVIDER_CAPABILITIES.pagination.maxPageSize).toBe(25);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.pagination.defaultPageSize).toBe(25);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.pagination.maxTotalResults).toBe(1000);
    });

    it('should support incremental and full sync', () => {
      expect(LINKEDIN_PROVIDER_CAPABILITIES.sync.incremental).toBe(true);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.sync.fullSync).toBe(true);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.sync.minSyncIntervalMs).toBe(4 * 60 * 60 * 1000);
    });

    it('should support remote filter but not salary filter', () => {
      expect(LINKEDIN_PROVIDER_CAPABILITIES.filtering.remoteFilter).toBe(true);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.filtering.salaryFilter).toBe(false);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.filtering.technologyFilter).toBe(true);
    });

    it('should have rate limits configured', () => {
      expect(LINKEDIN_PROVIDER_CAPABILITIES.rateLimits.perMinute).toBe(30);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.rateLimits.providesHeaders).toBe(false);
    });

    it('should not provide full description or salary data', () => {
      expect(LINKEDIN_PROVIDER_CAPABILITIES.characteristics.fullDescription).toBe(false);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.characteristics.salaryData).toBe(false);
      expect(LINKEDIN_PROVIDER_CAPABILITIES.characteristics.companyDetails).toBe(false);
    });
  });

  describe('createLinkedInProvider', () => {
    it('should return a DefaultProviderJob instance', () => {
      const provider = createTestProvider();
      expect(provider).toBeDefined();
      expect(provider.info).toBeDefined();
      expect(provider.capabilities).toBeDefined();
      expect(provider.fetcher).toBeDefined();
      expect(provider.mapper).toBeDefined();
      expect(provider.normalizer).toBeDefined();
      expect(provider.syncStrategy).toBeDefined();
    });

    it('should use LINKEDIN_PROVIDER_INFO', () => {
      const provider = createTestProvider();
      expect(provider.info.id).toBe('linkedin');
      expect(provider.info.name).toBe('LinkedIn');
    });

    it('should use LINKEDIN_PROVIDER_CAPABILITIES', () => {
      const provider = createTestProvider();
      expect(provider.capabilities.search.supported).toBe(true);
      expect(provider.capabilities.pagination.strategy).toBe('offset');
    });

    it('should accept custom base URL', () => {
      const provider = createLinkedInProvider({
        baseUrl: 'https://custom.linkedin.com',
        logger: new NoopLogger(),
        metrics: new InMemoryMetricsCollector(),
        tracer: new InMemoryTracer(),
      });
      expect(provider).toBeDefined();
    });

    it('should accept custom rate limit', () => {
      const provider = createLinkedInProvider({
        rateLimitMs: 5000,
        logger: new NoopLogger(),
        metrics: new InMemoryMetricsCollector(),
        tracer: new InMemoryTracer(),
      });
      expect(provider).toBeDefined();
    });
  });
});
