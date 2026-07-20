import { describe, it, expect } from 'vitest';
import { AIProviderHealthMonitor } from '../resilience/health-monitor.js';

describe('AIProviderHealthMonitor', () => {
  it('treats an unseen provider as available', () => {
    const monitor = new AIProviderHealthMonitor();
    expect(monitor.isAvailable('unknown')).toBe(true);
    expect(monitor.getStatus('unknown')).toBeUndefined();
  });

  it('stays available below the unhealthy threshold', () => {
    const monitor = new AIProviderHealthMonitor({ unhealthyThreshold: 3, recoveryAfterMs: 30_000, latencyWindowSize: 10 });
    monitor.recordFailure('p');
    monitor.recordFailure('p');

    expect(monitor.isAvailable('p')).toBe(true);
    expect(monitor.getStatus('p')?.state).toBe('healthy');
    expect(monitor.getStatus('p')?.consecutiveFailures).toBe(2);
  });

  it('becomes unavailable once consecutive failures reach the threshold', () => {
    const monitor = new AIProviderHealthMonitor({ unhealthyThreshold: 3, recoveryAfterMs: 30_000, latencyWindowSize: 10 });
    monitor.recordFailure('p');
    monitor.recordFailure('p');
    monitor.recordFailure('p');

    expect(monitor.isAvailable('p')).toBe(false);
    expect(monitor.getStatus('p')?.state).toBe('unhealthy');
  });

  it('recovers (half-open) after recoveryAfterMs has elapsed', () => {
    const monitor = new AIProviderHealthMonitor({ unhealthyThreshold: 1, recoveryAfterMs: 10, latencyWindowSize: 10 });
    monitor.recordFailure('p');
    expect(monitor.isAvailable('p')).toBe(false);

    const start = Date.now();
    while (Date.now() - start < 15) {
      // busy-wait a few ms — recoveryAfterMs is tiny specifically so this stays fast.
    }

    expect(monitor.isAvailable('p')).toBe(true);
  });

  it('resets consecutive failures and unhealthy state on success', () => {
    const monitor = new AIProviderHealthMonitor({ unhealthyThreshold: 2, recoveryAfterMs: 30_000, latencyWindowSize: 10 });
    monitor.recordFailure('p');
    monitor.recordFailure('p');
    expect(monitor.isAvailable('p')).toBe(false);

    monitor.recordSuccess('p', 120);

    expect(monitor.isAvailable('p')).toBe(true);
    expect(monitor.getStatus('p')?.consecutiveFailures).toBe(0);
  });

  it('tracks a rolling average latency capped at the configured window size', () => {
    const monitor = new AIProviderHealthMonitor({ unhealthyThreshold: 10, recoveryAfterMs: 30_000, latencyWindowSize: 3 });
    monitor.recordSuccess('p', 100);
    monitor.recordSuccess('p', 200);
    monitor.recordSuccess('p', 300);
    monitor.recordSuccess('p', 400); // pushes 100 out of the window

    expect(monitor.getStatus('p')?.avgLatencyMs).toBe((200 + 300 + 400) / 3);
  });

  it('tracks providers independently', () => {
    const monitor = new AIProviderHealthMonitor({ unhealthyThreshold: 1, recoveryAfterMs: 30_000, latencyWindowSize: 10 });
    monitor.recordFailure('a');

    expect(monitor.isAvailable('a')).toBe(false);
    expect(monitor.isAvailable('b')).toBe(true);
  });
});
