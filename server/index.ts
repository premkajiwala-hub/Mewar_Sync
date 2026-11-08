import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig } from './config.ts';
import { createApp } from './app.ts';
import { createFirebaseTokenVerifier } from './auth.ts';
import { createFirestoreRoleLookup } from './roles.ts';
import { createGeminiProvider } from './ai/gemini.ts';
import { createMockProvider } from './ai/mock.ts';
import { logger } from './logger.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Same precedence as Vite: .env.local overrides .env; real env vars override both.
for (const file of ['.env.local', '.env']) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) process.loadEnvFile(full);
}

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    logger.error('invalid_configuration', { error: err.message });
    process.exit(1);
  }
  throw err;
}

const ai = config.aiProvider === 'gemini'
  ? createGeminiProvider(config)
  : config.aiProvider === 'mock' ? createMockProvider() : null;

if (!ai) logger.warn('ai_disabled', { reason: 'GEMINI_API_KEY is not set; AI endpoints will return 503.' });
if (config.aiProvider === 'mock') logger.warn('ai_mock_mode', { reason: 'Using the deterministic demo AI provider (development only).' });

const app = createApp({
  config,
  verifyToken: createFirebaseTokenVerifier(config),
  lookupRole: createFirestoreRoleLookup(config),
  ai,
  staticDir: process.env.SERVE_STATIC === 'false' ? undefined : path.join(root, 'dist'),
});

const server = app.listen(config.port, () => {
  logger.info('server_started', { port: config.port, ai: config.aiProvider, production: config.isProduction });
});

server.requestTimeout = 90_000;
server.headersTimeout = 30_000;

function shutdown(signal: string) {
  logger.info('server_stopping', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
