import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || '3000';
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
const REAL_NODE = process.env.NODE_REAL_BIN || process.env.NVM_BIN?.replace(/\/$/, '') + '/node' || '/home/thomas/.nvm/versions/node/v22.22.2/bin/node';

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
    command: `PORT=${PORT} MOCK_STRIPE=1 NEXT_PUBLIC_APP_URL=${BASE_URL} ${REAL_NODE} ./node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
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
