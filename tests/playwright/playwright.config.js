import { defineConfig } from '@playwright/test';

const baseURL = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:8080');
if (baseURL.protocol !== 'http:' || baseURL.hostname !== '127.0.0.1' ||
    baseURL.username || baseURL.password || baseURL.pathname !== '/' || baseURL.search || baseURL.hash) {
  throw new Error('Browser tests require an HTTP loopback origin at 127.0.0.1');
}

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  metadata: { source: process.env.GITHUB_ACTIONS === 'true' ? 'GitHub Actions' : 'Local' },
  outputDir: '../../test-results/playwright',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../playwright-report', open: 'never' }],
    ['json', { outputFile: '../../test-results/playwright.json' }],
  ],
  use: {
    baseURL: baseURL.origin,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
