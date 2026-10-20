#!/usr/bin/env node
/**
 * recall.mjs - find the notes in an Obsidian / markdown vault that matter for the task at hand.
 * Zero dependencies, Node 18+. Works with Korean (character bigrams) and English (words).
 *
 *   node recall.mjs <vaultDir> "유튜브 고정 댓글 예약 공개" [--top 5] [--tags youtube,upload] [--json]
 *   node recall.mjs <vaultDir> --reindex          rebuild the cache now
 *
 * Scoring per note (higher is better)
 *   title match x3, tag match x2, body match x1 (bigram/word overlap, length-normalised)
 *   + status bonus from front matter: verified/확인 +30%, unverified/미검증 -15%
 *   + recency bonus: updated/created within 30 days +10%
 * The index is cached in <vault>/.recall-cache.json (mtime based) so repeat lookups are fast.
 * The script only READS notes. It never edits the vault except for the cache file
 * (use --no-cache to avoid writing anything).
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const valued = new Set(['top', 'tags', 'cache']);
const pos = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { if (valued.has(argv[i].slice(2))) i++; continue; } pos.push(argv[i]); }
const [vault, query = ''] = pos;
if (!vault || (!query && !flag('reindex'))) {
  console.error('usage: node recall.mjs <vaultDir> "<task or question>" [--top 5] [--tags a,b] [--json] [--no-cache] [--reindex]');
  process.exit(2);
}
if (!fs.existsSync(vault)) { console.error('vault not found: ' + vault); process.exit(2); }

const SKIP_DIRS = new Set(['.obsidian', '.git', '.trash', 'node_modules']);
const cachePath = opt('cache', path.join(vault, '.recall-cache.json'));
const useCache = !flag('no-cache');

// ---------- text features ----------
const norm = (s) => s.toLowerCase().normalize('NFC');
function features(s) {
  const out = new Map();
  const t = norm(s);
  for (const w of t.match(/[a-z0-9][a-z0-9._-]{1,}/g) || []) out.set(w, (out.get(w) || 0) + 1);
  for (const run of t.match(/[\uac00-\ud7a3]+/g) || []) {
    if (run.length === 1) { out.set(run, (out.get(run) || 0) + 1); continue; }
    for (let i = 0; i < run.length - 1; i++) { const g = run.slice(i, i + 2); out.set(g, (out.get(g) || 0) + 1); }
  }
  return out;
}
const toObj = (m) => Object.fromEntries(m);

// ---------- parse ----------
function parseNote(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const fm = {};
  let body = raw;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    body = raw.slice(m[0].length);
    let key = null;
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([\w가-힣_-]+):\s*(.*)$/);
      if (kv) { key = kv[1]; fm[key] = kv[2].replace(/^["']|["']$/g, ''); continue; }
      const li = line.match(/^\s*-\s*(.+)$/);
      if (li && key) fm[key] = (fm[key] ? fm[key] + ',' : '') + li[1].replace(/^["']|["']$/g, '');
    }
  }
  const title = fm.title || path.basename(file, '.md');
  const tags = [...String(fm.tags || '').replace(/[\[\]]/g, '').split(/[,\s]+/), ...(body.match(/(^|\s)#([\w가-힣/_-]+)/g) || []).map((t) => t.trim().slice(1))]
    .map((t) => t.trim()).filter(Boolean);
  const status = String(fm.status || fm['상태'] || '');
  const date = String(fm.updated || fm.created || '');
  const clean = body.replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1');
  return { title, tags, status, date, body: clean };
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.isDirectory()) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

// ---------- index ----------
function buildIndex() {
  let cache = {};
  if (useCache && fs.existsSync(cachePath) && !flag('reindex')) {
    try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')).notes || {}; } catch { cache = {}; }
  }
  const files = walk(vault);
  const notes = {};
  let parsed = 0;
  for (const f of files) {
    const rel = path.relative(vault, f);
    const mtime = fs.statSync(f).mtimeMs;
    if (cache[rel] && cache[rel].mtime === mtime) { notes[rel] = cache[rel]; continue; }
    const n = parseNote(f);
    parsed++;
    notes[rel] = {
      mtime, title: n.title, tags: n.tags, status: n.status, date: n.date,
      excerpt: n.body.replace(/\s+/g, ' ').trim().slice(0, 240),
      ft: toObj(features(n.title)), fg: toObj(features(n.tags.join(' '))), fb: toObj(features(n.body.slice(0, 6000))),
      blen: Math.max(1, Math.min(6000, n.body.length)),
    };
  }
  if (useCache) fs.writeFileSync(cachePath, JSON.stringify({ version: 1, builtAt: new Date().toISOString(), notes }));
  return { notes, parsed, total: files.length };
}

const t0 = Date.now();
const { notes, parsed, total } = buildIndex();
if (flag('reindex') && !query) { console.log(`indexed ${total} notes (${parsed} parsed) in ${Date.now() - t0} ms`); process.exit(0); }

// ---------- score ----------
const q = features(query + ' ' + String(opt('tags', '')).replace(/,/g, ' '));
const wantTags = String(opt('tags', '')).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const overlap = (f) => { let s = 0; for (const [k, v] of q) if (f[k]) s += Math.min(v, f[k]); return s; };
const now = Date.now();
const rows = [];
for (const [rel, n] of Object.entries(notes)) {
  let s = overlap(n.ft) * 3 + overlap(n.fg) * 2 + overlap(n.fb) / Math.sqrt(n.blen / 400);
  if (!s) continue;
  if (wantTags.length && n.tags.some((t) => wantTags.some((w) => t.toLowerCase().includes(w)))) s *= 1.25;
  const st = n.status.toLowerCase();
  if (/verified|확인|confirmed/.test(st) && !/미|un/.test(st)) s *= 1.3;
  else if (/미검증|unverified|draft|추정/.test(st)) s *= 0.85;
  const d = Date.parse(n.date);
  if (d && now - d < 30 * 86400e3) s *= 1.1;
  rows.push({ score: +s.toFixed(2), path: rel, title: n.title, status: n.status || null, date: n.date || null, tags: n.tags.slice(0, 6), excerpt: n.excerpt });
}
rows.sort((a, b) => b.score - a.score);
const top = rows.slice(0, Number(opt('top', 5)));

if (flag('json')) {
  console.log(JSON.stringify({ query, vault: path.resolve(vault), notes: total, matched: rows.length, ms: Date.now() - t0, results: top, read_next: top.slice(0, 2).map((r) => r.path) }, null, 1));
} else {
  console.log(`${total} notes, ${rows.length} matched, ${Date.now() - t0} ms`);
  top.forEach((r, i) => console.log(`\n${i + 1}. ${r.title}  [${r.score}]${r.status ? '  상태:' + r.status : ''}${r.date ? '  ' + r.date : ''}\n   ${r.path}\n   ${r.excerpt.slice(0, 160)}`));
  if (!top.length) console.log('관련 노트를 찾지 못했습니다. 다른 표현으로 다시 찾거나, 없으면 기존 방식대로 진행하세요.');
}
