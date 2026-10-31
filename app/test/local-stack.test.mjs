import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateLocalStack } from '../scripts/local-stack.mjs'
import { isLoopbackUrl } from '../src/lib/config.ts'

test('local test credentials are never sent to hosted or disguised endpoints', () => {
  const keys = { ANON_KEY:'fixture-anon', SERVICE_ROLE_KEY:'fixture-secret' }
  for (const API_URL of ['https://project.supabase.co','http://127.0.0.1.evil.test','http://user:pass@localhost','file:///localhost','http://localhost/?token=fixture-secret','http://localhost/auth']) {
    assert.throws(() => validateLocalStack({...keys,API_URL}), e => !e.message.includes('fixture-secret'))
    assert.equal(isLoopbackUrl(API_URL),false)
  }
  for (const API_URL of ['http://localhost:54321','http://127.0.0.1:54321','http://[::1]:54321']) {
    assert.equal(validateLocalStack({...keys,API_URL}).API_URL,API_URL)
    assert.equal(isLoopbackUrl(API_URL),true)
  }
  assert.throws(()=>validateLocalStack({API_URL:'http://localhost:54321'}),/keys are missing/)
})
