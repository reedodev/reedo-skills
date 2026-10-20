// Makes synthetic clips with ffmpeg and checks the gate verdicts. Exit 77 = skipped (no ffmpeg).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'video-gate.mjs');
if (spawnSync('ffmpeg', ['-version']).status !== 0 || spawnSync('ffprobe', ['-version']).status !== 0) { console.log('SKIP: ffmpeg/ffprobe not found'); process.exit(77); }
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vgate-'));
const mk = (name, size, extra = []) => spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc=size=${size}:rate=30:duration=1`, ...extra, '-pix_fmt', 'yuv420p', path.join(d, name)]).status === 0;
if (!mk('v916.mp4', '1080x1920') || !mk('v169.mp4', '1920x1080') || !mk('vsar.mp4', '1440x1920', ['-vf', 'setsar=4/3'])) { console.log('FAIL: could not create clips'); process.exit(1); }
const gate = (f, t) => spawnSync('node', [script, path.join(d, f), '--target', t], { encoding: 'utf8' }).status;
const cases = [['v916.mp4', 'reels', 0], ['v169.mp4', 'reels', 1], ['v169.mp4', 'youtube', 0], ['vsar.mp4', 'reels', 1], ['v916.mp4', 'square', 1]];
const bad = cases.filter(([f, t, want]) => gate(f, t) !== want);
fs.rmSync(d, { recursive: true, force: true });
if (bad.length) { console.log('FAIL', JSON.stringify(bad)); process.exit(1); }
console.log(`social-video-gate ok: ${cases.length} cases (9:16, 16:9, non-square pixels, square)`);
