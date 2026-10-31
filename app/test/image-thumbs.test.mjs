import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FULL_EDGE, FULL_QUALITY, THUMB_EDGE, THUMB_QUALITY, preparePhoto, thumbPath } from '../src/lib/image.ts'

// A fake browser: createImageBitmap returns a bitmap of the given size and every canvas "encodes" to a blob whose
// size grows with its pixel count and quality, so the tests can compare the copies without a real image codec.
function fakeBrowser(t, { width, height }) {
  const encoded = []
  let closed = 0
  const before = { bitmap: globalThis.createImageBitmap, document: globalThis.document }
  globalThis.createImageBitmap = async () => ({ width, height, close() { closed += 1 } })
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas')
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
        toBlob(done, type, quality) {
          encoded.push({ width: canvas.width, height: canvas.height, type, quality })
          done(new Blob([new Uint8Array(Math.round((canvas.width * canvas.height * quality) / 20))], { type }))
        },
      }
      return canvas
    },
  }
  t.after(() => {
    if (before.bitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = before.bitmap
    if (before.document === undefined) delete globalThis.document; else globalThis.document = before.document
  })
  return { encoded, closed: () => closed }
}

const photo = new File(['pixels'], 'shelf.jpg', { type: 'image/jpeg' })

test('a listing photo is stored as a full-size copy plus a much smaller one', async (t) => {
  const browser = fakeBrowser(t, { width: 4000, height: 3000 })
  const { blob, thumb, ext, type } = await preparePhoto(photo, { thumb: true })
  assert.deepEqual(browser.encoded, [
    { width: FULL_EDGE, height: 960, type: 'image/jpeg', quality: FULL_QUALITY },
    { width: THUMB_EDGE, height: 360, type: 'image/jpeg', quality: THUMB_QUALITY },
  ])
  assert.equal(ext, 'jpg')
  assert.equal(type, 'image/jpeg')
  assert.ok(thumb && thumb.size * 4 < blob.size, 'the thumbnail is several times smaller')
  assert.equal(browser.closed(), 1, 'the decoded bitmap is released')
})

test('no small copy unless one is asked for (chat photos do not need it)', async (t) => {
  const browser = fakeBrowser(t, { width: 4000, height: 3000 })
  const prepared = await preparePhoto(photo)
  assert.equal(prepared.thumb, undefined)
  assert.equal(browser.encoded.length, 1)
})

test('a photo already smaller than the thumbnail is not copied or enlarged', async (t) => {
  const browser = fakeBrowser(t, { width: 400, height: 300 })
  const prepared = await preparePhoto(photo, { thumb: true })
  assert.equal(prepared.thumb, undefined)
  assert.deepEqual(browser.encoded.map((e) => [e.width, e.height]), [[400, 300]])
})

test('the small copy lives next to the photo and keeps working for older file names', () => {
  assert.equal(thumbPath('user-1/abc-123.jpg'), 'user-1/abc-123_t.jpg')
  assert.equal(thumbPath('user-1/abc-123.png'), 'user-1/abc-123_t.jpg')
  assert.equal(thumbPath('user-1/no-extension'), 'user-1/no-extension_t.jpg')
  assert.equal(thumbPath('user.name/abc.jpg'), 'user.name/abc_t.jpg')
})

test('when a canvas cannot be used the original bytes are still never uploaded', async (t) => {
  fakeBrowser(t, { width: 4000, height: 3000 })
  globalThis.document.createElement = () => ({ width: 0, height: 0, getContext: () => null })
  await assert.rejects(preparePhoto(photo, { thumb: true }), /Try a JPG or PNG/)
})
