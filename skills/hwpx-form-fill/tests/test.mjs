import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.join(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-'));
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
const fail = (m) => { console.log('FAIL ' + m); process.exit(1); };
const pickPython = (mods) => [process.env.PYTHON, 'python3', 'python'].filter(Boolean).find((p) => run(p, ['-c', `import ${mods}`]).status === 0);
const py = pickPython('hwpx; from hwpx import HwpxDocument');
if (!py) { console.log('SKIP: python-hwpx not installed'); process.exit(77); }
const S = path.join(skill, 'scripts', 'hwpx_form.py');
const out = path.join(tmp, 'filled.hwpx');
const r = run(py, [S, 'fill', path.join(skill, 'examples', 'form-sample.hwpx'), path.join(skill, 'examples', 'values.example.json'), out]);
if (r.status !== 0) fail('fill exit ' + r.status + ' ' + r.stdout + r.stderr);
const j = JSON.parse(r.stdout);
if (!(j.filled.length === 4 && j.filled.every((x) => x.verified))) fail('not all cells verified');
fs.writeFileSync(path.join(tmp, 'v2.json'), JSON.stringify({ '성명': '다른 이름', '없는칸': 'x' }));
const r2 = run(py, [S, 'fill', out, path.join(tmp, 'v2.json'), path.join(tmp, 'f2.hwpx')]);
const j2 = JSON.parse(r2.stdout);
if (!(r2.status === 1 && j2.skipped_filled.length === 1 && j2.missing.length === 1)) fail('overwrite guard failed: ' + r2.stdout);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('hwpx-form-fill ok: fill by label, verified from disk, refuses overwrite, reports missing');
