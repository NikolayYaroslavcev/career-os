import { createServer, type Server } from 'node:http';
import type { Worker } from 'bullmq';
import { runHealthChecks } from '@careeros/shared';
import { checkRedisHealth } from '@careeros/shared';
import { checkDatabaseHealth } from '@careeros/database';

/**
 * The worker process has no other HTTP surface (it only consumes BullMQ
 * queues), so this is its sole health signal for `docker compose` healthchecks
 * and `depends_on: condition: service_healthy`. Mirrors apps/backend's
 * /health and /live shape so both apps are checked the same way.
 */
export function startHealthServer(port: number, workers: readonly Worker[]): Server {
  const server = createServer((req, res) => {
    if (req.url === '/live') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'alive' }));
      return;
    }

    if (req.url === '/health') {
      void runHealthChecks({
        database: checkDatabaseHealth,
        redis: checkRedisHealth,
        workers: async () => workers.length > 0 && workers.every((w) => w.isRunning()),
      }).then((health) => {
        res.writeHead(health.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port);
  return server;
}
