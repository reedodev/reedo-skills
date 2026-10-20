// Builds tiny PNG headers in memory and checks the thumbnail + batch gate.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'publish-gate.mjs');
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ytgate-'));
function png(w, h) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(t), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(d, 'long.png'), png(1280, 720));
fs.writeFileSync(path.join(d, 'short.png'), png(1080, 1920));
fs.writeFileSync(path.join(d, 'wrong.png'), png(1280, 720));
const run = (...a) => spawnSync('node', [script, ...a], { encoding: 'utf8' });
const fail = (m) => { console.log('FAIL ' + m); process.exit(1); };

if (run('thumb', path.join(d, 'long.png'), '--kind', 'long').status !== 0) fail('16:9 long thumb should pass');
if (run('thumb', path.join(d, 'short.png'), '--kind', 'short').status !== 0) fail('9:16 short thumb should pass');
if (run('thumb', path.join(d, 'wrong.png'), '--kind', 'short').status !== 1) fail('16:9 thumb for a short should fail');

const batch = (videos) => { fs.writeFileSync(path.join(d, 'p.json'), JSON.stringify({ videos })); return run('check', path.join(d, 'p.json')); };
const good = [
  { id: 'L1', kind: 'long', thumbnail: 'long.png', thumbnailVerifiedOnChannel: true, visibility: 'public', pinnedComment: { text: '요약', pinnedVerified: true } },
  { id: 'S1', kind: 'short', thumbnail: 'short.png', thumbnailVerifiedOnChannel: true, visibility: 'scheduled', pinnedComment: { text: '질문', followUpTask: 'pin-S1' } },
  { id: 'K1', kind: 'long', thumbnail: 'long.png', thumbnailVerifiedOnChannel: true, madeForKids: true },
];
if (batch(good).status !== 0) fail('good batch should pass');
const r = batch([{ id: 'S2', kind: 'short', thumbnail: 'wrong.png', visibility: 'scheduled', pinnedComment: { text: 'x' } }]);
if (r.status !== 1 || !/후속 작업/.test(r.stdout) || !/9:16/.test(r.stdout)) fail('bad batch should list ratio + missing follow-up: ' + r.stdout);
fs.rmSync(d, { recursive: true, force: true });
console.log('youtube-publish-checklist ok: thumb ratio/size, scheduled follow-up, kids exception');
