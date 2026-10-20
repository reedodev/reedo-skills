#!/usr/bin/env node
/**
 * Download the open-licensed (SIL OFL 1.1) fonts used by the deck into templates/fonts/.
 * Optional: without them build-deck.cjs links web fonts instead.
 *   node scripts/get-fonts.cjs
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'templates', 'fonts');
fs.mkdirSync(dir, { recursive: true });
const PRET = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/public/static/';
const files = [
  ['Pretendard-Regular.otf', PRET + 'Pretendard-Regular.otf'],
  ['Pretendard-Medium.otf', PRET + 'Pretendard-Medium.otf'],
  ['Pretendard-Bold.otf', PRET + 'Pretendard-Bold.otf'],
  ['Pretendard-ExtraBold.otf', PRET + 'Pretendard-ExtraBold.otf'],
  ['Gaegu-Bold.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/gaegu/Gaegu-Bold.ttf'],
];

(async () => {
  for (const [name, url] of files) {
    const out = path.join(dir, name);
    if (fs.existsSync(out)) { console.log('있음  ' + name); continue; }
    const r = await fetch(url);
    if (!r.ok) { console.error(`실패  ${name} (HTTP ${r.status})`); process.exitCode = 1; continue; }
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    console.log(`받음  ${name} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
  }
  console.log('글꼴 라이선스: SIL Open Font License 1.1 (Pretendard: orioncactus, Gaegu: JIKJI SOFT)');
})();
