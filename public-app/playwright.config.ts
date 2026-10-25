import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  timeout: 30000,
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run start -- --port 3100',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: true,
        timeout: 30000,
      },
});
