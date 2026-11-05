import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const reportPath = process.argv[2] ?? 'test-results/playwright.json';
const historyPath = process.argv[3] ?? '.local/playwright/history.json';
const dashboardPath = process.argv[4] ?? '.local/playwright/dashboard.md';
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const { expected, unexpected, flaky, skipped, startTime, duration } = report.stats;
if (![expected, unexpected, flaky, skipped, duration].every(Number.isFinite) ||
    Number.isNaN(Date.parse(startTime))) {
  throw new Error('Invalid Playwright run statistics');
}

function retries(sections) {
  return sections.reduce((count, section) => {
    for (const spec of section.specs ?? []) {
      for (const test of spec.tests) count += test.results.filter((result) => result.retry > 0).length;
    }
    return count + retries(section.suites ?? []);
  }, 0);
}

let runs;
try {
  runs = JSON.parse(await readFile(historyPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  runs = [];
}
const latest = {
  startTime, source: report.config.metadata?.source === 'GitHub Actions' ? 'GitHub Actions' : 'Local',
  total: expected + unexpected + flaky + skipped,
  passed: expected, failed: unexpected, flaky, skipped,
  retryAttempts: retries(report.suites), duration,
};
runs = runs.filter((run) => run.startTime !== startTime).concat(latest)
  .sort((first, second) => first.startTime.localeCompare(second.startTime));
const ci = runs.filter((run) => run.source === 'GitHub Actions');
const average = ci.length
  ? (ci.reduce((sum, run) => sum + run.duration, 0) / ci.length / 1000).toFixed(2) + ' s'
  : 'Pending first hosted run';

const dashboard = [
  '# Playwright run history',
  '',
  'Average hosted Playwright runtime per run: ' + average + '. Runtime covers the Playwright runner only.',
  '',
  '| Started (UTC) | Source | Total | Passed | Failed | Flaky | Skipped | Retry attempts | Playwright runtime |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...runs.map((run) => '| ' + [
    run.startTime, run.source, run.total, run.passed, run.failed, run.flaky, run.skipped,
    run.retryAttempts, (run.duration / 1000).toFixed(2) + ' s',
  ].join(' | ') + ' |'),
  '',
].join('\n');

await mkdir(dirname(historyPath), { recursive: true });
await mkdir(dirname(dashboardPath), { recursive: true });
await writeFile(historyPath, JSON.stringify(runs, null, 2) + '\n');
await writeFile(dashboardPath, dashboard);
console.log(dashboard);
