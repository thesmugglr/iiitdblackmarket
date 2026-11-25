// Exercise the real composer and realtime messages on a disposable loopback stack.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { readLocalStack } from './local-stack.mjs'

const env = readLocalStack()
const client = key => createClient(env.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
const admin = client(env.SERVICE_ROLE_KEY)
const created = []
const password = randomUUID()
const ok = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}
async function member(label) {
  const email = `layout.${label}.${randomUUID()}@iiitd.ac.in`
  const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }))
  created.push(user.id)
  ok(await admin.from('profiles').update({ status: 'approved' }).eq('id', user.id))
  const api = client(env.ANON_KEY)
  ok(await api.auth.signInWithPassword({ email, password }))
  return { id: user.id, email, api }
}

async function geometry(page) {
  return page.locator('.messages').evaluate(list => ({
    pageTop: document.scrollingElement.scrollTop,
    height: list.clientHeight,
    quickRepliesHeight: document.querySelector('.chat .quick-replies')?.getBoundingClientRect().height ?? 0,
    top: list.scrollTop,
    endGap: list.scrollHeight - list.scrollTop - list.clientHeight,
    composerBottom: document.querySelector('.chat .composer').getBoundingClientRect().bottom,
    viewportHeight: window.visualViewport.height,
  }))
}

let server, browser
try {
  const seller = await member('seller')
  const buyer = await member('buyer')
  const listing = ok(await seller.api.from('listings').insert({
    seller_id: seller.id, title: 'Layout fixture', listing_type: 'sale', category: 'misc', condition: 'good', price_inr: 10,
  }).select('id').single())
  const conversation = ok(await buyer.api.rpc('start_conversation', { p_listing: listing.id }))
  ok(await seller.api.from('messages').insert(Array.from({ length: 40 }, (_, i) => ({
    conversation_id: conversation, sender_id: seller.id, body: `Fictional history ${i}`,
  }))))
  process.env.VITE_SUPABASE_URL = env.API_URL
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.ANON_KEY
  process.env.VITE_DEV_LOGIN = '1'
  process.env.VITE_DEMO = '0'
  server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
  await server.listen()
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  browser = await chromium.launch()
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const page = await browser.newPage({ viewport })
    try {
      await page.goto(origin + '/inbox/' + conversation)
      await page.getByLabel('Email', { exact: true }).fill(buyer.email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      await page.getByText('Fictional history 39', { exact: true }).waitFor()
      const input = page.getByPlaceholder('Message')
      const body = 'Fictional send ' + viewport.width
      await input.fill(body)
      const before = await geometry(page)
      await input.press('Enter')
      await page.locator('.bubble.mine').getByText(body, { exact: true }).waitFor()
      await page.waitForFunction(() => document.querySelector('.chat .composer input:not([type=file])')?.value === '')
      const after = await geometry(page)
      assert.equal(after.pageTop, before.pageTop, 'sending moved the outer page')
      // The first outgoing message removes the quick-reply row and gives its space to the transcript.
      assert.equal(after.quickRepliesHeight, 0, 'quick replies remain after sending')
      const expectedHeight = before.height + before.quickRepliesHeight
      assert.ok(Math.abs(after.height - expectedHeight) <= 2,
        `transcript height after send: expected ${expectedHeight}px, got ${after.height}px`)
      assert.ok(after.endGap <= 3 && after.height > 120, 'own message should be visible')
      assert.ok(after.composerBottom <= after.viewportHeight + 1, 'composer leaves viewport')

      await page.locator('.messages').evaluate(list => { list.scrollTop = 0 })
      await page.waitForTimeout(100) // allow the native scroll event to reach the React handler
      const incoming = 'Fictional incoming ' + viewport.width
      ok(await seller.api.from('messages').insert({ conversation_id: conversation, sender_id: seller.id, body: incoming }))
      const jump = page.getByRole('button', { name: 'New messages ↓' })
      await jump.waitFor()
      assert.ok((await geometry(page)).top <= 2, 'incoming message moved the reader')
      await jump.click()
      assert.ok((await geometry(page)).endGap <= 3)
      if (viewport.width === 390) {
        // Emulates reduced height. Actual Android keyboard behavior needs device QA.
        await page.setViewportSize({ width: 390, height: 400 })
        await page.waitForFunction(() => document.querySelector('.chat .composer').getBoundingClientRect().bottom <= 401)
        const small = await geometry(page)
        assert.ok(small.height > 60 && small.composerBottom <= 401)
      }
      console.log(`PASS chat send, scroll containment and history position at ${viewport.width}x${viewport.height}`)
    } finally {
      await page.close()
    }
  }
  // Seller opens the same saved message from Inbox and from the notification,
  // with no realtime events and the standalone message-history request unavailable.
  const sellerPage = await browser.newPage()
  try {
    await sellerPage.routeWebSocket('**/realtime/**', () => {})
    await sellerPage.route('**/rest/v1/messages?**', route => {
      const request = route.request()
      return request.method() === 'GET' && new URL(request.url()).searchParams.has('conversation_id')
        ? route.abort() : route.continue()
    })
    const text = 'Fictional message for the seller'
    ok(await buyer.api.from('messages').insert({ conversation_id: conversation, sender_id: buyer.id, body: text }))
    await sellerPage.goto(origin + '/inbox')
    await sellerPage.getByLabel('Email', { exact: true }).fill(seller.email)
    await sellerPage.getByLabel('Password', { exact: true }).fill(password)
    await sellerPage.getByRole('button', { name: 'Sign in', exact: true }).click()
    await sellerPage.locator('a.thread').filter({ hasText: text }).click()
    await sellerPage.locator('.bubble').getByText(text, { exact: true }).waitFor()
    await sellerPage.goto(origin + '/notifications')
    await sellerPage.locator(`a[href="/inbox/${conversation}"]`).first().click()
    await sellerPage.locator('.bubble').getByText(text, { exact: true }).waitFor()
    const reply = 'Fictional reply without realtime'
    await sellerPage.getByPlaceholder('Message').fill(reply)
    await sellerPage.getByPlaceholder('Message').press('Enter')
    await sellerPage.locator('.bubble.mine').getByText(reply, { exact: true }).waitFor()
    console.log('PASS seller reads history via Inbox and Notifications and sees a confirmed reply without realtime')
  } finally { await sellerPage.close() }
} finally {
  await browser?.close()
  await server?.close()
  for (const id of created) ok(await admin.auth.admin.deleteUser(id))
}
