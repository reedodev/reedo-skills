// Renders the bundled 4:5 template with real Chrome and checks exact PNG sizes. Exit 77 = skipped (no Chrome / old Node).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', 'scripts', 'render.mjs');
if (typeof WebSocket === 'undefined') { console.log('SKIP: Node 22+ needed'); process.exit(77); }
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cardr-'));
const r = spawnSync('node', [script, path.join(here, '..', 'templates', 'card-4x5.html'), path.join(d, 'card.png'), '--size', '1080x1350', '--scale', '2', '--pages', '--json'], { encoding: 'utf8', timeout: 90000 });
if (/chrome|edge|browser/i.test(r.stderr) && r.status === 2) { console.log('SKIP: no Chrome/Edge found'); process.exit(77); }
const pngs = fs.readdirSync(d).filter((f) => f.endsWith('.png'));
const sizes = pngs.map((f) => { const b = fs.readFileSync(path.join(d, f)); return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`; });
fs.rmSync(d, { recursive: true, force: true });
if (r.status !== 0 || pngs.length !== 3 || sizes.some((s) => s !== '2160x2700')) { console.log('FAIL', r.status, pngs, sizes, r.stderr.slice(-300)); process.exit(1); }
console.log(`html-card-render ok: ${pngs.length} pages at ${sizes[0]}`);
