import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pub = (p) => new URL(`../public/${p}`, import.meta.url);
const manifest = JSON.parse(await readFile(pub('manifest.webmanifest'), 'utf8'));

test('manifest meets the installability basics and stays relative to the hosting base path', () => {
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name);
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.some((i) => i.sizes === '192x192' && i.purpose === 'any'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of manifest.icons) assert.ok(!i.src.startsWith('/'), `icon path must be relative: ${i.src}`);
});

test('every icon exists and is a PNG of the declared size', async () => {
  for (const icon of manifest.icons) {
    const png = await readFile(pub(icon.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), w, `${icon.src} width`);
    assert.equal(png.readUInt32BE(20), h, `${icon.src} height`);
  }
  const apple = await readFile(pub('pwa/apple-touch-icon.png'));
  assert.equal(apple.readUInt32BE(16), 180);
});

test('the service worker never touches other origins or write requests', async () => {
  const sw = await readFile(pub('sw.js'), 'utf8');
  assert.match(sw, /request\.method !== 'GET'\) return/);
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/);
  assert.match(sw, /assets\//);
  assert.doesNotMatch(sw, /supabase/i);
});

test('index.html links the manifest and an iOS home-screen icon', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="manifest" href="%BASE_URL%manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="%BASE_URL%pwa\/apple-touch-icon\.png"/);
});
