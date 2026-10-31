import { test } from 'node:test'
import assert from 'node:assert/strict'
import { preparePhoto } from '../src/lib/image.ts'

test('undecodable photos never upload original bytes with possible location metadata', async t => {
  const previous = globalThis.createImageBitmap
  globalThis.createImageBitmap = async () => { throw new Error('unsupported codec') }
  t.after(() => { if (previous === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = previous })
  const original = new File(['fixture with camera metadata'], 'phone.heic', {type:'image/heic'})
  await assert.rejects(preparePhoto(original),/Try a JPG or PNG/)
})
