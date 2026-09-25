// Einzelbilder zur Kontrolle: node tools/stills.mjs out_dir t1 t2 ... | --scene id [n]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const args = process.argv.slice(2);
const out = args.shift() || 'render/stills';
fs.mkdirSync(out, { recursive: true });
const server = await serve(8099);
const browser = await chromium.launch({ executablePath: EXE, args: ['--disable-gpu', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.text()); });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); process.exit(1); });
await page.goto('http://127.0.0.1:8099/src/main.html?render=1' + (process.env.DEBUG ? '&debug=1' : ''));
await page.waitForFunction(() => window.__render && window.__render.ready);
await page.evaluate(() => window.__render.ready);
let times = [];
if (args[0] === '--scene') {
  const scenes = await page.evaluate(() => window.__render.scenes);
  const sc = scenes.find((s) => s.id === args[1]);
  const n = parseInt(args[2] || '8', 10);
  for (let i = 0; i < n; i++) times.push(sc.start + ((i + 0.5) / n) * (sc.end - sc.start));
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
console.log('fehlende Cues:', await page.evaluate(() => window.__render.missingCues()));
await browser.close();
server.close();
