import { defineConfig, devices } from '@playwright/test';

// Use a non-default dev port to reduce EADDRINUSE collisions on contributor machines.
const PORT = process.env.PORT || '3100';
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const REPO_ROOT = __dirname;

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
  webServer: {
    // Use npm to ensure the dev server runs with the repo's intended dependency resolution.
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT,
      MOCK_STRIPE: '1',
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
