// =====================================================================
//  Deterministisches Rendern: jedes Bild wird aus der zentralen Zeitachse
//  berechnet (window.__render.frame(t)), abgegriffen und an ffmpeg gegeben.
//
//  node tools/render.mjs [--fps 30] [--workers 3] [--from s] [--to s]
//                        [--out render/final.mp4] [--subs 0|1] [--preview]
// =====================================================================
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : '1']);
  return acc;
}, []));
const FPS = parseInt(args.fps || '30', 10);
const WORKERS = parseInt(args.workers || '3', 10);
const SUBS = args.subs !== '0';
const PREVIEW = !!args.preview;
const OUT = args.out || (PREVIEW ? 'render/preview.mp4' : 'render/final.mp4');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TMP = path.join('render', 'tmp');
fs.mkdirSync(TMP, { recursive: true });

const server = await serve(8097);
const browser = await chromium.launch({ executablePath: EXE, args: ['--disable-gpu', '--force-color-profile=srgb', '--disable-background-timer-throttling'] });

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); process.exit(1); });
  await page.goto(`http://127.0.0.1:8097/src/main.html?render=1&subs=${SUBS ? 1 : 0}`);
  await page.waitForFunction(() => window.__render && window.__render.ready);
  await page.evaluate(() => window.__render.ready);
  return page;
}

const probe = await newPage();
const DURATION = await probe.evaluate(() => window.__render.duration);
await probe.close();
const t0 = parseFloat(args.from || '0');
const t1 = Math.min(DURATION, parseFloat(args.to || String(DURATION)));
const total = Math.round((t1 - t0) * FPS);
console.log(`Rendere ${total} Bilder (${(t1 - t0).toFixed(1)} s @ ${FPS} fps) mit ${WORKERS} Workern → ${OUT}`);

const W = PREVIEW ? 1280 : 1920;
const H = PREVIEW ? 720 : 1080;
const per = Math.ceil(total / WORKERS);
const started = Date.now();
let done = 0;

async function worker(idx) {
  const a = idx * per, b = Math.min(total, a + per);
  if (a >= b) return null;
  const seg = path.join(TMP, `seg_${String(idx).padStart(2, '0')}.mp4`);
  const page = await newPage();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', PREVIEW ? 'veryfast' : 'medium', '-crf', PREVIEW ? '24' : '16',
    '-tune', 'animation', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    const t = t0 + f / FPS;
    const b64 = await page.evaluate((t) => { window.__render.frame(t); return document.getElementById('stage').toDataURL('image/jpeg', 0.95).split(',')[1]; }, t);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (done % 300 === 0) {
      const el = (Date.now() - started) / 1000;
      console.log(`  ${done}/${total} Bilder · ${(done / el).toFixed(1)} fps · Rest ≈ ${((total - done) / (done / el) / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await page.close();
  return seg;
}

const segs = (await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)))).filter(Boolean);
await browser.close();
server.close();

const list = path.join(TMP, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${path.resolve(s)}'`).join('\n'));
const video = path.join(TMP, 'video.mp4');
await run(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
// Ton: fertige Mischung (48 kHz); Ausschnitt passend zum Zeitbereich
await run(['-y', '-loglevel', 'error', '-i', video, '-ss', String(t0), '-t', String(t1 - t0), '-i', 'audio/mix.wav',
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', PREVIEW ? '160k' : '256k', '-ar', '48000',
  '-movflags', '+faststart', '-metadata', 'title=Die Entstehung von Schizophrenie bei Kindern und Jugendlichen', '-metadata', 'language=deu',
  '-metadata:s:a:0', 'language=deu', '-shortest', OUT]);
console.log(`fertig: ${OUT} (${((Date.now() - started) / 60000).toFixed(1)} min)`);

function run(a) {
  return new Promise((ok, fail) => { const p = spawn('ffmpeg', a, { stdio: 'inherit' }); p.on('close', (c) => (c === 0 ? ok() : fail(new Error('ffmpeg ' + c)))); });
}
