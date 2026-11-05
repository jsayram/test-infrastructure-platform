import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

const [platform, device] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform) || !device) {
  throw new Error('Usage: npm run test:mobile -- <ios|android> <device-id>');
}

async function request(path, status, method = 'GET', data) {
  const response = await fetch(new URL(path, 'http://127.0.0.1:8080'), {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(6000),
    ...(data && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }),
  });
  assert.equal(response.status, status, method + ' ' + path);
  return response;
}

const output = 'test-results/mobile-' + platform;
await mkdir(output, { recursive: true });
await request('/ready', 200);
const name = 'mobile-' + randomUUID().slice(0, 12);
const workspace = await (await request('/api/users', 201, 'POST', { name })).json();
const userPath = '/api/users/' + workspace.id;
try {
  const result = spawnSync('maestro', [
    '--device', device, 'test', '-e', 'DEMO_NAME=' + name, '--format', 'JUNIT',
    '--output', output + '/junit.xml', '--debug-output', output, 'tests/mobile/tasks.yaml',
  ], {
    env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1', MAESTRO_API_URL: 'http://127.0.0.1:9' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Maestro journey failed on ' + platform);
  const tasks = await (await request(userPath + '/tasks', 200)).json();
  assert.deepEqual(tasks.map(({ title, completed }) => ({ title, completed })), [
    { title: 'Calibrate instrument', completed: true },
  ]);
  console.log(platform + ' mobile journey passed and the API confirmed the completed task.');
} finally {
  await request(userPath, 204, 'DELETE');
}
