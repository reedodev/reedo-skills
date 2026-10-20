#!/usr/bin/env node
/**
 * video-gate.mjs - check a video's DISPLAY aspect ratio before uploading it to a social platform.
 * Zero dependencies (Node 18+). Needs ffprobe (part of FFmpeg) on PATH or in FFPROBE_PATH.
 *
 *   node video-gate.mjs final.mp4 --target reels
 *   node video-gate.mjs final.mp4 --target youtube --json
 *
 * Targets
 *   reels | shorts | tiktok      9:16 vertical   (min 720x1280, recommended 1080x1920)
 *   youtube | threads-landscape  16:9 landscape  (min 1280x720, recommended 1920x1080)
 *   square                       1:1             (min 720x720,  recommended 1080x1080)
 *
 * The display size is what viewers see, not the encoded size:
 *   - rotation metadata (display matrix side data or the legacy `rotate` tag) swaps width/height at 90/270
 *   - a non-square sample aspect ratio (SAR) stretches the width
 * A 1920x1080 file tagged rotate=90 is shown as 1080x1920 (vertical). A file with SAR != 1:1 is
 * flagged because many upload pipelines ignore SAR and show squeezed or stretched people and text.
 *
 * Exit codes: 0 = PASS, 1 = FAIL (wrong ratio / too small / no video / SAR), 2 = usage or ffprobe error.
 * A PASS is a technical check only. Always look at the platform's real upload preview as well.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TARGETS = {
  reels: { ratio: [9, 16], min: [720, 1280], rec: [1080, 1920], label: 'Instagram Reels' },
  shorts: { ratio: [9, 16], min: [720, 1280], rec: [1080, 1920], label: 'YouTube Shorts' },
  tiktok: { ratio: [9, 16], min: [720, 1280], rec: [1080, 1920], label: 'TikTok' },
  youtube: { ratio: [16, 9], min: [1280, 720], rec: [1920, 1080], label: 'YouTube (landscape)' },
  'threads-landscape': { ratio: [16, 9], min: [1280, 720], rec: [1920, 1080], label: 'Threads (landscape clip)' },
  square: { ratio: [1, 1], min: [720, 720], rec: [1080, 1080], label: 'Square 1:1' },
};
const TOLERANCE = 0.01; // 1% ratio tolerance (e.g. 1080x1918 still counts as 9:16)

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const asJson = args.includes('--json');
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--target'));
const targetName = (opt('target') || '').toLowerCase();
const target = TARGETS[targetName];
if (!file || !target) {
  console.error(`usage: node video-gate.mjs <video> --target ${Object.keys(TARGETS).join('|')} [--json]`);
  process.exit(2);
}
if (!fs.existsSync(file)) { console.error('file not found: ' + file); process.exit(2); }

const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
const r = spawnSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path.resolve(file)],
  { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
if (r.error || r.status !== 0) {
  console.error('ffprobe failed: ' + (r.error ? r.error.message : (r.stderr || '').trim()) + '\n(Install FFmpeg or set FFPROBE_PATH.)');
  process.exit(2);
}
const probe = JSON.parse(r.stdout);
const streams = probe.streams || [];
const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
const a = streams.find((s) => s.codec_type === 'audio');

const problems = []; // { ko, en }
const warnings = [];
const report = { file: path.resolve(file), target: targetName, targetLabel: target.label, expectedRatio: target.ratio.join(':') };

if (!v || !v.width || !v.height) {
  problems.push({ ko: '영상 스트림이 없습니다.', en: 'No video stream found.' });
} else {
  // rotation: display matrix side data (newer FFmpeg) or rotate tag (older files)
  const sd = (v.side_data_list || []).find((d) => d.rotation !== undefined && Number.isFinite(Number(d.rotation)));
  const raw = sd ? Number(sd.rotation) : Number((v.tags && v.tags.rotate) || 0);
  const rotation = ((Math.round(raw) % 360) + 360) % 360;
  if (![0, 90, 180, 270].includes(rotation)) problems.push({ ko: `직각이 아닌 회전값(${rotation}도)입니다.`, en: `Non-right-angle rotation (${rotation} deg).` });

  // sample aspect ratio
  let sarNum = 1, sarDen = 1;
  const sar = v.sample_aspect_ratio;
  if (sar && sar !== 'N/A' && sar !== '0:1') {
    const [n, d] = sar.split(':').map(Number);
    if (n > 0 && d > 0) { sarNum = n; sarDen = d; }
  }
  const squarePixels = sarNum === sarDen;

  // display size: apply SAR to width first, then rotation
  let dw = Math.round((v.width * sarNum) / sarDen), dh = v.height;
  if (rotation === 90 || rotation === 270) [dw, dh] = [dh, dw];

  const fpsParts = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
  const fps = fpsParts[1] ? +(fpsParts[0] / fpsParts[1]).toFixed(3) : null;
  const duration = Number(v.duration || (probe.format && probe.format.duration)) || null;

  Object.assign(report, {
    encoded: { width: v.width, height: v.height },
    sampleAspectRatio: sar || 'not set',
    rotation,
    display: { width: dw, height: dh, ratio: +(dw / dh).toFixed(4) },
    durationSec: duration ? +duration.toFixed(2) : null,
    fps,
    videoCodec: v.codec_name,
    pixelFormat: v.pix_fmt,
    audio: a ? { codec: a.codec_name, channels: a.channels, sampleRate: Number(a.sample_rate) } : null,
  });

  const [rw, rh] = target.ratio;
  const want = rw / rh;
  const got = dw / dh;
  const ratioOk = Math.abs(got - want) / want <= TOLERANCE;
  if (!ratioOk) {
    const shape = got > 1.01 ? '가로' : got < 0.99 ? '세로' : '정사각';
    problems.push({
      ko: `화면에 보이는 크기가 ${dw}x${dh}(${shape} 영상)이어서 ${target.label}에 필요한 비율 ${rw}:${rh}에 맞지 않습니다.`,
      en: `Display size ${dw}x${dh} does not match the ${rw}:${rh} required for ${target.label}.`,
    });
  }
  if (!squarePixels) {
    problems.push({
      ko: `픽셀이 정사각형이 아닙니다(SAR ${sar}). 업로드 후 사람과 글자가 늘어나거나 찌그러질 수 있으니 정사각 픽셀로 다시 인코딩하세요.`,
      en: `Non-square pixels (SAR ${sar}). Re-encode with square pixels (e.g. -vf scale=...,setsar=1).`,
    });
  }
  const [mw, mh] = target.min;
  if (!ratioOk) {
    // resolution is judged only after the ratio is right
  } else if (dw < mw || dh < mh) {
    problems.push({ ko: `해상도가 너무 낮습니다(${dw}x${dh}, 최소 ${mw}x${mh}).`, en: `Resolution ${dw}x${dh} is below the minimum ${mw}x${mh}.` });
  } else if (dw < target.rec[0] || dh < target.rec[1]) {
    warnings.push({ ko: `권장 해상도 ${target.rec.join('x')}보다 작습니다.`, en: `Below the recommended ${target.rec.join('x')}.` });
  }
  if (rotation) warnings.push({ ko: `회전 정보(${rotation}도)로 화면 방향이 바뀌는 파일입니다. 일부 편집기·업로더는 회전을 무시하니 회전을 실제 픽셀에 적용해 다시 인코딩하는 편이 안전합니다.`, en: `Orientation comes from rotation metadata (${rotation} deg); some tools ignore it. Baking the rotation into pixels is safer.` });
  if (!a) warnings.push({ ko: '소리 트랙이 없습니다(의도한 것이면 괜찮습니다).', en: 'No audio track.' });
  if (fps && (fps < 23 || fps > 61)) warnings.push({ ko: `프레임 속도 ${fps}fps는 흔하지 않은 값입니다.`, en: `Unusual frame rate ${fps} fps.` });
}

report.status = problems.length ? 'FAIL' : 'PASS';
report.problems = problems;
report.warnings = warnings;
report.note = 'Technical check only. Look at the real upload preview too. 기술 검사만 통과한 것이니 실제 업로드 미리보기도 눈으로 확인하세요.';

if (asJson) console.log(JSON.stringify(report, null, 1));
else {
  const d = report.display;
  console.log(`${report.status}  ${path.basename(file)} -> ${target.label} (${report.expectedRatio})`);
  if (d) console.log(`  표시 ${d.width}x${d.height} | 인코딩 ${report.encoded.width}x${report.encoded.height} | 회전 ${report.rotation} | SAR ${report.sampleAspectRatio} | ${report.durationSec}s | ${report.fps}fps | ${report.videoCodec}/${report.pixelFormat} | 소리 ${report.audio ? report.audio.codec : '없음'}`);
  for (const p of problems) console.log(`  X ${p.ko}\n    ${p.en}`);
  for (const w of warnings) console.log(`  ! ${w.ko}\n    ${w.en}`);
  console.log('  ' + report.note);
}
process.exit(problems.length ? 1 : 0);
