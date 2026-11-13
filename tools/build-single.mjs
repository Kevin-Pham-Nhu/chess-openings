// Bundles the app into one self-contained HTML fragment (no service worker),
// handy for previews and embedding. Run: node tools/build-single.mjs [outfile]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(root + f, 'utf8');
const out = process.argv[2] || root + 'dist/pip-chess.html';
const scripts = ['js/vendor/chess.min.js', 'js/pieces.js', 'js/data/openings.js', 'js/app.js'];

const html = `<title>Pip Chess Openings</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${read('css/style.css')}
/* The host page already pads for the top and bottom safe areas. */
:root { --sat: 0px; --sab: 0px; }
</style>
<div id="app"></div>
<script>window.__NO_SW__ = true;</script>
${scripts.map((f) => `<script>\n${read(f).replace(/<\/script/g, '<\\/script')}\n</script>`).join('\n')}
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
