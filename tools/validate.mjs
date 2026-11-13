// Checks every course: legal moves, alternating sides, required fields.
// Run: node tools/validate.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['js/vendor/chess.min.js', 'js/data/openings.js']) {
  vm.runInContext(readFileSync(root + f, 'utf8') + (f.includes('chess') ? '\nwindow.ChessLib = ChessLib;' : ''), ctx);
}
const { OPENINGS, TIERS, DIFFICULTY, ChessLib } = ctx.window;

let errors = 0;
const fail = (id, msg) => { errors++; console.error(`✗ ${id}: ${msg}`); };
const ids = new Set();

for (const o of OPENINGS) {
  if (ids.has(o.id)) fail(o.id, 'duplicate id');
  ids.add(o.id);
  for (const k of ['name', 'eco', 'tagline', 'history']) if (!o[k]) fail(o.id, `missing ${k}`);
  if (!['w', 'b'].includes(o.side)) fail(o.id, 'bad side');
  if (!TIERS[o.tier]) fail(o.id, 'bad tier');
  if (!DIFFICULTY[o.difficulty]) fail(o.id, 'bad difficulty');
  if (!(o.stars >= 1 && o.stars <= 5)) fail(o.id, 'stars must be 1-5');
  if (!Array.isArray(o.ideas) || o.ideas.length < 2) fail(o.id, 'needs ideas');
  const chess = new ChessLib.Chess();
  o.moves.forEach(([san, why], i) => {
    if (!why || why.length < 8) fail(o.id, `move ${i + 1} (${san}) has no explanation`);
    try {
      const m = chess.move(san, { strict: true });
      if (m.san !== san) fail(o.id, `move ${i + 1}: wrote "${san}", engine says "${m.san}"`);
    } catch {
      fail(o.id, `illegal move ${i + 1}: ${san} in ${chess.fen()}`);
    }
  });
}

const count = (s) => OPENINGS.filter((o) => o.side === s).length;
console.log(`${OPENINGS.length} openings (${count('w')} white, ${count('b')} black), ${OPENINGS.reduce((n, o) => n + o.moves.length, 0)} explained moves`);
if (errors) { console.error(`${errors} problem(s)`); process.exit(1); }
console.log('All courses valid.');
