import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const command = fileURLToPath(new URL('./history.mjs', import.meta.url));
const url = 'https://github.com/example/project/actions/runs/123';
const sha = 'a'.repeat(40);
const report = {
  config: { metadata: { source: 'GitHub Actions', ci: { buildHref: url, commitHash: sha } } },
  stats: {
    startTime: '2026-11-05T18:09:00.000Z', duration: 2000,
    expected: 4, unexpected: 0, flaky: 0, skipped: 0,
  },
  suites: [{ specs: [{ tests: [{ results: [{ retry: 0 }] }] }] }],
};
const workflow = {
  databaseId: 123, url, headSha: sha, status: 'completed', conclusion: 'success',
  startedAt: '2026-11-05T18:08:00Z', updatedAt: '2026-11-05T18:09:30Z',
  jobs: [{ status: 'completed' }],
};

async function scenario(t, rows = []) {
  const directory = await mkdtemp(join(tmpdir(), 'tip-report-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const history = join(directory, 'history.json');
  const dashboard = join(directory, 'dashboard.md');
  await writeFile(history, JSON.stringify(rows));
  return {
    directory, history, dashboard,
    async run(input = report, metadata) {
      const inputPath = join(directory, 'playwright.json');
      await writeFile(inputPath, JSON.stringify(input));
      const args = [command, inputPath, history, dashboard];
      if (metadata) {
        const metadataPath = join(directory, 'run.json');
        await writeFile(metadataPath, JSON.stringify(metadata));
        args.push(metadataPath);
      }
      return spawnSync(process.execPath, args, { encoding: 'utf8' });
    },
    rows: async () => JSON.parse(await readFile(history, 'utf8')),
  };
}

test('reports completed workflow elapsed time independently of Playwright runtime', async (t) => {
  const files = await scenario(t);
  const result = await files.run(report, workflow);
  assert.equal(result.status, 0, result.stderr);
  const [row] = await files.rows();
  assert.equal(row.duration, 2000);
  assert.equal(row.workflow.duration, 90000);
  assert.equal(row.workflow.databaseId, 123);
  assert.match(result.stdout, /Average hosted Playwright runtime per run: 2\.00 s/);
  assert.match(result.stdout, /Average completed workflow elapsed time per run: 90\.00 s/);
});

test('rejects workflow metadata for another run or commit without changing history', async (t) => {
  const files = await scenario(t);
  for (const change of [
    { databaseId: 456 },
    { url: url.replace('123', '456') },
    { headSha: 'b'.repeat(40) },
  ]) {
    const result = await files.run(report, { ...workflow, ...change });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match/);
    assert.deepEqual(await files.rows(), []);
  }
});

test('keeps local reports separate from hosted workflow provenance', async (t) => {
  const files = await scenario(t);
  for (const metadata of [{ source: 'Local' }, { source: 'GitHub Actions' }]) {
    const input = { ...report, config: { metadata } };
    assert.notEqual((await files.run(input, workflow)).status, 0);
  }
  const enterprise = url.replace('github.com', 'example.com');
  const input = { ...report, config: { metadata: {
    source: 'GitHub Actions', ci: { buildHref: enterprise, commitHash: sha },
  } } };
  assert.notEqual((await files.run(input, { ...workflow, url: enterprise })).status, 0);
  const result = await files.run({ ...report, config: { metadata: { source: 'Local' } } });
  assert.equal(result.status, 0, result.stderr);
  const [row] = await files.rows();
  assert.equal(row.source, 'Local');
  assert.equal(row.workflow, undefined);
  assert.match(result.stdout, /2\.00 s \| N\/A \|/);
  assert.match(result.stdout, /Pending completed-run metadata import/);
});

test('rejects nonterminal workflows, unfinished jobs, and inconsistent timestamps', async (t) => {
  const files = await scenario(t);
  for (const change of [
    { status: 'in_progress' },
    { conclusion: '' },
    { jobs: [{ status: 'in_progress' }] },
    { jobs: [] },
    { startedAt: 'invalid' },
    { updatedAt: '2026-11-05T18:08:30Z' },
    { startedAt: '2026-11-05T18:09:01Z' },
  ]) {
    assert.notEqual((await files.run(report, { ...workflow, ...change })).status, 0);
    assert.deepEqual(await files.rows(), []);
  }
});

test('preserves enriched history on reimport without run metadata', async (t) => {
  const files = await scenario(t);
  assert.equal((await files.run(report, workflow)).status, 0);
  const rows = await files.rows();
  rows[0].note = 'Retain existing fields';
  await writeFile(files.history, JSON.stringify(rows));
  const result = await files.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await files.rows(), rows);
});

test('reads old history and preserves the original CLI defaults', async (t) => {
  const old = { startTime: '2026-11-04T12:00:00Z', source: 'Local', total: 1,
    passed: 1, failed: 0, flaky: 0, skipped: 0, retryAttempts: 0, duration: 1000 };
  const files = await scenario(t, [old]);
  const result = await files.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await files.rows())[0], old);
  await mkdir(join(files.directory, 'test-results'));
  await writeFile(join(files.directory, 'test-results/playwright.json'), JSON.stringify(report));
  const defaults = spawnSync(process.execPath, [command], { cwd: files.directory, encoding: 'utf8' });
  assert.equal(defaults.status, 0, defaults.stderr);
  assert.equal(JSON.parse(await readFile(join(files.directory, '.local/playwright/history.json'))).length, 1);
});

test('averages each workflow ID once using its newest completed metadata', async (t) => {
  const earlier = {
    startTime: '2026-11-05T18:08:50Z', source: 'GitHub Actions', total: 4,
    passed: 4, failed: 0, flaky: 0, skipped: 0, retryAttempts: 0, duration: 1000,
    workflow: { ...workflow, updatedAt: '2026-11-05T18:10:00Z', duration: 120000 },
  };
  const files = await scenario(t, [earlier]);
  const result = await files.run(report, workflow);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await files.rows()).length, 2);
  assert.match(result.stdout, /Average completed workflow elapsed time per run: 120\.00 s \(1 imported workflow runs\)/);
  assert.match(result.stdout, /Average hosted Playwright runtime per run: 1\.50 s/);
});
