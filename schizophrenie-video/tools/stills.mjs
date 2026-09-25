// Einzelbilder zur Kontrolle (parallel nutzbar: zufälliger Port)
//   node tools/stills.mjs <out_dir> t1 t2 ...          – feste Zeitpunkte (Sekunden)
//   node tools/stills.mjs <out_dir> --scene <id> [n]   – n gleichmäßig verteilte Bilder einer Szene
//   node tools/stills.mjs <out_dir> --cues <id> [off]  – ein Bild je Cue (Cue-Zeit + off, Standard 0.9 s)
//                                                        plus Szenenanfang/-ende; erzeugt contact.jpg
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';

const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const args = process.argv.slice(2);
const out = args.shift() || 'render/stills';
fs.mkdirSync(out, { recursive: true });
const server = await serve(0);
const browser = await chromium.launch({ executablePath: EXE, args: ['--disable-gpu', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let failed = false;
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('[browser]', m.text()); });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); failed = true; });
await page.goto(`http://127.0.0.1:${server.port}/src/main.html?render=1` + (process.env.DEBUG ? '&debug=1' : ''));
try {
  await page.waitForFunction(() => window.__render && window.__render.ready, null, { timeout: 30000 });
} catch (e) { console.log('[pageerror] Seite nicht bereit'); process.exit(1); }
await page.evaluate(() => window.__render.ready);
let times = [];
const scenes = await page.evaluate(() => window.__render.scenes);
if (args[0] === '--scene') {
  const sc = scenes.find((s) => s.id === args[1]);
  const n = parseInt(args[2] || '8', 10);
  for (let i = 0; i < n; i++) times.push(sc.start + ((i + 0.5) / n) * (sc.end - sc.start));
} else if (args[0] === '--cues') {
  const sc = scenes.find((s) => s.id === args[1]);
  const off = parseFloat(args[2] || '0.9');
  const cues = await page.evaluate((id) => (window.TIMINGS.cues[id] || {}), args[1]);
  times = [sc.start + 0.25, ...Object.values(cues).map((v) => Math.min(sc.end - 0.2, v + off)), sc.end - 0.25];
  times = [...new Set(times.map((t) => Math.round(t * 10) / 10))].sort((a, b) => a - b);
} else times = args.map(Number);
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate((t) => window.__render.frame(t), t);
  const ms = Date.now() - t0;
  const buf = await page.locator('#stage').screenshot({ type: 'jpeg', quality: 85 });
  const f = `${out}/t${t.toFixed(1).padStart(7, '0')}.jpg`;
  fs.writeFileSync(f, buf);
  console.log(f, `${ms} ms`);
}
const missing = await page.evaluate(() => window.__render.missingCues());
console.log('fehlende Cues:', missing.length ? missing : 'keine');
await browser.close();
server.close();
if (times.length > 1) {
  try { execFileSync('sh', ['tools/contact.sh', out, '4'], { stdio: 'inherit' }); } catch (e) { /* optional */ }
}
if (failed) process.exit(1);
