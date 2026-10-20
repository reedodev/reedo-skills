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
const py = pickPython('numpy, soundfile');
if (!py) { console.log('SKIP: numpy/soundfile not installed'); process.exit(77); }
const gen = `
import numpy as np, soundfile as sf, sys
sr=24000; rng=np.random.default_rng(0); d=sys.argv[1]
def sp(s):
    t=np.arange(int(s*sr))/sr; return 0.08*rng.standard_normal(len(t))*(0.6+0.4*np.sin(2*np.pi*4*t))
sf.write(d+'/chopped.wav', np.concatenate([np.zeros(2400), sp(1.5), np.zeros(4800)]), sr)
sf.write(d+'/sentinel.wav', np.concatenate([np.zeros(2400), sp(1.5), np.zeros(int(0.3*sr)), sp(0.25), np.zeros(2400)]), sr)
`;
if (run(py, ['-c', gen, tmp]).status !== 0) fail('could not create test audio');
const T = path.join(skill, 'scripts', 'tts_tail.py');
const f = (n) => path.join(tmp, n);
if (run(py, [T, 'check', f('chopped.wav')]).status !== 1) fail('chopped clip should fail');
if (run(py, [T, 'cut', f('sentinel.wav'), f('cut.wav')]).status !== 0) fail('cut failed');
if (run(py, [T, 'cut', f('chopped.wav'), f('x.wav')]).status !== 3) fail('no pause should exit 3');
if (run(py, [T, 'finish', f('chopped.wav'), f('fin.wav')]).status !== 0) fail('finish failed');
const c = run(py, [T, 'check', f('cut.wav'), f('fin.wav')]);
if (c.status !== 0) fail('fixed clips should pass: ' + c.stdout);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('tts-tail-fix ok: detects chop, cuts sentinel, finishes tail');
