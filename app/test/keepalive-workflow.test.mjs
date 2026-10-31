import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepAlive, KEEPALIVE_CRON, QUIET_DAYS_BEFORE_RENEWAL } from '../scripts/keepalive-workflow.mjs';

const url = 'https://abcdefghijklmnop.supabase.co';
const key = 'sb_publishable_example_value';
const yml = keepAlive(url, key);

test('pings the public function with the publishable key only', () => {
  assert.ok(yml.includes(`"${url}/rest/v1/rpc/ping"`));
  assert.ok(yml.includes(`apikey: ${key}`));
  assert.doesNotMatch(yml, /service_role|secrets\.|\$\{\{\s*secrets/i);
});

test('runs twice a week and can be started by hand', () => {
  assert.equal(KEEPALIVE_CRON, '17 6 * * 1,4');
  assert.ok(yml.includes(`- cron: '${KEEPALIVE_CRON}'`));
  assert.match(yml, /workflow_dispatch:/);
});

test('renews the schedule with an empty commit once the repository has been quiet, so GitHub never switches it off', () => {
  // GitHub disables scheduled workflows in public repositories after 60 days without a commit.
  assert.ok(QUIET_DAYS_BEFORE_RENEWAL > 0 && QUIET_DAYS_BEFORE_RENEWAL < 60);
  assert.match(yml, new RegExp(`-ge ${QUIET_DAYS_BEFORE_RENEWAL} \\]`));
  assert.match(yml, /git commit --allow-empty/);
  assert.match(yml, /git push/);
  assert.match(yml, /permissions:\n {2}contents: write\n/);
});

test('the renewal runs before the ping, so a backend outage cannot skip it', () => {
  assert.ok(yml.indexOf('Keep the schedule switched on') < yml.indexOf('Call the public ping function'));
});

test('uses only first-party actions', () => {
  const uses = [...yml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.deepEqual(uses, ['actions/checkout@v4']);
});
