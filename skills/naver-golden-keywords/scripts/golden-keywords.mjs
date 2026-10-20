#!/usr/bin/env node
/**
 * golden-keywords.mjs - score Naver blog keyword ideas by search volume vs. competition.
 * Node 18+, no dependencies. Uses only the two OFFICIAL Naver APIs:
 *   - Search Ad API  /keywordstool   -> monthly PC + mobile searches (+ related keywords)
 *   - Open API       /v1/search/blog -> number of blog documents for the keyword
 *
 *   node golden-keywords.mjs 캠핑의자 "가을 캠핑 준비물" 접이식테이블
 *   node golden-keywords.mjs --file seeds.txt --related 20 --csv out.csv
 *   node golden-keywords.mjs 캠핑의자 --json
 *
 * Credentials (environment variables, or a .env file in the current folder):
 *   NAVER_AD_API_KEY, NAVER_AD_SECRET, NAVER_AD_CUSTOMER_ID   (searchad.naver.com > 도구 > API 사용 관리)
 *   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET                       (developers.naver.com > 애플리케이션 > 검색 API)
 * Credential values are never printed.
 *
 * Score
 *   ratio = blog documents / monthly searches (PC + mobile)
 *   S: searches >= 2,000 and ratio <= 0.1
 *   A: searches >= 1,000 and ratio <= 0.5
 *   B: searches >=   500 and ratio <= 2
 *   - : everything else
 * Keywords containing sensitive terms are flagged (제외 = never use, 주의 = judge yourself).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const valued = new Set(['file', 'related', 'csv']);
const seeds = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { if (valued.has(argv[i].slice(2))) i++; continue; }
  seeds.push(argv[i]);
}
if (opt('file')) seeds.push(...fs.readFileSync(opt('file'), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
const SELF_TEST = flag('self-test');
if (!SELF_TEST && !seeds.length) { console.error('usage: node golden-keywords.mjs <keyword...> [--file seeds.txt] [--related N] [--csv out.csv] [--json]'); process.exit(2); }

// ---------- env ----------
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const need = ['NAVER_AD_API_KEY', 'NAVER_AD_SECRET', 'NAVER_AD_CUSTOMER_ID', 'NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET'];
const missing = need.filter((k) => !process.env[k]);
if (!SELF_TEST && missing.length) { console.error('missing credentials: ' + missing.join(', ') + ' (see SKILL.md)'); process.exit(2); }
const E = process.env;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s).replace(/\s+/g, '').toUpperCase();
const toNum = (v) => (typeof v === 'number' ? v : /</.test(String(v)) ? 5 : Number(String(v).replace(/[^0-9]/g, '')) || 0); // "< 10" -> 5

// ---------- APIs ----------
async function keywordTool(hints) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ts = String(Date.now());
    const uri = '/keywordstool';
    const sig = crypto.createHmac('sha256', E.NAVER_AD_SECRET).update(`${ts}.GET.${uri}`).digest('base64');
    const url = `https://api.searchad.naver.com${uri}?hintKeywords=${hints.map((h) => encodeURIComponent(h.replace(/\s+/g, ''))).join(',')}&showDetail=1`;
    const r = await fetch(url, { headers: { 'X-Timestamp': ts, 'X-API-KEY': E.NAVER_AD_API_KEY, 'X-Customer': String(E.NAVER_AD_CUSTOMER_ID), 'X-Signature': sig } });
    if (r.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(`searchad HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return (await r.json()).keywordList || [];
  }
  throw new Error('searchad rate limited');
}

async function blogTotal(kw) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch('https://openapi.naver.com/v1/search/blog.json?display=1&query=' + encodeURIComponent(kw), {
      headers: { 'X-Naver-Client-Id': E.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': E.NAVER_CLIENT_SECRET },
    });
    if (r.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(`openapi HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return Number((await r.json()).total) || 0;
  }
  throw new Error('openapi rate limited');
}

// ---------- sensitive terms ----------
const BLOCK = ['사망', '추락', '살인', '자살', '성폭행', '성범죄', '마약', '도박', '카지노', '토토', '전자담배', '불륜'];
const CAUTION = ['증상', '효능', '부작용', '치료', '대출', '코인', '주식', '열애', '이혼', '루머', '논란', '사고', '사건', '체포', '별세', '부고', '사생활'];
const flagOf = (kw) => (BLOCK.some((t) => kw.includes(t)) ? '제외' : CAUTION.some((t) => kw.includes(t)) ? '주의' : '');

function grade(vol, ratio) {
  if (vol >= 2000 && ratio <= 0.1) return 'S';
  if (vol >= 1000 && ratio <= 0.5) return 'A';
  if (vol >= 500 && ratio <= 2) return 'B';
  return '-';
}

// ---------- self test (no network) ----------
if (SELF_TEST) {
  const cases = [[grade(2500, 0.05), 'S'], [grade(1500, 0.4), 'A'], [grade(600, 1.9), 'B'], [grade(600, 2.5), '-'], [toNum('< 10'), 5], [toNum('1,234'), 1234], [flagOf('카지노 후기'), '제외'], [flagOf('대출 금리'), '주의'], [flagOf('캠핑의자'), '']];
  const bad = cases.filter(([got, want]) => got !== want);
  console.log(bad.length ? 'SELF-TEST FAIL ' + JSON.stringify(bad) : 'SELF-TEST OK (' + cases.length + ' cases)');
  process.exit(bad.length ? 1 : 0);
}

// ---------- main ----------
const related = Number(opt('related', 0));
const volumes = new Map(); // norm -> {kw, pc, mo, comp}
const relatedPool = [];
for (let i = 0; i < seeds.length; i += 5) {
  const batch = seeds.slice(i, i + 5);
  const list = await keywordTool(batch);
  for (const k of list) {
    const row = { kw: k.relKeyword, pc: toNum(k.monthlyPcQcCnt), mo: toNum(k.monthlyMobileQcCnt), comp: k.compIdx || '' };
    volumes.set(norm(k.relKeyword), row);
    relatedPool.push(row);
  }
  await sleep(250);
}

const targets = [];
const seen = new Set();
for (const s of seeds) {
  const v = volumes.get(norm(s));
  targets.push(v ? { ...v, kw: s } : { kw: s, pc: 0, mo: 0, comp: '', noVolume: true });
  seen.add(norm(s));
}
if (related > 0) {
  relatedPool.sort((a, b) => b.pc + b.mo - (a.pc + a.mo));
  for (const r of relatedPool) {
    if (targets.length >= seeds.length + related) break;
    if (seen.has(norm(r.kw))) continue;
    seen.add(norm(r.kw));
    targets.push({ ...r, related: true });
  }
}

for (const t of targets) {
  t.vol = t.pc + t.mo;
  try { t.docs = await blogTotal(t.kw); } catch (e) { t.docs = null; t.error = e.message; }
  t.ratio = t.docs != null && t.vol > 0 ? +(t.docs / t.vol).toFixed(3) : null;
  t.grade = t.ratio != null ? grade(t.vol, t.ratio) : '?';
  t.flag = flagOf(t.kw);
  await sleep(120);
}

const order = { S: 0, A: 1, B: 2, '-': 3, '?': 4 };
targets.sort((a, b) => order[a.grade] - order[b.grade] || (a.ratio ?? 1e9) - (b.ratio ?? 1e9));

if (opt('csv')) {
  const head = 'grade,keyword,monthly_searches,pc,mobile,blog_docs,ratio,competition,flag,related\n';
  const body = targets.map((t) => [t.grade, `"${t.kw}"`, t.vol, t.pc, t.mo, t.docs ?? '', t.ratio ?? '', t.comp, t.flag, t.related ? 'y' : ''].join(',')).join('\n');
  fs.writeFileSync(opt('csv'), '\ufeff' + head + body + '\n', 'utf8');
}
if (flag('json')) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), keywords: targets }, null, 1));
} else {
  console.log('등급  월검색량   문서수      경쟁률   키워드');
  for (const t of targets) {
    console.log(`${t.grade.padEnd(4)}  ${String(t.vol).padStart(8)}  ${String(t.docs ?? '?').padStart(9)}  ${String(t.ratio ?? '?').padStart(8)}   ${t.kw}${t.related ? ' (연관)' : ''}${t.flag ? ' [' + t.flag + ']' : ''}${t.noVolume ? ' (검색량 없음)' : ''}`);
  }
  console.log(`\n${targets.filter((t) => 'SAB'.includes(t.grade)).length}/${targets.length} 개가 B등급 이상입니다. 검색량은 최근 30일 기준, 문서수는 조회 시점 기준입니다.`);
}
