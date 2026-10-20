#!/usr/bin/env node
/**
 * publish-gate.mjs - refuse to call a YouTube upload "done" until every video has a proper
 * custom thumbnail and a pinned comment (or a scheduled follow-up for scheduled releases).
 * Zero dependencies, Node 18+.
 *
 *   node publish-gate.mjs thumb <image>  [--kind long|short]     check one thumbnail file
 *   node publish-gate.mjs check <publish.json>                     check a whole upload batch
 *
 * publish.json
 * {
 *   "videos": [
 *     { "id": "abc123", "kind": "long",  "thumbnail": "thumb.jpg", "thumbnailVerifiedOnChannel": true,
 *       "visibility": "public", "pinnedComment": { "text": "...", "pinnedVerified": true } },
 *     { "id": "def456", "kind": "short", "thumbnail": "short.jpg", "thumbnailVerifiedOnChannel": false,
 *       "visibility": "scheduled", "publishAt": "2026-10-21T09:00:00+09:00",
 *       "pinnedComment": { "text": "...", "followUpTask": "task-id-or-reminder" } },
 *     { "id": "kids1", "kind": "long", "madeForKids": true, ... }       // comments disabled: pin not required
 *   ]
 * }
 * Exit 0 = all done. Exit 1 = something is missing (printed per video). Exit 2 = usage error.
 */
import fs from 'node:fs';
import path from 'node:path';

const [cmd, target] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
if (!cmd || !target) { console.error('usage: node publish-gate.mjs thumb <image> [--kind long|short] | check <publish.json>'); process.exit(2); }

// ---------- image header parsing (PNG, JPEG, WebP) ----------
function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { type: 'jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { type: 'webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { type: 'webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return { type: 'webp', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

function checkThumb(file, kind) {
  const problems = [];
  if (!file || !fs.existsSync(file)) return { ok: false, problems: ['썸네일 파일이 없습니다 (thumbnail missing)'] };
  const buf = fs.readFileSync(file);
  const info = imageSize(buf);
  if (!info) return { ok: false, problems: ['PNG/JPEG/WebP가 아니거나 읽을 수 없습니다'] };
  const mb = buf.length / 1024 / 1024;
  if (mb > 2) problems.push(`용량 ${mb.toFixed(2)}MB > 2MB (YouTube 제한)`);
  if (!['png', 'jpeg'].includes(info.type)) problems.push(`${info.type} 형식은 JPG나 PNG로 바꾸는 것이 안전합니다`);
  const ratio = info.w / info.h;
  if (kind === 'short') {
    if (Math.abs(ratio - 9 / 16) > 0.01) problems.push(`쇼츠 썸네일 비율 ${info.w}x${info.h}가 9:16이 아닙니다`);
    if (info.h < 1280) problems.push(`쇼츠 썸네일 높이 ${info.h} < 1280 (1080x1920 권장)`);
  } else {
    if (Math.abs(ratio - 16 / 9) > 0.01) problems.push(`롱폼 썸네일 비율 ${info.w}x${info.h}가 16:9가 아닙니다`);
    if (info.w < 1280) problems.push(`롱폼 썸네일 너비 ${info.w} < 1280 (1280x720 이상 권장)`);
  }
  return { ok: !problems.length, problems, ...info, mb: +mb.toFixed(2) };
}

if (cmd === 'thumb') {
  const r = checkThumb(target, opt('kind', 'long'));
  console.log(r.ok ? `OK   ${target} ${r.w}x${r.h} ${r.type} ${r.mb}MB` : `FAIL ${target}\n - ${r.problems.join('\n - ')}`);
  process.exit(r.ok ? 0 : 1);
}

if (cmd === 'check') {
  const base = path.dirname(path.resolve(target));
  const { videos = [] } = JSON.parse(fs.readFileSync(target, 'utf8'));
  let bad = 0;
  for (const v of videos) {
    const p = [];
    const kind = v.kind === 'short' ? 'short' : 'long';
    const t = checkThumb(v.thumbnail && path.resolve(base, v.thumbnail), kind);
    if (!t.ok) p.push(...t.problems);
    if (!v.thumbnailVerifiedOnChannel) p.push('채널 화면에서 맞춤 썸네일이 보이는지 아직 확인하지 않았습니다');
    if (!v.madeForKids && !v.skipPinnedComment) {
      const pc = v.pinnedComment || {};
      if (!pc.text) p.push('고정 댓글 문구가 없습니다');
      const scheduled = ['scheduled', 'private', 'unlisted-then-public'].includes(v.visibility);
      if (scheduled) {
        if (!pc.pinnedVerified && !pc.followUpTask) p.push('예약 공개인데 공개 뒤 고정 댓글을 달 후속 작업(followUpTask)이 없습니다');
      } else if (!pc.pinnedVerified) {
        p.push('새로고침 뒤 "고정함" 표시를 아직 확인하지 않았습니다');
      }
    }
    const label = `${kind === 'short' ? '쇼츠' : '롱폼'} ${v.id || '(no id)'}`;
    if (p.length) { bad++; console.log(`FAIL ${label}\n - ${p.join('\n - ')}`); }
    else console.log(`OK   ${label}`);
  }
  console.log(bad ? `\n${bad}/${videos.length}개 영상이 아직 게시 완료가 아닙니다.` : `\n${videos.length}개 영상 모두 게시 완료 조건을 통과했습니다.`);
  process.exit(bad ? 1 : 0);
}
console.error('unknown command: ' + cmd);
process.exit(2);
