import { describe, it, expect } from 'vitest';
import { runHealthChecks } from './health.js';

describe('Health Checks', () => {
  it('should return healthy when all checks pass', async () => {
    const result = await runHealthChecks({
      test: async () => true,
    });

    expect(result.status).toBe('healthy');
    expect(result.checks['test']?.status).toBe('healthy');
    expect(result.checks['test']?.latencyMs).toBeDefined();
  });

  it('should return unhealthy when any check fails', async () => {
    const result = await runHealthChecks({
      passing: async () => true,
      failing: async () => false,
    });

    expect(result.status).toBe('unhealthy');
    expect(result.checks['passing']?.status).toBe('healthy');
    expect(result.checks['failing']?.status).toBe('unhealthy');
  });

  it('should handle check errors gracefully', async () => {
    const result = await runHealthChecks({
      error: async () => {
        throw new Error('Test error');
      },
    });

    expect(result.status).toBe('unhealthy');
    expect(result.checks['error']?.status).toBe('unhealthy');
    expect(result.checks['error']?.error).toBe('Test error');
  });

  it('should include timestamp and uptime', async () => {
    const result = await runHealthChecks({
      test: async () => true,
    });

    expect(result.timestamp).toBeDefined();
    expect(typeof result.uptime).toBe('number');
  });
});
