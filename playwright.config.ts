import { defineConfig, devices } from '@playwright/test';

/*
 * End-to-end tests run the real app against the Firebase emulators (demo
 * project — never production) and the API server with the deterministic
 * mock AI provider.
 *
 *   npx playwright install chromium     # once, or set PW_CHANNEL=msedge|chrome
 *   npm run test:e2e
 */
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 4310);
const API_PORT = Number(process.env.E2E_API_PORT || 8788);
const isWin = process.platform === 'win32';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    channel: process.env.PW_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'npx firebase emulators:start --only auth,firestore --project demo-mewar-sync',
      url: 'http://127.0.0.1:8085',
      reuseExistingServer: true,
      timeout: 120_000,
      env: isWin ? { JAVA_TOOL_OPTIONS: `-Djdk.net.unixdomain.tmpdir=${process.cwd()}\\.emulator-tmp` } : {},
    },
    {
      command: 'node server/index.ts',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: true,
      env: {
        PORT: String(API_PORT),
        FIREBASE_PROJECT_ID: 'demo-mewar-sync',
        AI_PROVIDER: 'mock',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
        SERVE_STATIC: 'false',
        LOG_SILENT: 'true',
      },
    },
    {
      command: `npx vite --mode e2e --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: true,
      env: { API_PORT: String(API_PORT) },
    },
  ],
});
