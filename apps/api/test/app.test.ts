import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';

test('API liveness is available without database credentials', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] ?? '', /application\/json/);
  assert.deepEqual(response.json(), { status: 'ok', service: 'iiitd-api' });
});

test('scaffold exposes no marketplace or private message endpoints', async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  for (const url of ['/api/listings', '/api/messages', '/api/auth/me']) {
    assert.equal((await app.inject({ method: 'GET', url })).statusCode, 404);
  }
});
