import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupReactions, listingLink, react, searchTerm, sendListingTo, telegramUrl, whatsappUrl } from '../src/lib/share.ts'

test('listing links keep the hosting sub-path and share text is encoded', () => {
  assert.equal(listingLink('https://thesmugglr.github.io/', 'abc'), 'https://thesmugglr.github.io/listing/abc')
  assert.equal(listingLink('https://x.github.io/repo/', 'abc'), 'https://x.github.io/repo/listing/abc')
  assert.equal(whatsappUrl('Cycle & lock', 'https://s/listing/1'), 'https://wa.me/?text=' + encodeURIComponent('Cycle & lock on The Smugglr: https://s/listing/1'))
  assert.match(telegramUrl('A', 'https://s/l'), /^https:\/\/t\.me\/share\/url\?url=https%3A%2F%2Fs%2Fl&text=/)
})

test('search terms cannot break out of the PostgREST filter', () => {
  assert.equal(searchTerm('ab,role.eq.admin)'), 'ab role eq admin')
  assert.equal(searchTerm('  100%*  '), '100')
  assert.equal(searchTerm('x'.repeat(100)).length, 60)
})

test('reactions group per message, skip removed ones and mark mine', () => {
  const rows = [
    { message_id: 'm1', user_id: 'me', conversation_id: 'c', emoji: '❤️' },
    { message_id: 'm1', user_id: 'you', conversation_id: 'c', emoji: '❤️' },
    { message_id: 'm2', user_id: 'you', conversation_id: 'c', emoji: '😂' },
    { message_id: 'm3', user_id: 'me', conversation_id: 'c', emoji: null },
  ]
  const g = groupReactions(rows, 'me')
  assert.deepEqual(g.get('m1'), { counts: [['❤️', 2]], mine: '❤️' })
  assert.deepEqual(g.get('m2'), { counts: [['😂', 1]], mine: null })
  assert.equal(g.has('m3'), false)
})

test('choosing the same reaction again clears it; another one replaces it', async () => {
  const writes = []
  const api = { from: (t) => ({ upsert: (row, opts) => { writes.push([t, row.emoji, opts.onConflict]); return Promise.resolve({ error: null }) } }) }
  const row = { message_id: 'm', conversation_id: 'c', user_id: 'me' }
  assert.equal(await react(api, row, '❤️', '❤️'), null)
  assert.equal(await react(api, row, '😂', '❤️'), '😂')
  assert.deepEqual(writes, [['message_reactions', null, 'message_id,user_id'], ['message_reactions', '😂', 'message_id,user_id']])
  const bad = { from: () => ({ upsert: () => Promise.resolve({ error: { message: 'no' } }) }) }
  await assert.rejects(react(bad, row, '👍', null), /Could not save/)
})

test('sending a listing in the app returns the chat and trims the note', async () => {
  let args
  const api = { rpc: (name, a) => { args = [name, a]; return Promise.resolve({ data: 'chat-1', error: null }) } }
  assert.equal(await sendListingTo(api, 'l1', 'u2', '  look  '), 'chat-1')
  assert.deepEqual(args, ['share_listing', { p_listing: 'l1', p_to: 'u2', p_note: 'look' }])
  const refused = { rpc: () => Promise.resolve({ data: null, error: { message: 'They are not accepting messages from you' } }) }
  await assert.rejects(sendListingTo(refused, 'l1', 'u2', ''), /not accepting/)
})
