import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uploadPhotoBatch, validatePhotoBatch } from '../src/lib/photoUploads.ts'
const good = {type:'image/jpeg',size:100}

test('an invalid later file prevents the entire batch before any upload', async () => {
  let writes = 0
  for (const files of [[good,{type:'image/svg+xml',size:1}],[good,{type:'image/png',size:5*1024*1024+1}],Array(7).fill(good)]) {
    await assert.rejects(uploadPhotoBatch(0,files,async()=>{writes++;return 'path'},()=>{}))
  }
  assert.equal(writes,0)
  assert.ok(validatePhotoBatch(5,[good,good]))
  assert.equal(validatePhotoBatch(5,[good]),undefined)
})

test('a network failure keeps already uploaded photos visible and skips later files', async () => {
  const paths=[]
  let writes=0
  await assert.rejects(uploadPhotoBatch(0,[good,good,good],async()=>{
    writes++; if(writes===2)throw new Error('service unavailable'); return 'first-photo'
  },p=>paths.push(p)),/service unavailable/)
  assert.deepEqual(paths,['first-photo'])
  assert.equal(writes,2)
})
