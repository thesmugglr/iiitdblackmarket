// Files for an OLD Pages address once the site has moved (npm run deploy:pages -- <old owner/repo> --redirect-to <new url>).
// Every page on the old address sends the visitor to the same page on the new one, keeping the path, query and hash,
// so shared links, bookmarks and deep links keep working. A replacement service worker removes the old app's cache
// and unregisters itself so nobody keeps running the old copy.

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The page that redirects. `oldBase` is the path the old site was served from, such as /iiitd-black-market/. */
export function redirectPage(newUrl, oldBase) {
  const to = escapeHtml(newUrl)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>IIITD Black Market has moved</title>
<link rel="canonical" href="${to}">
<noscript><meta http-equiv="refresh" content="0; url=${to}"></noscript>
<script>
  var base = ${JSON.stringify(oldBase)};
  var rest = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) : '';
  location.replace(${JSON.stringify(newUrl)} + rest + location.search + location.hash);
</script>
<style>body{margin:0;font:17px/1.6 system-ui,sans-serif;background:#faf7f2;color:#1a1a1a;display:grid;place-items:center;min-height:100vh;text-align:center;padding:1rem}a{color:inherit}</style>
</head>
<body>
<main>
<h1>IIITD Black Market has moved</h1>
<p>It now lives at <a href="${to}">${to}</a>. If you installed the app on your phone, install it again from the new address.</p>
</main>
</body>
</html>
`
}

/** Replaces the old app's service worker: clears its cache and unregisters. */
export const retiringServiceWorker = `// IIITD Black Market moved to a new address. This worker only cleans up after the old one.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
  })())
})
`

/** Every file of the redirect-only site, by path. */
export function redirectSite(newUrl, oldBase) {
  if (!/^https:\/\/[^/\s]+\/$/.test(newUrl)) throw new Error('The new address must be an https URL ending in /, for example https://thesmugglr.github.io/')
  if (!/^\/([\w.-]+\/)?$/.test(oldBase)) throw new Error('The old base path must look like / or /name/')
  const page = redirectPage(newUrl, oldBase)
  return { 'index.html': page, '404.html': page, 'privacy.html': page, 'terms.html': page, 'sw.js': retiringServiceWorker, '.nojekyll': '' }
}
