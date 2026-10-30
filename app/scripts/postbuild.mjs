// Static hosts without rewrite rules (GitHub Pages) serve 404.html for unknown paths. Making it a copy of
// index.html lets deep links such as /listing/<id> load the app, and .nojekyll stops Pages from filtering files.
import { copyFile, writeFile } from 'node:fs/promises'
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../dist/404.html', import.meta.url))
await writeFile(new URL('../dist/.nojekyll', import.meta.url), '')
console.log('postbuild: wrote dist/404.html and dist/.nojekyll')
