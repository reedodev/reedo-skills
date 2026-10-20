#!/usr/bin/env node
/**
 * build-data.mjs - read an Obsidian / markdown vault (read-only) and build data.js for the 3D brain viewer.
 *
 *   node scripts/build-data.mjs <vaultDir>                      -> ./brain-site/ (viewer + data.js)
 *   node scripts/build-data.mjs <vaultDir> --site <dir>         -> complete viewer bundle in <dir>
 *   node scripts/build-data.mjs <vaultDir> --out <file.js>      -> only data.js
 *
 * Options
 *   --group-by auto|folder|type|tag  how notes are split into the 6 regions (default auto)
 *   --title "My Brain"               title shown in the header (default: vault folder name)
 *   --hide-titles                    replace note titles with "<group> #n" (safe public sharing)
 *   --hide-groups                    also replace group names with "Group A..F"
 *   --exclude-hubs <N|auto>          do not DRAW links touching notes with more than N links
 *                                    (index / MOC notes). Stats still count them. default auto
 *   --max-edges <N>                  max links drawn (default 5500)
 *   --ignore "Templates,Archive"     extra folder names to skip (dot-folders are always skipped)
 *   --ok-status "verified,done"      status values treated as confirmed (bigger dots)
 *   --recent-days <N>                window for "recent" glow (default 7)
 *   --chart-days <N>                 days shown in the daily chart (default 30)
 *
 * The vault is only read. Nothing inside it is written or renamed.
 */
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const VIEWER = path.join(here, '..', 'viewer');

// ---------- args ----------
const argv = process.argv.slice(2);
const VALUED = new Set(['site', 'out', 'group-by', 'title', 'exclude-hubs', 'max-edges', 'ignore', 'ok-status', 'recent-days', 'chart-days']);
const opts = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); if (VALUED.has(k)) opts[k] = argv[++i]; else opts[k] = true; }
  else pos.push(a);
}
const vault = pos[0];
if (!vault || !fss.existsSync(vault) || !fss.statSync(vault).isDirectory()) {
  console.error('usage: node build-data.mjs <vaultDir> [--site dir | --out data.js] [--group-by auto|folder|type|tag] [--hide-titles] ...');
  process.exit(2);
}
const t0 = Date.now();
const groupBy = opts['group-by'] || 'auto';
const maxEdges = Number(opts['max-edges'] || 5500);
const ignore = new Set(String(opts.ignore || '').split(',').map((s) => s.trim()).filter(Boolean));
const okStatus = String(opts['ok-status'] || 'verified,confirmed,done,evergreen,완료,확인,확인됨')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const recentDays = Number(opts['recent-days'] || 7);
const chartDays = Number(opts['chart-days'] || 30);

// ---------- read vault ----------
async function walk(d, rel = '') {
  let out = [];
  for (const e of await fs.readdir(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ignore.has(e.name) || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) out = out.concat(await walk(p, rel ? rel + '/' + e.name : e.name));
    else if (e.name.toLowerCase().endsWith('.md')) out.push({ file: p, rel: rel ? rel + '/' + e.name : e.name });
  }
  return out;
}
const day = (s) => { const m = String(s || '').match(/(\d{4})[-./](\d{2})[-./](\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
const isoDay = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const unq = (s) => String(s).trim().replace(/^["']|["']$/g, '');

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  let lastKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_\-가-힣]+):\s*(.*)$/);
    if (kv) { lastKey = kv[1].toLowerCase(); const v = kv[2].trim(); fm[lastKey] = v === '' ? [] : v; continue; }
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && lastKey) { if (!Array.isArray(fm[lastKey])) fm[lastKey] = fm[lastKey] ? [fm[lastKey]] : []; fm[lastKey].push(unq(li[1])); }
  }
  return { fm, body: text.slice(m[0].length) };
}
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').replace(/[\[\]]/g, '').split(',')).map(unq).map((s) => s.replace(/^#/, '')).filter(Boolean);
const scalar = (v) => (Array.isArray(v) ? unq(v[0] || '') : unq(v || ''));

const files = await walk(vault);
const docs = [];
for (const f of files) {
  const [text, st] = await Promise.all([fs.readFile(f.file, 'utf8'), fs.stat(f.file)]);
  const { fm, body } = frontmatter(text);
  const clean = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const links = [];
  for (const m of clean.matchAll(/\[\[([^\]|#^]+)/g)) links.push(m[1].trim());
  for (const m of clean.matchAll(/\]\(([^)\s]+?\.md)\)/gi)) { try { links.push(decodeURIComponent(m[1])); } catch { links.push(m[1]); } }
  const tags = listOf(fm.tags || fm.tag);
  if (!tags.length) for (const m of clean.matchAll(/(?:^|\s)#([^\s#.,;:!?()\[\]{}"']+)/g)) { tags.push(m[1]); if (tags.length > 3) break; }
  const base = path.basename(f.file, path.extname(f.file));
  const fileDay = day(base);
  const created = day(scalar(fm.created || fm.date || fm.created_at)) || fileDay || isoDay(st.birthtime < st.mtime ? st.birthtime : st.mtime);
  const updated = day(scalar(fm.updated || fm.modified || fm.updated_at)) || isoDay(st.mtime);
  docs.push({
    base, rel: f.rel,
    title: scalar(fm.title) || base,
    folder: f.rel.includes('/') ? f.rel.split('/')[0] : '(root)',
    type: scalar(fm.type || fm.category || fm.kind),
    tag: tags[0] ? tags[0].split('/')[0] : '',
    status: scalar(fm.status),
    created, updated, links,
  });
}
if (!docs.length) { console.error('no .md files found in ' + vault); process.exit(1); }

// ---------- links ----------
const idx = new Map();
const key = (s) => String(s).replace(/\\/g, '/').split('/').pop().replace(/\.md$/i, '').trim().toLowerCase();
docs.forEach((d, i) => { if (!idx.has(key(d.base))) idx.set(key(d.base), i); });
docs.forEach((d, i) => { if (!idx.has(key(d.title))) idx.set(key(d.title), i); });
const edgeSet = new Set();
const deg = new Array(docs.length).fill(0);
let unresolved = 0;
for (let i = 0; i < docs.length; i++) {
  for (const l of docs[i].links) {
    const j = idx.get(key(l));
    if (j === undefined) { unresolved++; continue; }
    if (j === i) continue;
    const a = Math.min(i, j), b = Math.max(i, j), k = a * 1e7 + b;
    if (!edgeSet.has(k)) { edgeSet.add(k); deg[a]++; deg[b]++; }
  }
}
const edges = [...edgeSet].map((k) => [Math.floor(k / 1e7), k % 1e7]);

// ---------- groups -> 6 regions ----------
let mode = groupBy;
if (mode === 'auto') {
  const share = (f) => docs.filter((d) => d[f]).length / docs.length;
  const folders = new Set(docs.map((d) => d.folder)).size;
  mode = share('type') >= 0.5 ? 'type' : folders >= 3 ? 'folder' : share('tag') >= 0.5 ? 'tag' : 'folder';
}
const gOf = (d) => (mode === 'type' ? d.type : mode === 'tag' ? d.tag : d.folder) || '(none)';
const gCount = new Map();
docs.forEach((d) => gCount.set(gOf(d), (gCount.get(gOf(d)) || 0) + 1));
const ranked = [...gCount.entries()].sort((a, b) => b[1] - a[1]);
// slots 0..4 = five biggest groups (four lobes + cerebellum), slot 5 = everything else (brainstem / trunk)
const top = ranked.slice(0, ranked.length > 6 ? 5 : 6).map((x) => x[0]);
const slotOf = new Map(top.map((g, i) => [g, i]));
const restName = ranked.length > 6 ? 'other' : null;
const regions = Array.from({ length: 6 }, (_, i) => ({ name: top[i] ?? (i === 5 && restName ? restName : '-'), count: 0 }));
if (ranked.length > 6) regions[5].name = `other (${ranked.length - 5})`;
const LETTERS = 'ABCDEF';
if (opts['hide-groups']) regions.forEach((r, i) => { r.name = 'Group ' + LETTERS[i]; });

// ---------- nodes ----------
const per = new Array(6).fill(0);
const nodes = docs.map((d, i) => {
  const g = gOf(d);
  const region = slotOf.has(g) ? slotOf.get(g) : 5;
  regions[region].count++;
  const title = opts['hide-titles'] ? `${regions[region].name} #${++per[region]}` : d.title;
  return [title, region, deg[i], d.updated, d.status, d.created];
});

// ---------- drawn edges ----------
let hubLimit;
if (opts['exclude-hubs'] && opts['exclude-hubs'] !== 'auto') hubLimit = Number(opts['exclude-hubs']);
else hubLimit = Math.max(50, Math.round(docs.length * 0.25));
const hubs = deg.filter((x) => x > hubLimit).length;
let seed = 20261020;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const cand = edges.filter(([a, b]) => deg[a] <= hubLimit && deg[b] <= hubLimit).map(([a, b]) => ({
  a, b, s: (nodes[a][1] === nodes[b][1] ? 0.5 : 0) + 0.25 * Math.log1p(Math.min(deg[a], deg[b])) + rnd() * 0.9,
}));
cand.sort((x, y) => y.s - x.s);
const drawEdges = cand.slice(0, maxEdges).map((e) => [e.a, e.b]);

// ---------- dates ----------
const maxDate = nodes.reduce((m, n) => (n[5] > m ? n[5] : m), '');
const shift = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const minDate = nodes.reduce((m, n) => (n[5] && n[5] < m ? n[5] : m), maxDate);
let chartFrom = shift(maxDate, -(chartDays - 1));
if (chartFrom < minDate) chartFrom = minDate;
if (shift(chartFrom, 1) > maxDate) chartFrom = shift(maxDate, -1);

const stat = {
  title: opts.title || (opts['hide-titles'] || opts['hide-groups'] ? 'Knowledge Brain' : path.basename(path.resolve(vault))),
  docs: docs.length,
  edges: edges.length,
  drawnEdges: drawEdges.length,
  hubs, hubLimit, unresolvedLinks: unresolved,
  groupBy: mode,
  status: nodes.reduce((m, n) => ((m[n[4] || '-'] = (m[n[4] || '-'] || 0) + 1), m), {}),
  okStatus,
  recentFrom: shift(maxDate, -(recentDays - 1)),
  chartFrom,
  maxDate,
  hiddenTitles: !!opts['hide-titles'],
  built: new Date().toISOString(),
};
const js = `window.BRAIN=${JSON.stringify({ nodes, edges: drawEdges, regions, stat })};\n`;

// ---------- write ----------
let outFile;
if (opts.out) {
  outFile = path.resolve(opts.out);
  await fs.mkdir(path.dirname(outFile), { recursive: true });
} else {
  const site = path.resolve(opts.site || 'brain-site');
  if (site.startsWith(path.resolve(vault) + path.sep)) { console.error('refusing to write inside the vault: ' + site); process.exit(2); }
  await fs.mkdir(site, { recursive: true });
  for (const f of ['index.html', 'three.min.js', 'models.js', 'CREDITS.md']) {
    const src = path.join(VIEWER, f);
    if (fss.existsSync(src)) await fs.copyFile(src, path.join(site, f));
  }
  outFile = path.join(site, 'data.js');
}
if (outFile.startsWith(path.resolve(vault) + path.sep)) { console.error('refusing to write inside the vault: ' + outFile); process.exit(2); }
await fs.writeFile(outFile, js);
console.log(JSON.stringify({
  out: outFile, notes: docs.length, links: edges.length, drawn: drawEdges.length, hubsExcluded: hubs, hubLimit,
  unresolvedLinks: unresolved, groupBy: mode, regions: regions.map((r) => `${r.name}:${r.count}`), kb: Math.round(js.length / 1024), ms: Date.now() - t0,
}, null, 1));
