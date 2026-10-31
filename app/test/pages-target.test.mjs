import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BUILD_MARKER, validatePagesTarget } from '../scripts/pages-target.mjs'
import { readClientConfig } from '../src/lib/config.ts'

test('deployment refuses source/private/unmarked repositories before replacing files', () => {
  const publicRepo={private:false,visibility:'public',default_branch:'main',archived:false}
  assert.doesNotThrow(()=>validatePagesTarget(publicRepo,BUILD_MARKER))
  for(const [metadata,marker] of [[{...publicRepo,private:true},BUILD_MARKER],[publicRepo,''],[{...publicRepo,default_branch:'master'},BUILD_MARKER],[{...publicRepo,archived:true},BUILD_MARKER]]) {
    assert.throws(()=>validatePagesTarget(metadata,marker))
  }
})

test('public build configuration rejects shell/env delimiters in legacy keys and URLs', () => {
  const key=`e30.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.testsignature`
  const base={VITE_SUPABASE_URL:'https://project.supabase.co',VITE_SUPABASE_ANON_KEY:key}
  assert.equal(readClientConfig(base).configured,true)
  assert.equal(readClientConfig({...base,VITE_SUPABASE_ANON_KEY:key+'$(example)'}).configured,false)
  assert.equal(readClientConfig({...base,VITE_SUPABASE_URL:'https://project.\nsupabase.co'}).configured,false)
  assert.equal(readClientConfig({...base,VITE_SUPABASE_URL:'https://$(example).supabase.co'}).configured,false)
})
