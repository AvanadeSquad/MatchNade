import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test', testMatch: '**/*.spec.js', fullyParallel: true, workers: 3,
  reporter: 'list', timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: process.platform === 'win32' ? 'npm.cmd run dev' : 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30000 },
});
