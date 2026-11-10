import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'line',
  use: {
    baseURL: process.env.MONITOR_URL ?? 'http://localhost:8080',
    browserName: 'chromium',
    timezoneId: 'UTC',
    launchOptions: process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : undefined,
  },
});
