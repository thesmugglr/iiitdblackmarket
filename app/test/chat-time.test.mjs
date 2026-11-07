import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsHeader, seenLabel, swipeIntent, timeHeader } from '../src/lib/chatTime.ts'

const now = new Date(2026, 10, 7, 22, 0).getTime()
const ago = (ms) => new Date(now - ms).toISOString()
const M = 60000, H = 60 * M, D = 24 * H

test('Seen label moves from just now to minutes, hours, days and weeks', () => {
  assert.equal(seenLabel(ago(20 * 1000), now), 'Seen just now')
  assert.equal(seenLabel(ago(5 * M), now), 'Seen 5m ago')
  assert.equal(seenLabel(ago(2 * H + 5 * M), now), 'Seen 2h ago')
  assert.equal(seenLabel(ago(3 * D), now), 'Seen 3d ago')
  assert.equal(seenLabel(ago(15 * D), now), 'Seen 2w ago')
  assert.equal(seenLabel(new Date(now + 5000).toISOString(), now), 'Seen just now', 'clock skew never shows a negative time')
})

test('a time header starts the chat and follows a quiet hour', () => {
  assert.equal(needsHeader(undefined, ago(0)), true)
  assert.equal(needsHeader(ago(30 * M), ago(0)), false)
  assert.equal(needsHeader(ago(H), ago(0)), true)
})

test('headers say the time today, Yesterday, a weekday, then a date', () => {
  assert.doesNotMatch(timeHeader(ago(H), now), /Yesterday|,/)
  assert.match(timeHeader(ago(D), now), /^Yesterday /)
  assert.match(timeHeader(ago(3 * D), now), /^[A-Za-z]{3} /)
  assert.match(timeHeader(ago(30 * D), now), /, /)
})

test('swipes: right replies, left reveals times, short or vertical moves do nothing', () => {
  assert.equal(swipeIntent(40, 5), 'reply')
  assert.equal(swipeIntent(-40, 5), 'reveal')
  assert.equal(swipeIntent(5, 0), 'none')
  assert.equal(swipeIntent(20, 30), 'none')
})
