// Builds data from the bundled sample vault and checks the output shape and privacy options.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', 'scripts', 'build-data.mjs');
const vault = path.join(here, '..', 'examples', 'sample-vault');
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'brain3d-'));
const fail = (m) => { console.log('FAIL ' + m); process.exit(1); };
const r1 = spawnSync('node', [script, vault, '--out', path.join(d, 'data.js')], { encoding: 'utf8' });
if (r1.status !== 0) fail('build failed: ' + r1.stderr.slice(-300));
const js = fs.readFileSync(path.join(d, 'data.js'), 'utf8');
if (!/Sample|sample|notes|nodes/i.test(js) || js.length < 1000) fail('data.js looks empty');
const r2 = spawnSync('node', [script, vault, '--out', path.join(d, 'hidden.js'), '--hide-titles', '--hide-groups'], { encoding: 'utf8' });
if (r2.status !== 0) fail('hidden build failed');
const hidden = fs.readFileSync(path.join(d, 'hidden.js'), 'utf8');
const firstTitle = fs.readdirSync(vault, { recursive: true }).find((f) => f.endsWith('.md') && !/README/i.test(f));
const word = path.basename(firstTitle, '.md');
if (hidden.includes(word)) fail('--hide-titles leaked a real title: ' + word);
const r3 = spawnSync('node', [script, vault, '--out', path.join(vault, 'x.js')], { encoding: 'utf8' });
if (r3.status === 0 || fs.existsSync(path.join(vault, 'x.js'))) fail('must refuse to write inside the vault');
fs.rmSync(d, { recursive: true, force: true });
console.log('obsidian-brain-3d ok: build, --hide-titles/--hide-groups, refuses writing into vault');
