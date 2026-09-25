// Misst die Zeichenzeit pro Szene (ms/Bild) – für Performance-Optimierung.
//   node tools/frametime.mjs [szenen-id ...]
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';

const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const only = process.argv.slice(2);
const server = await serve(0);
const browser = await chromium.launch({ executablePath: EXE, args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => { console.error('[pageerror]', e.message); process.exit(1); });
await page.goto(`http://127.0.0.1:${server.port}/src/main.html?render=1`);
await page.waitForFunction(() => window.__render && window.__render.ready);
const res = await page.evaluate(async (only) => {
  const out = [];
  for (const sc of window.__render.scenes) {
    if (only.length && !only.includes(sc.id)) continue;
    const ts = [];
    for (let i = 0; i < 40; i++) {
      const t = sc.start + ((i + 0.5) / 40) * (sc.end - sc.start);
      const t0 = performance.now();
      window.__render.frame(t);
      document.getElementById('stage').getContext('2d').getImageData(0, 0, 1, 1); // Pipeline leeren
      ts.push(performance.now() - t0);
    }
    ts.sort((a, b) => a - b);
    out.push({ id: sc.id, mean: ts.reduce((a, b) => a + b, 0) / ts.length, p90: ts[Math.floor(ts.length * 0.9)], max: ts[ts.length - 1] });
  }
  return out;
}, only);
for (const r of res) console.log(`${r.id.padEnd(12)} Ø ${r.mean.toFixed(1).padStart(6)} ms   p90 ${r.p90.toFixed(1).padStart(6)} ms   max ${r.max.toFixed(1).padStart(6)} ms`);
await browser.close();
server.close();
