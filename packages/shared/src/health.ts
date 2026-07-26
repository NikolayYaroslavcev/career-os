export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: Record<string, HealthCheck>;
  uptime: number;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

export async function runHealthChecks(
  checks: Record<string, () => Promise<boolean>>,
): Promise<HealthCheckResult> {
  const results: Record<string, HealthCheck> = {};
  const startTime = Date.now();

  for (const [name, check] of Object.entries(checks)) {
    const checkStart = Date.now();
    try {
      const isHealthy = await check();
      results[name] = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        latencyMs: Date.now() - checkStart,
      };
    } catch (error) {
      results[name] = {
        status: 'unhealthy',
        latencyMs: Date.now() - checkStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  const allHealthy = Object.values(results).every((r) => r.status === 'healthy');

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: results,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };
}
