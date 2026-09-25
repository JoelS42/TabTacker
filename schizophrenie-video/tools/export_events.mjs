// Exportiert die Soundeffekt-Ereignisse (aus den Szenen-Cues) nach data/sfx_events.json
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const server = await serve(0);
const browser = await chromium.launch({ executablePath: EXE, args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => { console.error(e.message); process.exit(1); });
await page.goto(`http://127.0.0.1:${server.port}/src/main.html?render=1`);
await page.waitForFunction(() => window.__render && window.__render.ready);
const ev = await page.evaluate(() => window.__render.sfxEvents());
const missing = await page.evaluate(() => window.__render.missingCues());
fs.writeFileSync('data/sfx_events.json', JSON.stringify(ev, null, 1));
console.log(`${ev.length} Soundeffekte exportiert; fehlende Cues: ${missing.length ? missing.join(', ') : 'keine'}`);
await browser.close();
server.close();
