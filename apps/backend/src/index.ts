import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { buildApp } from './app.js';
import { createAIProvider } from './container.js';
import { AIProviderHealthMonitor } from '@careeros/ai';
import { connectDatabase, disconnectDatabase } from '@careeros/database';
import { getRedis, disconnectRedis } from '@careeros/shared';
import { loadConfig } from '@careeros/shared';

const start = async (): Promise<void> => {
  const config = loadConfig();

  // AI startup diagnostics — a throwaway health monitor is fine here since
  // this provider instance is only used for this log line, not for serving
  // requests (buildApp() builds its own container, with its own monitor,
  // which is what the diagnostics routes actually read).
  const aiProvider = createAIProvider(config, new AIProviderHealthMonitor());
  console.log(`AI Provider: ${aiProvider.name}`);
  console.log(`Model: ${aiProvider.defaultModel}`);
  console.log(`Configured: ${aiProvider.validateConfig()}`);

  // Connect to database
  await connectDatabase();

  // Connect to Redis
  getRedis();

  const app = await buildApp();

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...');
    await app.close();
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    const port = config.PORT;
    const host = config.HOST;

    await app.listen({ port, host });
    console.log(`Backend running on http://${host}:${port}`);
    console.log(`Environment: ${config.NODE_ENV}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
