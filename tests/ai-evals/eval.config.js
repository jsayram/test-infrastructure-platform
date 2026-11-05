import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const id = process.env.AI_EVAL_RUN;
if (!/^[a-f0-9-]{36}$/.test(id ?? '')) throw new Error('Use the eval CLI to create a fresh run directory');

export default defineConfig({
  testDir: fileURLToPath(new URL('../../.local/ai-evals/runs/' + id, import.meta.url)),
  testMatch: 'candidate.spec.js',
  outputDir: fileURLToPath(new URL('../../.local/ai-evals/runs/' + id + '/output', import.meta.url)),
  workers: 1,
  retries: 0,
  timeout: 12000,
  expect: { timeout: 2000 },
  reporter: 'json',
  use: { baseURL: 'http://127.0.0.1:8080', serviceWorkers: 'block' },
});
