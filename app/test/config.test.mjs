import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readClientConfig, browserSecretNames } from '../src/lib/config.ts';

const base = { VITE_SUPABASE_URL:'https://example-project.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example_for_local_tests' };
const jwt = (role) => `e30.${Buffer.from(JSON.stringify({role})).toString('base64url')}.testsignature`;

test('publishable config and legacy anon keys are supported',()=>{
  assert.equal(readClientConfig(base).configured,true);
  assert.equal(readClientConfig({VITE_SUPABASE_URL:base.VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY:jwt('anon')}).configured,true);
});
test('missing and example settings do not enable sign-in',()=>{
  assert.equal(readClientConfig({}).configured,false);
  assert.equal(readClientConfig({VITE_SUPABASE_URL:'https://your-project.supabase.co',VITE_SUPABASE_ANON_KEY:'your-anon-key'}).configured,false);
  assert.equal(readClientConfig({...base,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_replace_with_your_project_key'}).configured,false);
});
test('publishable key takes precedence over legacy key',()=>{
  assert.equal(readClientConfig({...base,VITE_SUPABASE_ANON_KEY:'unused'}).configured,true);
});
test('server keys and secret-named browser fields are rejected without printing values',()=>{
  for (const secret of ['sb_secret_example_private',jwt('service_role')]) {
    const config=readClientConfig({...base,VITE_SUPABASE_PUBLISHABLE_KEY:secret});
    assert.equal(config.configured,false);
    assert.equal(config.issues.join(' ').includes(secret),false);
  }
  assert.deepEqual(browserSecretNames({VITE_GOOGLE_CLIENT_SECRET:'example',SERVER_SECRET:'example'}),['VITE_GOOGLE_CLIENT_SECRET']);
  assert.equal(readClientConfig({...base,VITE_EXTRA:jwt('service_role')}).configured,false);
});
test('hosted config rejects HTTP, loopback, embedded credentials and callback URLs',()=>{
  for (const url of ['http://project.supabase.co','https://localhost','https://user:pass@project.supabase.co','https://project.supabase.co/auth/v1/callback','https://project.supabase.co/?key=test']) {
    assert.equal(readClientConfig({...base,VITE_SUPABASE_URL:url}).configured,false);
  }
  assert.equal(readClientConfig({...base,VITE_SUPABASE_URL:'http://127.0.0.1:54321'},true).configured,true);
});
