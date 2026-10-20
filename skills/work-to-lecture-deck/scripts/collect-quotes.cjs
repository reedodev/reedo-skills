#!/usr/bin/env node
/**
 * 실제 작업 기록(Claude Code 세션 로그)에서 "내가 한 말"을 날짜와 함께 뽑는다.
 * 강의자료 카드의 '내가 한 말' 칸을 지어내지 않고 원문으로 채우기 위한 도구.
 *
 * 사용:
 *   node collect-quotes.cjs --project "<project-folder>" [--since 2026-10-01] [--until 2026-10-10]
 *        [--keyword 스토리보드,목소리] [--min 8] [--max 400] [--out quotes.json]
 *   node collect-quotes.cjs --list            (사용 가능한 프로젝트 폴더 목록)
 *
 * 기본 폴더: %USERPROFILE%\.claude\projects\<project>\*.jsonl
 * 사람이 직접 친 문장만 남긴다(도구 결과·시스템 알림·루틴이 자동으로 넣은 긴 지시문은 제외).
 * 출력은 KST 날짜 + 원문. 이름·회사·계정·금액 같은 개인정보는 사람이 직접 가린 뒤 슬라이드에 쓴다.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes('--' + k);

const root = path.join(os.homedir(), '.claude', 'projects');
if (has('list')) {
  for (const n of fs.readdirSync(root)) {
    const files = fs.readdirSync(path.join(root, n)).filter(f => f.endsWith('.jsonl')).length;
    console.log(`${n}\t(${files} sessions)`);
  }
  process.exit(0);
}

const project = get('project');
if (!project) { console.error('--project 가 필요합니다. --list 로 목록을 보세요.'); process.exit(1); }
const since = get('since') ? new Date(get('since') + 'T00:00:00+09:00') : null;
const until = get('until') ? new Date(get('until') + 'T23:59:59+09:00') : null;
const keywords = (get('keyword') || '').split(',').map(s => s.trim()).filter(Boolean);
const minLen = parseInt(get('min', '8'), 10);
const maxLen = parseInt(get('max', '400'), 10);
const out = get('out');

const dir = path.join(root, project);
const kst = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);
const rows = [];

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    if (j.type !== 'user' || j.isSidechain || j.isMeta) continue;
    const c = j.message && j.message.content;
    let text = '';
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c)) {
      if (c.some(b => b.type === 'tool_result')) continue;
      text = c.filter(b => b.type === 'text').map(b => b.text).join('\n');
    }
    text = text.trim();
    if (!text) continue;
    if (/^<(system-reminder|command-|local-command|task-notification)/.test(text)) continue;
    if (text.startsWith('[Request interrupted')) continue;
    if (text.length < minLen || text.length > maxLen) continue; // 긴 자동 지시문 제외
    const ts = new Date(j.timestamp);
    if (since && ts < since) continue;
    if (until && ts > until) continue;
    if (keywords.length && !keywords.some(k => text.includes(k))) continue;
    rows.push({ at: kst(ts), session: (j.sessionId || '').slice(0, 8), text });
  }
}
rows.sort((a, b) => a.at.localeCompare(b.at));

if (out) { fs.writeFileSync(out, JSON.stringify(rows, null, 2), 'utf8'); console.log(`saved ${rows.length} quotes -> ${out}`); }
else for (const r of rows) console.log(`[${r.at}] ${r.text.replace(/\s+/g, ' ')}`);
