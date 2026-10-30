import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd=fileURLToPath(new URL('../',import.meta.url));
const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith('VITE_')));

test('deployment config command fails clearly when credentials are absent',()=>{
  const script=fileURLToPath(new URL('../scripts/check-config.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script],{cwd:fileURLToPath(new URL('./fixtures/no-env/',import.meta.url)),env:cleanEnv,encoding:'utf8'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/VITE_SUPABASE_URL is missing/);
});
test('actual Vite build refuses browser secrets without echoing their values',()=>{
  const fixture='fixture_private_value_for_test_only';
  const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{
    cwd,env:{...cleanEnv,VITE_GOOGLE_CLIENT_SECRET:fixture},encoding:'utf8',
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Remove server-only browser variables: VITE_GOOGLE_CLIENT_SECRET/);
  assert.equal((result.stdout+result.stderr).includes(fixture),false);
});
