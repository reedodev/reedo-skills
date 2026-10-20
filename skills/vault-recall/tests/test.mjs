// Self-contained test: builds a tiny temp vault and checks ranking, status bonus and caching.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'recall.mjs');
const v = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-vault-'));
const note = (name, fm, body) => fs.writeFileSync(path.join(v, name + '.md'), `---\n${fm}\n---\n${body}\n`);
note('유튜브 고정 댓글은 예약 공개 뒤에 단다', 'status: 직접확인\ntags: [youtube, upload]', '예약 공개 영상은 비공개 동안 댓글을 달 수 없으므로 공개 5분 뒤 다시 확인합니다.');
note('유튜브 고정 댓글 메모', 'status: 미검증\ntags: [youtube]', '고정 댓글을 달았던 날의 메모입니다.');
note('Blender render settings', 'tags: [3d]', 'Use Cycles with 128 samples for previews.');
fs.mkdirSync(path.join(v, '.obsidian'));
fs.writeFileSync(path.join(v, '.obsidian', 'ignored.md'), '유튜브 고정 댓글');

const run = (...a) => spawnSync('node', [script, v, ...a], { encoding: 'utf8' });
const r = run('유튜브 고정 댓글 예약 공개', '--json');
const j = JSON.parse(r.stdout);
const fail = (m) => { console.log('FAIL ' + m); process.exit(1); };
if (j.notes !== 3) fail('expected 3 notes (.obsidian ignored), got ' + j.notes);
if (!j.results[0].title.startsWith('유튜브 고정 댓글은 예약')) fail('verified, better-matching note should rank first');
if (j.results.some((x) => x.title.startsWith('Blender'))) fail('unrelated note matched');
if (!fs.existsSync(path.join(v, '.recall-cache.json'))) fail('cache not written');
const e = JSON.parse(run('cycles samples', '--json').stdout);
if (e.results[0]?.title !== 'Blender render settings') fail('english word match failed');
const nc = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rc-')), 'x');
fs.rmSync(path.join(v, '.recall-cache.json'));
run('유튜브', '--no-cache');
if (fs.existsSync(path.join(v, '.recall-cache.json'))) fail('--no-cache wrote a file');
fs.rmSync(v, { recursive: true, force: true });
console.log('vault-recall ok: ranking, status bonus, english, cache, --no-cache');
