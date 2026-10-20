#!/usr/bin/env node
/**
 * End-to-end tests for every skill script. No network, no credentials.
 *   node tests/run.mjs            run all
 *   node tests/run.mjs tone tts   run selected
 * Python: set PYTHON (default python3, then python). Tests whose Python module is
 * missing are reported as SKIP locally; CI installs everything so nothing is skipped there.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = (...p) => path.join(root, 'skills', ...p);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reedo-skills-'));
const only = process.argv.slice(2);
const results = [];

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd || root, env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...(opts.env || {}) } });
function pickPython(modules) {
  const cands = [process.env.PYTHON, 'python3', 'python'].filter(Boolean);
  for (const p of cands) {
    const r = run(p, ['-c', `import ${modules}`]);
    if (r.status === 0) return p;
  }
  return null;
}
async function test(name, fn) {
  if (only.length && !only.some((o) => name.startsWith(o))) return;
  try {
    const r = await fn();
    results.push([r === 'SKIP' ? 'SKIP' : 'PASS', name, typeof r === 'string' && r !== 'SKIP' ? r : '']);
  } catch (e) {
    results.push(['FAIL', name, String(e.message || e).slice(0, 400)]);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---------- korean-tone-check ----------
await test('tone: sample has 3 speech-level problems', () => {
  const r = run('node', [S('korean-tone-check', 'scripts', 'check-tone.mjs'), S('korean-tone-check', 'examples', 'sample.md'), '--json']);
  const j = JSON.parse(r.stdout);
  expect(r.status === 1, 'exit should be 1, got ' + r.status);
  expect(j.endingProblems === 3, 'expected 3 ending problems, got ' + j.endingProblems);
});
await test('tone: clean polite text passes', () => {
  const f = path.join(tmp, 'clean.md');
  fs.writeFileSync(f, '설정은 한 번만 하면 되는데, 그다음부터는 매일 같은 시간에 자동으로 실행됩니다.\n궁금한 점이 있으면 댓글로 남겨 주세요.\n#자동화\n');
  const r = run('node', [S('korean-tone-check', 'scripts', 'check-tone.mjs'), f]);
  expect(r.status === 0, 'exit should be 0: ' + r.stdout);
});
await test('tone: decimals and links do not split sentences', () => {
  const f = path.join(tmp, 'num.md');
  fs.writeFileSync(f, '버전 1.5 문서는 [여기](https://example.com/a.b)에서 받을 수 있습니다.\n');
  const j = JSON.parse(run('node', [S('korean-tone-check', 'scripts', 'check-tone.mjs'), f, '--json']).stdout);
  expect(j.sentences === 1, 'expected 1 sentence, got ' + j.sentences);
});

// ---------- naver-golden-keywords ----------
await test('naver: offline self-test (grading, parsing, flags)', () => {
  const r = run('node', [S('naver-golden-keywords', 'scripts', 'golden-keywords.mjs'), '--self-test']);
  expect(r.status === 0, r.stdout + r.stderr);
});

// ---------- hwpx-form-fill ----------
await test('hwpx: fill by label, verify from disk, refuse overwrite', () => {
  const py = pickPython('hwpx; from hwpx import HwpxDocument');
  if (!py) return 'SKIP';
  const out = path.join(tmp, 'filled.hwpx');
  const r = run(py, [S('hwpx-form-fill', 'scripts', 'hwpx_form.py'), 'fill', S('hwpx-form-fill', 'examples', 'form-sample.hwpx'), S('hwpx-form-fill', 'examples', 'values.example.json'), out]);
  expect(r.status === 0, 'fill exit ' + r.status + ' ' + r.stdout + r.stderr);
  const j = JSON.parse(r.stdout);
  expect(j.filled.length === 4 && j.filled.every((x) => x.verified), 'not all verified');
  const v2 = path.join(tmp, 'v2.json');
  fs.writeFileSync(v2, JSON.stringify({ '성명': '다른 이름', '없는칸': 'x' }));
  const r2 = run(py, [S('hwpx-form-fill', 'scripts', 'hwpx_form.py'), 'fill', out, v2, path.join(tmp, 'f2.hwpx')]);
  const j2 = JSON.parse(r2.stdout);
  expect(r2.status === 1 && j2.skipped_filled.length === 1 && j2.missing.length === 1, 'guard failed: ' + r2.stdout);
});

// ---------- tts-tail-fix ----------
await test('tts: detects chop, cuts sentinel, finishes tail', () => {
  const py = pickPython('numpy, soundfile');
  if (!py) return 'SKIP';
  const gen = `
import numpy as np, soundfile as sf, sys
sr=24000; rng=np.random.default_rng(0); d=sys.argv[1]
def sp(s):
    t=np.arange(int(s*sr))/sr; return 0.08*rng.standard_normal(len(t))*(0.6+0.4*np.sin(2*np.pi*4*t))
sf.write(d+'/chopped.wav', np.concatenate([np.zeros(2400), sp(1.5), np.zeros(4800)]), sr)
sf.write(d+'/sentinel.wav', np.concatenate([np.zeros(2400), sp(1.5), np.zeros(int(0.3*sr)), sp(0.25), np.zeros(2400)]), sr)
`;
  expect(run(py, ['-c', gen, tmp]).status === 0, 'could not create test audio');
  const T = S('tts-tail-fix', 'scripts', 'tts_tail.py');
  expect(run(py, [T, 'check', path.join(tmp, 'chopped.wav')]).status === 1, 'chopped clip should fail');
  expect(run(py, [T, 'cut', path.join(tmp, 'sentinel.wav'), path.join(tmp, 'cut.wav')]).status === 0, 'cut failed');
  expect(run(py, [T, 'cut', path.join(tmp, 'chopped.wav'), path.join(tmp, 'x.wav')]).status === 3, 'no-pause should exit 3');
  expect(run(py, [T, 'finish', path.join(tmp, 'chopped.wav'), path.join(tmp, 'fin.wav')]).status === 0, 'finish failed');
  const c = run(py, [T, 'check', path.join(tmp, 'cut.wav'), path.join(tmp, 'fin.wav')]);
  expect(c.status === 0, 'fixed clips should pass: ' + c.stdout);
});

// ---------- work-to-lecture-deck ----------
await test('deck: example builds into one HTML file', () => {
  const out = path.join(tmp, 'deck.html');
  const r = run('node', [S('work-to-lecture-deck', 'scripts', 'build-deck.cjs'), S('work-to-lecture-deck', 'examples', 'deck.json'), out]);
  expect(r.status === 0 && fs.existsSync(out), r.stderr);
  const html = fs.readFileSync(out, 'utf8');
  expect(html.includes('매주 보고서') && !html.includes('/*DECK_JSON*/null'), 'deck data not injected');
});

// ---------- optional skills added later: run their own test hooks if present ----------
for (const dir of fs.readdirSync(path.join(root, 'skills'))) {
  const hook = S(dir, 'tests', 'test.mjs');
  if (!fs.existsSync(hook)) continue;
  await test(`${dir}: tests/test.mjs`, () => {
    const r = run('node', [hook], { cwd: S(dir) });
    if (r.status === 77) return 'SKIP';
    expect(r.status === 0, (r.stdout + r.stderr).slice(-400));
    return (r.stdout.trim().split('\n').pop() || '').slice(0, 120);
  });
}

fs.rmSync(tmp, { recursive: true, force: true });
for (const [s, n, m] of results) console.log(`${s.padEnd(4)}  ${n}${m ? '  -> ' + m : ''}`);
const fail = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - fail}/${results.length} ok${fail ? `, ${fail} failed` : ''}`);
process.exit(fail ? 1 : 0);
