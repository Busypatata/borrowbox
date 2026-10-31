import { defineConfig, devices } from '@playwright/test';

const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://borrowbox:borrowbox@localhost:5432/borrowbox_test';
if (!/test/i.test(new URL(DB).pathname)) throw new Error('E2E must run against a database whose name contains "test".');

// Optional: point at an existing Chromium (e.g. when the preinstalled browser build differs from the Playwright version).
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', launchOptions: { executablePath }, screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: '../server',
      url: 'http://localhost:4000/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test', PORT: '4000', DATABASE_URL: DB, CLIENT_URL: 'http://localhost:5173',
        SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret', CSRF_SECRET: 'e2e-csrf-e2e-csrf-e2e-csrf-e2e-csrf',
        STORAGE_PROVIDER: 'local', DISABLE_RATE_LIMIT: 'true', LOG_LEVEL: 'silent',
      },
    },
    {
      command: 'npx vite --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_API_BASE_URL: 'http://localhost:4000/api/v1' },
    },
  ],
});
