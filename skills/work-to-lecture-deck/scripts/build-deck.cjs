#!/usr/bin/env node
/**
 * deck.json + templates/deck.html -> 한 파일짜리 발표용 HTML
 *  - 이미지는 base64로 포함
 *  - 글꼴(Pretendard 본문·제목, Gaegu 손글씨는 그림 위 표시에만; 둘 다 OFL)은 덱에 실제로 쓰인 글자만 뽑아(woff2) 포함 -> 용량 작게
 * 사용: node build-deck.cjs <deck.json> <out.html>
 * 글꼴 부분 추출에는 python + fontTools + brotli 와 templates/fonts/ 의 글꼴 파일이 필요하다
 * (scripts/get-fonts.cjs 로 받는다). 둘 중 하나라도 없으면 웹 글꼴(CDN) 링크로 대신한다(인터넷 필요).
 * 환경변수 DECK_PYTHON 으로 python 경로 지정 가능. 기본: python3 -> python
 * deck.json 의 이미지 경로(heroImg, steps[].img)는 deck.json 이 있는 폴더 기준 상대경로.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const [, , jsonPath, outPath] = process.argv;
if (!jsonPath || !outPath) { console.error('사용: node build-deck.cjs deck.json out.html'); process.exit(2); }
const base = path.dirname(path.resolve(jsonPath));
const deck = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const inline = (p) => {
  if (!p || /^(data:|https?:)/.test(p)) return p;
  const f = path.resolve(base, p);
  if (!fs.existsSync(f)) { console.error('이미지 없음: ' + f); process.exit(1); }
  return `data:${mime[path.extname(f).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(f).toString('base64')}`;
};
deck.heroImg = inline(deck.heroImg);
for (const s of deck.steps || []) s.img = inline(s.img);

const tplDir = path.join(__dirname, '..', 'templates');
let tpl = fs.readFileSync(path.join(tplDir, 'deck.html'), 'utf8');
if (!tpl.includes('/*DECK_JSON*/null')) { console.error('템플릿에 DECK_JSON 자리표시가 없습니다'); process.exit(1); }
const json = JSON.stringify(deck).replace(/</g, '\\u003c');

// ---- 글꼴 부분 추출 ----
function pythonPath() {
  const cands = [process.env.DECK_PYTHON, 'python3', 'python'].filter(Boolean);
  for (const p of cands) {
    const r = spawnSync(p, ['-c', 'import fontTools,brotli'], { encoding: 'utf8' });
    if (r.status === 0) return p;
  }
  return null;
}
let fontsCss = '';
const WEB_FONTS = '@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");\n' +
  '@import url("https://fonts.googleapis.com/css2?family=Gaegu:wght@700&display=swap");\n';
const haveFontFiles = fs.existsSync(path.join(tplDir, 'fonts', 'Pretendard-Regular.otf'));
const py = haveFontFiles ? pythonPath() : null;
if (!haveFontFiles || !py) {
  console.warn('알림: ' + (!haveFontFiles ? 'templates/fonts 에 글꼴이 없어' : 'python+fontTools+brotli 가 없어') + ' 웹 글꼴 링크를 넣습니다(보는 사람에게 인터넷이 필요).');
  fontsCss = WEB_FONTS;
} else {
  // 사용된 글자 수집 (이미지 데이터 제외한 최종 텍스트)
  const all = (tpl + json).replace(/data:[a-z/+-]+;base64,[A-Za-z0-9+/=]+/g, '');
  const chars = new Set();
  for (const ch of all) chars.add(ch);
  for (let c = 32; c < 127; c++) chars.add(String.fromCharCode(c));
  '·→←×「」“”‘’…—–~%°℃①②③④⑤⑥⑦⑧⑨⑩'.split('').forEach((c) => chars.add(c));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deckfont-'));
  const txt = path.join(tmp, 'chars.txt');
  fs.writeFileSync(txt, [...chars].join(''), 'utf8');
  const faces = [
    ['Pretendard', 400, 'Pretendard-Regular.otf'],
    ['Pretendard', 500, 'Pretendard-Medium.otf'],
    ['Pretendard', 700, 'Pretendard-Bold.otf'],
    ['Pretendard', 800, 'Pretendard-ExtraBold.otf'],
    ['Gaegu', 700, 'Gaegu-Bold.ttf'],
  ];
  for (const [fam, w, file] of faces) {
    const src = path.join(tplDir, 'fonts', file);
    const out = path.join(tmp, file.replace('.ttf', '.woff2'));
    const r = spawnSync(py, ['-m', 'fontTools.subset', src, `--text-file=${txt}`, '--flavor=woff2', `--output-file=${out}`, '--layout-features=*'], { encoding: 'utf8' });
    if (r.status !== 0 || !fs.existsSync(out)) { console.warn('글꼴 추출 실패: ' + file + ' ' + (r.stderr || '').slice(0, 200)); continue; }
    fontsCss += `@font-face{font-family:"${fam}";font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${fs.readFileSync(out).toString('base64')}) format("woff2")}\n`;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

tpl = tpl.replace('/*FONTS_CSS*/', () => fontsCss).replace('/*DECK_JSON*/null', () => json);
fs.writeFileSync(outPath, tpl, 'utf8');
console.log(`built ${outPath} (${Math.round(fs.statSync(outPath).size / 1024)} KB) fonts:${fontsCss === WEB_FONTS ? 'web-link' : fontsCss ? 'embedded' : 'none'}`);
