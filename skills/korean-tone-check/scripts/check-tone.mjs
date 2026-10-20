#!/usr/bin/env node
/**
 * check-tone.mjs - Korean speech-level (존댓말/반말) consistency + AI-tell checker.
 * No dependencies. Node 18+.
 *
 *   node check-tone.mjs <file.md|txt> [--target hamnida|haeyo|plain] [--json]
 *   cat draft.txt | node check-tone.mjs - --target hamnida
 *
 * target
 *   hamnida : ~습니다/~합니다/~입니까? (formal polite, default)
 *   haeyo   : ~해요/~이에요 (informal polite)
 *   plain   : ~다/~한다 (written plain style, e.g. essays, news)
 *
 * What it reports
 *   1. ending  - sentences whose ending does not match the target level (the main gate)
 *   2. cliche  - stock AI phrases and translationese (advice, not errors)
 *   3. rhythm  - 3+ consecutive very short sentences, repeated sentence openers
 *   4. dash    - em dashes (—), which read as machine-written in Korean prose
 *
 * Exit code: 1 if any `ending` problem exists, else 0. Clichés never fail the run:
 * the writer decides. Headings, hashtags, list markers, quotes and code are skipped.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--json'));
const target = opt('target', 'hamnida');
const asJson = args.includes('--json');
if (!file) { console.error('usage: node check-tone.mjs <file|-> [--target hamnida|haeyo|plain] [--json]'); process.exit(2); }
const text = fs.readFileSync(file === '-' ? 0 : file, 'utf8');

// ---------- ending classification ----------
const ENDINGS = {
  hamnida: /(습니다|ㅂ니다|니다|습니까|니까|십시오|세요|시죠|시지요|겠습니다|드립니다|입니다)$/,
  haeyo: /(요|죠)$/,
  // plain written style: 다/까/라/자 endings. 해요체 and 합니다체 are excluded below.
  plain: /(다|까|라|자|냐|가)$/,
};
const CASUAL = /(해|야|지|어|아|게|네|군|걸|래|니|냐|거든|잖아|더라|구나)$/;

function classify(s) {
  // drop a trailing parenthetical like "...돌립니다(위 test 배지)." before judging the ending
  const core = s.replace(/[.!?…~\s]+$/u, '').replace(/\s*\([^()]*\)$/u, '').replace(/["'”’」』)\]\s.!?…~]+$/u, '');
  if (!/[가-힣]$/.test(core)) return 'other';
  if (ENDINGS.hamnida.test(core)) return 'hamnida';
  if (ENDINGS.haeyo.test(core)) return 'haeyo';
  if (ENDINGS.plain.test(core)) return 'plain';
  if (CASUAL.test(core)) return 'casual';
  return 'noun'; // 명사형 종결(제목형·메모형) - not judged
}

// ---------- stock phrases (author's own list, see SKILL.md) ----------
const CLICHES = [
  [/에 대해 (알아보|살펴보)(겠|도록)/, '도입 상투어: 바로 본론으로 들어가세요'],
  [/(결론적으로|요약하자면|종합적으로|마지막으로 정리하면)/, '정리 상투어'],
  [/중요한 역할을 (합니다|한다|해요)/, '빈 의미의 강조'],
  [/하는 것이 (중요|필요)(합니다|하다|해요)/, '“~하는 것이 중요” 반복형'],
  [/(혁신적인|획기적인|게임 ?체인저|패러다임|새로운 지평)/, '과장 수식어'],
  [/(여정|한 걸음 더 나아가|첫걸음을 내딛)/, '번역투 은유'],
  [/(되어지|되어진|하여지|불려지|보여지)/, '이중 피동'],
  [/(을|를) 가지고 있(습니다|다|어요)/, '번역투(have): “~이 있다”로'],
  [/에 있어(서)? /, '번역투: “~에서/~할 때”로'],
  [/(함에 있어|에 의해(서)? )/, '번역투 구조'],
  [/뿐만 아니라.*또한/, '중복 연결(뿐만 아니라+또한)'],
  [/(다양한|여러 가지) .*(다양한|여러 가지)/, '같은 문장 안 “다양한” 반복'],
  [/라고 할 수 있(습니다|다|어요)/, '얼버무림 종결'],
  [/(것입니다|것이다)\.?$/, '“~것이다” 종결: 단정형으로'],
  [/(살펴보았습니다|알아보았습니다|정리해 보았습니다)/, '맺음 상투어'],
  [/(놀랍게도|흥미롭게도|주목할 만한 점은)/, '감탄형 연결'],
];

// ---------- split ----------
const lines = text.split(/\r?\n/);
const sentences = [];
let inCode = false;
lines.forEach((raw, li) => {
  if (/^\s*```/.test(raw)) { inCode = !inCode; return; }
  if (inCode) return;
  let line = raw.trim();
  if (!line || /^(#|>|\||!\[|---|\* \* \*)/.test(line)) return;          // heading, quote, table, image
  if (/^(#[^\s#]+\s*)+$/.test(line)) return;                              // hashtag line
  line = line.replace(/^([-*+]|\d+[.)])\s+/, '');                          // list marker
  for (let k = 0; k < 2; k++) line = line.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1'); // nested badge links
  line = line.replace(/https?:\/\/\S+/g, '').replace(/<[^>]+>/g, ''); // links, URLs, HTML
  line = line.replace(/`[^`]*`/g, '').replace(/"[^"]*"|“[^”]*”|「[^」]*」/g, '“”'); // code + quotes
  // split after . ! ? … but not inside numbers like 0.2 or 1.5
  const parts = line.split(/(?<=[.!?…])(?!\d)\s*/);
  for (const p of parts) { const s = p.trim(); if (s.length > 1) sentences.push({ line: li + 1, s }); }
});

// ---------- run ----------
const issues = [];
const counts = { hamnida: 0, haeyo: 0, plain: 0, casual: 0, noun: 0, other: 0 };
for (const { line, s } of sentences) {
  const k = classify(s);
  counts[k]++;
  const okLevels = { hamnida: ['hamnida'], haeyo: ['haeyo'], plain: ['plain'] }[target] || ['hamnida'];
  if (!['noun', 'other'].includes(k) && !okLevels.includes(k)) {
    issues.push({ type: 'ending', line, found: k, text: s.slice(-40) });
  }
  for (const [re, why] of CLICHES) if (re.test(s)) issues.push({ type: 'cliche', line, why, text: s.slice(0, 60) });
  if (/—/.test(s)) issues.push({ type: 'dash', line, text: s.slice(0, 60) });
}
// rhythm: 3+ consecutive short sentences (< 14 chars) / repeated openers
let run = [];
const flush = () => { if (run.length >= 3) issues.push({ type: 'rhythm', line: run[0].line, why: `짧은 문장 ${run.length}개 연속: 연결어미로 이유와 결과를 이어 보세요`, text: run.map(r => r.s).join(' ').slice(0, 70) }); run = []; };
for (const x of sentences) { if (/[가-힣]/.test(x.s) && x.s.replace(/\s/g, '').length < 14) run.push(x); else flush(); }
flush();
const opener = {};
for (const { line, s } of sentences) { const w = s.split(/\s+/)[0]; if (w.length >= 2) (opener[w] ||= []).push(line); }
for (const [w, ls] of Object.entries(opener)) if (ls.length >= 3 && /^(또한|그리고|하지만|특히|이처럼|이를|이러한|따라서|즉)/.test(w)) issues.push({ type: 'rhythm', line: ls[0], why: `문장 첫머리 “${w}” ${ls.length}회 반복`, text: '' });

const endingProblems = issues.filter(i => i.type === 'ending').length;
if (asJson) {
  console.log(JSON.stringify({ target, sentences: sentences.length, counts, endingProblems, issues }, null, 1));
} else {
  console.log(`target=${target}  sentences=${sentences.length}  ` + Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' '));
  const label = { ending: '말투', cliche: '상투어', rhythm: '리듬', dash: '대시' };
  for (const i of issues.sort((a, b) => a.line - b.line)) {
    console.log(`L${i.line} [${label[i.type]}] ${i.found ? `(${i.found}) ` : ''}${i.why ? i.why + ' | ' : ''}${i.text}`);
  }
  console.log(endingProblems ? `FAIL: 목표 말투와 다른 문장 ${endingProblems}개` : 'PASS: 말투 일치 (상투어·리듬은 참고용)');
}
process.exit(endingProblems ? 1 : 0);
