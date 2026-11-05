import assert from 'node:assert/strict';
import test from 'node:test';
import { route } from './app.js';

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
