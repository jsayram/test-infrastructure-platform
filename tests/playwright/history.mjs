import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const reportPath = process.argv[2] ?? 'test-results/playwright.json';
const historyPath = process.argv[3] ?? '.local/playwright/history.json';
const dashboardPath = process.argv[4] ?? '.local/playwright/dashboard.md';
const workflowPath = process.argv[5];
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

function workflowMetrics(run) {
  const metadata = report.config.metadata;
  const url = new URL(run.url);
  const runId = /^\/[^/]+\/[^/]+\/actions\/runs\/(\d+)$/.exec(url.pathname)?.[1];
  if (metadata?.source !== 'GitHub Actions' ||
      metadata.ci?.buildHref !== run.url || metadata.ci?.commitHash !== run.headSha ||
      !/^[a-f0-9]{40}$/.test(run.headSha) || !Number.isSafeInteger(run.databaseId) ||
      runId !== String(run.databaseId) || url.protocol !== 'https:' || url.host !== 'github.com' ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Workflow metadata does not match this hosted Playwright report');
  }

  const started = Date.parse(run.startedAt);
  const completed = Date.parse(run.updatedAt);
  const reportStarted = Date.parse(startTime);
  if (run.status !== 'completed' || typeof run.conclusion !== 'string' || !run.conclusion ||
      !Number.isFinite(started) || !Number.isFinite(completed) ||
      started > reportStarted || completed < reportStarted + duration) {
    throw new Error('Workflow metadata must describe a completed run containing this Playwright execution');
  }

  return {
    databaseId: run.databaseId, url: run.url, headSha: run.headSha,
    startedAt: run.startedAt, updatedAt: run.updatedAt,
    status: run.status, conclusion: run.conclusion, duration: completed - started,
  };
}

let runs;
try {
  runs = JSON.parse(await readFile(historyPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  runs = [];
}
const previous = runs.find((run) => run.startTime === startTime);
const latest = {
  ...previous,
  startTime, source: report.config.metadata?.source === 'GitHub Actions' ? 'GitHub Actions' : 'Local',
  total: expected + unexpected + flaky + skipped,
  passed: expected, failed: unexpected, flaky, skipped,
  retryAttempts: retries(report.suites), duration,
};
if (workflowPath) {
  const run = JSON.parse(await readFile(workflowPath, 'utf8'));
  if (!Array.isArray(run.jobs) || !run.jobs.length || run.jobs.some((job) => job.status !== 'completed')) {
    throw new Error('Workflow metadata must include completed jobs from gh run view');
  }
  latest.workflow = workflowMetrics(run);
} else if (previous?.workflow) {
  latest.workflow = { ...previous.workflow, ...workflowMetrics(previous.workflow) };
}
runs = runs.filter((run) => run.startTime !== startTime).concat(latest)
  .sort((first, second) => first.startTime.localeCompare(second.startTime));
const ci = runs.filter((run) => run.source === 'GitHub Actions');
const average = ci.length
  ? (ci.reduce((sum, run) => sum + run.duration, 0) / ci.length / 1000).toFixed(2) + ' s'
  : 'Pending first hosted run';
const completed = [...new Map(
  ci.filter((run) => Number.isFinite(run.workflow?.duration))
    .sort((first, second) => Date.parse(first.workflow.updatedAt) - Date.parse(second.workflow.updatedAt))
    .map((run) => [run.workflow.databaseId, run]),
).values()];
const workflowAverage = completed.length
  ? (completed.reduce((sum, run) => sum + run.workflow.duration, 0) / completed.length / 1000).toFixed(2) + ' s'
  : 'Pending completed-run metadata import';

const dashboard = [
  '# Playwright run history',
  '',
  'Average hosted Playwright runtime per run: ' + average + '. Runtime covers the Playwright runner only.',
  '',
  'Average completed workflow elapsed time per run: ' + workflowAverage +
    ' (' + completed.length + ' imported workflow runs). Elapsed time is completed-run updatedAt minus startedAt, including setup, parallel jobs, and cleanup.',
  '',
  'The in-workflow artifact records runner time. Import completed gh run view metadata afterward to add full workflow elapsed time.',
  '',
  '| Started (UTC) | Source | Total | Passed | Failed | Flaky | Skipped | Retry attempts | Playwright runtime | Workflow elapsed | Workflow run |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ...runs.map((run) => '| ' + [
    run.startTime, run.source, run.total, run.passed, run.failed, run.flaky, run.skipped,
    run.retryAttempts, (run.duration / 1000).toFixed(2) + ' s',
    run.workflow ? (run.workflow.duration / 1000).toFixed(2) + ' s' :
      run.source === 'GitHub Actions' ? 'Pending import' : 'N/A',
    run.workflow ? '[' + run.workflow.databaseId + '](' + run.workflow.url + ')' : '',
  ].join(' | ') + ' |'),
  '',
].join('\n');

await mkdir(dirname(historyPath), { recursive: true });
await mkdir(dirname(dashboardPath), { recursive: true });
await writeFile(historyPath, JSON.stringify(runs, null, 2) + '\n');
await writeFile(dashboardPath, dashboard);
console.log(dashboard);
