import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { pagesSite } from '../scripts/pages-site.mjs'
import { redirectPage, redirectSite, retiringServiceWorker } from '../scripts/redirect-site.mjs'

test('a repository named <owner>.github.io is a root site; any other is a project site', () => {
  assert.deepEqual(pagesSite('iiitdblackmarket/iiitdblackmarket.github.io'), {
    owner: 'iiitdblackmarket', name: 'iiitdblackmarket.github.io', rootSite: true, base: '/', url: 'https://iiitdblackmarket.github.io/',
  })
  assert.equal(pagesSite('IIITDBlackMarket/iiitdblackmarket.GitHub.io').base, '/', 'case does not matter')
  assert.deepEqual(pagesSite('AbhikRao/iiitd-black-market'), {
    owner: 'AbhikRao', name: 'iiitd-black-market', rootSite: false, base: '/iiitd-black-market/', url: 'https://abhikrao.github.io/iiitd-black-market/',
  })
  assert.equal(pagesSite('AbhikRao/other.github.io').rootSite, false, 'someone else\'s .github.io name is not a root site')
  assert.throws(() => pagesSite('no-slash'), /Expected <owner\/repo>/)
})

// Runs the redirect page's own script against a fake browser location and returns where it sends the visitor.
function destination(oldBase, location) {
  const html = redirectPage('https://iiitdblackmarket.github.io/', oldBase)
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1]
  let target = null
  vm.runInNewContext(script, { location: { search: '', hash: '', ...location, replace: (url) => { target = url } } })
  return target
}

test('the old address sends every page to the same page on the new one', () => {
  const base = '/iiitd-black-market/'
  assert.equal(destination(base, { pathname: '/iiitd-black-market/' }), 'https://iiitdblackmarket.github.io/')
  assert.equal(destination(base, { pathname: '/iiitd-black-market/listing/abc-123', search: '?ref=share', hash: '#photos' }), 'https://iiitdblackmarket.github.io/listing/abc-123?ref=share#photos')
  assert.equal(destination(base, { pathname: '/iiitd-black-market/privacy.html' }), 'https://iiitdblackmarket.github.io/privacy.html')
  assert.equal(destination(base, { pathname: '/something-else' }), 'https://iiitdblackmarket.github.io/', 'an unknown path still lands on the home page')
})

test('the redirect site has a no-script fallback, a canonical link and no tracking or app code', () => {
  const files = redirectSite('https://iiitdblackmarket.github.io/', '/iiitd-black-market/')
  assert.deepEqual(Object.keys(files).sort(), ['.nojekyll', '404.html', 'index.html', 'privacy.html', 'sw.js', 'terms.html'])
  assert.match(files['index.html'], /<noscript><meta http-equiv="refresh" content="0; url=https:\/\/iiitdblackmarket\.github\.io\/"><\/noscript>/)
  assert.match(files['404.html'], /<link rel="canonical" href="https:\/\/iiitdblackmarket\.github\.io\/">/)
  assert.doesNotMatch(files['index.html'], /supabase|sb_publishable|analytics/i)
  assert.equal(files['index.html'], files['404.html'], 'deep links that hit the 404 page redirect too')
})

test('the replacement service worker only clears caches and unregisters', () => {
  assert.match(retiringServiceWorker, /caches\.delete/)
  assert.match(retiringServiceWorker, /registration\.unregister\(\)/)
  assert.doesNotMatch(retiringServiceWorker, /fetch|supabase/)
})

test('the redirect target and base path are validated', () => {
  assert.throws(() => redirectSite('http://iiitdblackmarket.github.io/', '/x/'), /https URL ending in/)
  assert.throws(() => redirectSite('https://iiitdblackmarket.github.io', '/x/'), /https URL ending in/)
  assert.throws(() => redirectSite('https://iiitdblackmarket.github.io/', 'no-slashes'), /base path/)
  assert.throws(() => redirectSite('https://x.test/"><script>', '/x/'), /https URL ending in/)
})
