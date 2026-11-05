import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const base = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:8080');
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' ||
    base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
  throw new Error('Use an HTTP loopback origin at 127.0.0.1 for disposable smoke data');
}

async function request(path, status, method = 'GET', body) {
  const response = await fetch(new URL(path, base), {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
    ...(body && {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  assert.equal(response.status, status, method + ' ' + path);
  return response;
}

async function json(path, status, method, body) {
  return (await request(path, status, method, body)).json();
}

async function waitForReady() {
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      await request('/ready', 200);
      return;
    } catch (error) {
      if (attempt === 14) throw error;
      await delay(1000);
    }
  }
}

const users = [];
async function createUser(name) {
  const user = await json('/api/users', 201, 'POST', { name });
  users.push(user.id);
  return user;
}

await waitForReady();
assert.deepEqual(await json('/health', 200), { status: 'ok' });
assert.match(await (await request('/', 200)).text(), /Open a demo workspace/);
const name = 'smoke-' + randomUUID().slice(0, 12);

try {
  const owner = await createUser(name);
  const stranger = await createUser(name + '-other');
  const userPath = '/api/users/' + owner.id;
  const tasksPath = userPath + '/tasks';
  assert.deepEqual(await json('/api/users?name=' + name, 200), owner);
  assert.deepEqual(await json(userPath, 200), owner);
  await request('/api/users', 409, 'POST', { name });
  assert.equal((await json(userPath, 200, 'PATCH', { name: name + '-renamed' })).name, name + '-renamed');
  assert.deepEqual(await json(tasksPath, 200), []);

  const title = "Check O'Brien's instrument";
  const task = await json(tasksPath, 201, 'POST', { title });
  const taskPath = tasksPath + '/' + task.id;
  const otherPath = '/api/users/' + stranger.id + '/tasks/' + task.id;
  assert.deepEqual(await json(taskPath, 200), { id: task.id, title, completed: false });
  await request(otherPath, 404);
  await request(otherPath, 404, 'PATCH', { completed: true });
  await request(otherPath, 404, 'DELETE');
  const completed = await json(taskPath, 200, 'PATCH', { completed: true });
  assert.deepEqual(completed, { ...task, completed: true });

  if (process.argv.includes('--restart-api')) {
    const restart = spawnSync('docker', ['compose', 'restart', 'api'], { stdio: 'inherit' });
    if (restart.status !== 0) throw new Error('Compose API restart failed');
    await waitForReady();
    console.log('API restarted. Checking the task stored in PostgreSQL.');
  }

  assert.deepEqual(await json(tasksPath, 200), [completed]);
  await request(taskPath, 204, 'DELETE');
  assert.deepEqual(await json(tasksPath, 200), []);
  await request(taskPath, 404);
  console.log('Smoke passed for health, readiness, web page, user and task CRUD, and cross-user isolation.');
} finally {
  const cleaned = await Promise.allSettled(users.map((id) => request('/api/users/' + id, 204, 'DELETE')));
  for (const result of cleaned) {
    if (result.status === 'rejected') {
      console.error('Smoke data cleanup failed:', result.reason.message);
      process.exitCode = 1;
    }
  }
}
