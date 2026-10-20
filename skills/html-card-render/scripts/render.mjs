#!/usr/bin/env node
/**
 * render.mjs - render an HTML card / banner / thumbnail to a PNG with EXACT pixel size.
 * Zero dependencies. Node 22+ (uses the built-in global WebSocket) and a local Chrome or Edge.
 *
 *   node render.mjs card.html out.png --size 1080x1350 --scale 2
 *   node render.mjs card.html out.png --size 1080x1350 --scale 2 --pages   # each .page -> out-01.png, out-02.png ...
 *   node render.mjs https://example.com shot.png --size 1280x720
 *
 * Options
 *   --size WxH        CSS pixel size of one card (default 1080x1350)
 *   --scale N         device scale factor; output = W*N x H*N (default 2)
 *   --pages [sel]     render every element matching sel (default ".page") as its own PNG
 *   --wait ms         extra wait after fonts/images are ready (default 300)
 *   --timeout ms      give up after this long (default 30000)
 *   --no-qa           skip the overflow check
 *   --json            print a machine-readable report
 * Env: CHROME_PATH   path to chrome / msedge / chromium
 *
 * Why CDP instead of `chrome --screenshot --window-size`: the window-size flag includes
 * browser chrome and DPI scaling on some systems, so the PNG comes out the wrong size.
 * Emulation.setDeviceMetricsOverride gives an exact viewport, and every PNG is re-read
 * after writing to confirm its real width and height.
 *
 * QA (before capture): elements whose text overflows their own box (scrollWidth >
 * clientWidth or scrollHeight > clientHeight with overflow hidden/clip) or that stick out
 * of the page box are listed. Exit code 1 if any overflow or size mismatch is found.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------- args ----------
const argv = process.argv.slice(2);
const opts = { size: '1080x1350', scale: '2', wait: '300', timeout: '30000' };
const pos = [];
let pagesSel = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--pages') {
    pagesSel = argv[i + 1] && !argv[i + 1].startsWith('--') && pos.length >= 2 ? argv[++i] : '.page';
  } else if (a === '--no-qa' || a === '--json') opts[a.slice(2)] = true;
  else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
  else pos.push(a);
}
if (pos.length < 2) {
  console.error('usage: node render.mjs <file.html|url> <out.png> [--size 1080x1350] [--scale 2] [--pages [.page]] [--json]');
  process.exit(2);
}
const [input, outPath] = pos;
const [W, H] = opts.size.toLowerCase().split('x').map(Number);
const SCALE = Number(opts.scale);
if (!(W > 0 && H > 0 && SCALE > 0)) { console.error('bad --size or --scale'); process.exit(2); }
if (typeof WebSocket === 'undefined') { console.error('Node 22+ is required (global WebSocket).'); process.exit(2); }
const url = /^https?:|^file:/.test(input) ? input : pathToFileURL(path.resolve(input)).href;

// ---------- find a browser ----------
function findBrowser() {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const P = process.env;
  const c = [];
  if (process.platform === 'win32') {
    for (const base of [P['PROGRAMFILES'], P['PROGRAMFILES(X86)'], P.LOCALAPPDATA].filter(Boolean)) {
      c.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      c.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      c.push(path.join(base, 'Chromium', 'Application', 'chrome.exe'));
    }
  } else if (process.platform === 'darwin') {
    c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    c.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
      '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium');
  }
  return c.find((p) => fs.existsSync(p));
}

// ---------- PNG size from header ----------
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// ---------- tiny CDP client ----------
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((l) => l(msg));
  });
  const ready = new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  return {
    ready,
    send(method, params = {}, sessionId) {
      const m = { id: ++id, method, params };
      if (sessionId) m.sessionId = sessionId;
      ws.send(JSON.stringify(m));
      return new Promise((resolve, reject) => pending.set(m.id, { resolve, reject }));
    },
    on(fn) { listeners.push(fn); },
    close() { try { ws.close(); } catch {} },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const exe = findBrowser();
  if (!exe) throw new Error('Chrome/Edge not found. Set CHROME_PATH.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'card-render-'));
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--disable-extensions', '--allow-file-access-from-files', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const cleanup = async () => {
    try { proc.kill(); } catch {}
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  };

  try {
    // Chrome prints "DevTools listening on ws://..." to stderr
    const wsUrl = await new Promise((resolve, reject) => {
      let buf = '';
      const t = setTimeout(() => reject(new Error('browser did not start')), 15000);
      proc.stderr.on('data', (d) => {
        buf += d;
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) { clearTimeout(t); resolve(m[1]); }
      });
      proc.on('exit', (code) => reject(new Error('browser exited ' + code)));
    });
    const client = cdp(wsUrl);
    await client.ready;
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => client.send(m, p, sessionId);

    await s('Page.enable');
    await s('Runtime.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
    await s('Emulation.setDefaultBackgroundColorOverride', { color: { r: 255, g: 255, b: 255, a: 1 } });

    const loaded = new Promise((res) => client.on((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired' && res()));
    await s('Page.navigate', { url });
    await Promise.race([loaded, sleep(Number(opts.timeout))]);

    const evalJs = async (expr) => {
      const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('page script error: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    };

    // wait for fonts and images
    await evalJs(`(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await Promise.all([...document.images].map(img => img.complete ? 0 :
        new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 10000); })));
      return true;
    })()`);
    await sleep(Number(opts.wait));

    const brokenImages = await evalJs(`[...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')).slice(0, 10)`);

    // pages to render
    const boxes = pagesSel
      ? await evalJs(`[...document.querySelectorAll(${JSON.stringify(pagesSel)})].map((el, i) => {
          const r = el.getBoundingClientRect();
          return { i, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
        })`)
      : [{ i: 0, x: 0, y: 0, w: W, h: H }];
    if (!boxes.length) throw new Error(`no elements match ${pagesSel}`);

    const outBase = outPath.replace(/\.png$/i, '');
    const results = [];
    for (const b of boxes) {
      const qa = opts['no-qa'] ? [] : await evalJs(`(() => {
        const pageSel = ${JSON.stringify(pagesSel)};
        const root = pageSel ? document.querySelectorAll(pageSel)[${b.i}] : document.body;
        const box = pageSel ? root.getBoundingClientRect() : { left: 0, top: 0, right: ${W}, bottom: ${H} };
        const out = [];
        const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
          (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
        for (const el of root.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[data-qa-ignore]')) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const text = (el.innerText || '').trim().slice(0, 40);
          const clipX = /hidden|clip|scroll|auto/.test(cs.overflowX), clipY = /hidden|clip|scroll|auto/.test(cs.overflowY);
          if (text && el.children.length === 0 && (el.scrollWidth > el.clientWidth + 1 && (clipX || cs.whiteSpace === 'nowrap')))
            out.push({ el: name(el), problem: 'text wider than its box', text });
          else if (text && clipY && el.scrollHeight > el.clientHeight + 1)
            out.push({ el: name(el), problem: 'text taller than its box (cut off)', text });
          if (r.left < box.left - 1 || r.top < box.top - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1)
            out.push({ el: name(el), problem: 'sticks out of the page', text,
              rect: [Math.round(r.left - box.left), Math.round(r.top - box.top), Math.round(r.right - box.left), Math.round(r.bottom - box.top)] });
        }
        return out.slice(0, 30);
      })()`);

      const shot = await s('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true, fromSurface: true,
        clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: 1 },
      });
      const file = pagesSel ? `${outBase}-${String(b.i + 1).padStart(2, '0')}.png` : (outPath.endsWith('.png') ? outPath : outPath + '.png');
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      const real = pngSize(file);
      const expected = { width: Math.round(b.w * SCALE), height: Math.round(b.h * SCALE) };
      const sizeOk = !!real && real.width === expected.width && real.height === expected.height;
      results.push({ file, cssSize: [Math.round(b.w), Math.round(b.h)], png: real, expected, sizeOk, overflow: qa });
    }
    client.close();
    return { browser: path.basename(exe), url, scale: SCALE, brokenImages, results };
  } finally {
    await cleanup();
  }
}

main().then((rep) => {
  const bad = rep.results.some((r) => !r.sizeOk || r.overflow.length) || rep.brokenImages.length;
  if (opts.json) console.log(JSON.stringify(rep, null, 1));
  else {
    for (const r of rep.results) {
      console.log(`${r.sizeOk ? 'OK  ' : 'SIZE'} ${r.file}  ${r.png ? r.png.width + 'x' + r.png.height : '?'} (expected ${r.expected.width}x${r.expected.height})`);
      for (const o of r.overflow) console.log(`     overflow: ${o.el} - ${o.problem}${o.text ? ' "' + o.text + '"' : ''}${o.rect ? ' ' + JSON.stringify(o.rect) : ''}`);
    }
    if (rep.brokenImages.length) console.log('broken images: ' + rep.brokenImages.join(', '));
    console.log(bad ? 'FAIL: fix the items above, then render again. 문제 항목을 고친 뒤 다시 렌더하세요.' : 'PASS: sizes exact, no overflow found. 이제 PNG를 직접 열어 눈으로 확인하세요.');
  }
  process.exit(bad ? 1 : 0);
}).catch((e) => { console.error('ERROR: ' + e.message); process.exit(2); });
