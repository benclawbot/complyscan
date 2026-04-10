import { defineConfig, devices } from '@playwright/test';

// Use a non-default dev port to reduce EADDRINUSE collisions on contributor machines.
const PORT = process.env.PORT || '3100';
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const REPO_ROOT = __dirname;

const useExternalServer = process.env.PW_EXTERNAL_SERVER === '1';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'tests/.playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: useExternalServer ? undefined : {
    // Force a fresh mocked server per run to avoid stale/non-mock processes on the same port.
    command: `node ./node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT,
      MOCK_STRIPE: '1',
      MOCK_SCAN: '1',
      NEXT_PUBLIC_APP_URL: BASE_URL,
      BASE_URL,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],
});



