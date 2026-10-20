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
const r = run('node', [path.join(skill, 'scripts', 'golden-keywords.mjs'), '--self-test']);
fs.rmSync(tmp, { recursive: true, force: true });
if (r.status !== 0) fail(r.stdout + r.stderr);
console.log('naver-golden-keywords ok: ' + r.stdout.trim());
