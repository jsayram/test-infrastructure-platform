import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { route } from './app.js';
import { dataRoute } from './data-route.js';

const ownerId = '00000000-0000-4000-8000-000000000001';
const taskId = '00000000-0000-4000-8000-000000000002';

function bodyRequest(method, url, body) {
  return Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), {
    method,
    url,
    headers: { 'content-type': 'application/json' },
  });
}

test('GET /health returns current health as uncached JSON', () => {
  const result = route('GET', '/health?probe=local');

  assert.equal(result.status, 200);
  assert.match(result.headers['content-type'], /^application\/json\b/);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(result.body), { status: 'ok' });
});

test('POST /health is rejected and advertises GET', () => {
  const result = route('POST', '/health');

  assert.equal(result.status, 405);
  assert.equal(result.headers.allow, 'GET');
});

test('unknown routes return 404 without exposing project files', () => {
  for (const path of ['/missing', '/.env', '/apps/api/server.js']) {
    const result = route('GET', path);

    assert.equal(result.status, 404);
    assert.deepEqual(JSON.parse(result.body), { error: 'Not found' });
  }
});

test('the data API rejects an invalid owner ID before querying the database', async () => {
  const result = await dataRoute(bodyRequest('GET', '/api/users/not-a-uuid/tasks'), {});
  assert.equal(result.status, 400);
});

test('the data API rejects a completion value that is not boolean', async () => {
  const result = await dataRoute(
    bodyRequest('PATCH', '/api/users/' + ownerId + '/tasks/' + taskId, { completed: 'true' }),
    {},
  );
  assert.equal(result.status, 400);
});

test('the data API passes both owner and task ID to a mutation', async () => {
  const result = await dataRoute(
    bodyRequest('PATCH', '/api/users/' + ownerId + '/tasks/' + taskId, { completed: false }),
    {
      updateTask: (user, task, title, completed) => {
        assert.deepEqual([user, task, title, completed], [ownerId, taskId, null, false]);
        return null;
      },
    },
  );
  assert.equal(result.status, 404);
});

test('the local health-only mode reports a database error for data routes', async () => {
  const result = await dataRoute(bodyRequest('GET', '/api/users?name=test'), null);
  assert.equal(result.status, 503);
});
