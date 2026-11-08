import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: 'list',
  outputDir: '/tmp/homelab-schedule-playwright-results',
  use: { baseURL: 'http://127.0.0.1:15173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'python3 tests/api_server.py',
      url: 'http://127.0.0.1:18003/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 15173 --strictPort',
      url: 'http://127.0.0.1:15173',
      env: { SCHEDULE_DEV_API_URL: 'http://127.0.0.1:18003' },
      reuseExistingServer: false,
    },
  ],
});
