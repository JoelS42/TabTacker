// =====================================================================
//  main.js – Player, Hintergrund, Übergänge, Untertitel, Debug, Render-Schnittstelle
//
//  Performance-Prinzip: Alle großflächigen Ebenen (Tiefenverlauf, Nebel,
//  Schleier, Vignette) werden EINMAL mit Dithering vorberechnet und pro Bild
//  nur unskaliert an ganzzahligen Positionen kopiert (schnellster Blit-Pfad
//  im Software-Renderer). Pro Bild bleiben nur kleine Sprites übrig.
// =====================================================================
import { W, H, TAU, C, clamp, lerp, ease, smoothstep, rng, noise2, fract, hexToRgb, makeCanvas, roundRect, FONT } from './animation.js';
import { Timeline, missingCues } from './timeline.js';
import SCENES from './scenes/index.js';

const params = new URLSearchParams(location.search);
const RENDER = params.has('render');

const canvas = document.getElementById('stage');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d', { alpha: false });
const bufA = makeCanvas(W, H), bufB = makeCanvas(W, H);
const ctxA = bufA.getContext('2d'), ctxB = bufB.getContext('2d');

const timings = window.TIMINGS;
const TL = new Timeline(timings, SCENES);

const state = {
  t: 0, playing: false, voice: true, music: true, subs: params.get('subs') !== '0', debug: params.has('debug'),
  lastNow: 0, fps: 0,
};

// ------------------------------------------------------------ Vorberechnete Ebenen
/** Deterministischer, schneller Zufall für Dithering (xorshift32). */
function xorshift(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/** Fraktales Rauschen (3 Oktaven), Wertebereich ≈ [-1, 1]. */
function fbm(x, y, oct = 3) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f + i * 17.31, y * f - i * 9.13); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
const gauss2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) * 0.5);

/**
 * Rastert eine glatte Funktion fn(x, y) → [c0, c1, c2, c3] in eine ImageData der Größe w×h.
 * fn wird nur auf einem groben Gitter (Abstand S) ausgewertet und bilinear interpoliert;
 * danach wird vor der 8-Bit-Quantisierung dreieckverteiltes Rauschen (±1 LSB) addiert → kein Banding.
 */
function rasterSmooth(w, h, S, fn, seed, alphaMode = false, tile = 0) {
  const gw = Math.ceil(w / S) + 2, gh = Math.ceil(h / S) + 2;
  const g = [new Float32Array(gw * gh), new Float32Array(gw * gh), new Float32Array(gw * gh), new Float32Array(gw * gh)];
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const v = fn(gx * S, gy * S), o = gy * gw + gx;
      g[0][o] = v[0]; g[1][o] = v[1]; g[2][o] = v[2]; g[3][o] = v[3] ?? 255;
    }
  }
  // opake Ebenen ohne Alphakanal → der Browser kann beim Zeichnen direkt kopieren
  const c = makeCanvas(w, h), cx = c.getContext('2d', { alpha: alphaMode });
  const img = cx.createImageData(w, h), d = img.data;
  const R = xorshift(seed);
  const [g0, g1, g2, g3] = g;
  for (let y = 0; y < h; y++) {
    const fy = y / S, iy = fy | 0, ty = fy - iy, r0 = iy * gw, r1 = r0 + gw;
    for (let x = 0; x < w; x++) {
      const fx = x / S, ix = fx | 0, tx = fx - ix;
      const a = r0 + ix, b = a + 1, cc = r1 + ix, dd = cc + 1;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const p = (y * w + x) * 4;
      const dz = R() - R();                                  // dreieckverteiltes Dither-Rauschen
      if (!alphaMode) {
        d[p] = g0[a] * w00 + g0[b] * w10 + g0[cc] * w01 + g0[dd] * w11 + dz;
        d[p + 1] = g1[a] * w00 + g1[b] * w10 + g1[cc] * w01 + g1[dd] * w11 + dz;
        d[p + 2] = g2[a] * w00 + g2[b] * w10 + g2[cc] * w01 + g2[dd] * w11 + dz;
        d[p + 3] = 255;
      } else {
        // Farbe unvormultipliziert, Deckkraft gedithert
        d[p] = g0[a] * w00 + g0[b] * w10 + g0[cc] * w01 + g0[dd] * w11;
        d[p + 1] = g1[a] * w00 + g1[b] * w10 + g1[cc] * w01 + g1[dd] * w11;
        d[p + 2] = g2[a] * w00 + g2[b] * w10 + g2[cc] * w01 + g2[dd] * w11;
        const av = g3[a] * w00 + g3[b] * w10 + g3[cc] * w01 + g3[dd] * w11;
        d[p + 3] = av < 0.3 ? 0 : av + dz * 1.2;             // echte Null bleibt Null → leere Kacheln
      }
    }
  }
  if (tile) return tileLayer(img, w, h, tile);
  cx.putImageData(img, 0, 0);
  return c;
}

/**
 * Zerlegt eine (überwiegend transparente) Ebene in wenige, große Rechtecke, die nur die
 * nicht-leeren Bereiche abdecken: Blöcke (G px breit, T px hoch) → waagerechte Läufe →
 * senkrecht zusammengefasst. Wenige große Blits sind im Software-Renderer am günstigsten.
 */
function tileLayer(img, w, h, T, G = 64) {
  const d = img.data;
  const used = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0, p = (y * w + x0) * 4 + 3; x < x1; x++, p += 4) if (d[p] > 0) return true;
    return false;
  };
  let rects = [];
  for (let ty = 0; ty < h; ty += T) {
    const th = Math.min(T, h - ty);
    let run = null;
    for (let tx = 0; tx < w; tx += G) {
      const tw = Math.min(G, w - tx);
      if (used(tx, ty, tx + tw, ty + th)) { if (run) run.w += tw; else run = { x: tx, y: ty, w: tw, h: th }; }
      else if (run) { rects.push(run); run = null; }
    }
    if (run) rects.push(run);
  }
  // senkrecht zusammenfassen (gleiche Spalte, direkt anschließend)
  const merged = [];
  for (const r of rects) {
    const up = merged.find((m) => m.x === r.x && m.w === r.w && m.y + m.h === r.y);
    if (up) up.h += r.h; else merged.push({ ...r });
  }
  const tiles = merged.map((r) => {
    const c = makeCanvas(r.w, r.h);
    c.getContext('2d').putImageData(img, -r.x, -r.y, r.x, r.y, r.w, r.h);
    return { c, ...r };
  });
  return { w, h, tiles };
}
function blitTiles(c, L, ox, oy) {
  for (const tl of L.tiles) {
    const x = ox + tl.x, y = oy + tl.y;
    if (x >= W || y >= H || x + tl.w <= 0 || y + tl.h <= 0) continue;
    c.drawImage(tl.c, x, y);
  }
}

// Ferne Tiefenebene: dunkler Verlauf + sehr weiche Farbnebel (violett / petrol / tiefblau)
const FAR_PAD = 110;
const farLayer = rasterSmooth(W + FAR_PAD * 2, H + FAR_PAD * 2, 8, (lx, ly) => {
  const x = lx - FAR_PAD, y = ly - FAR_PAD;
  // Grundverlauf (radial, leicht oberhalb der Bildmitte)
  const d = Math.hypot((x - W * 0.5) / (W * 0.62), (y - H * 0.45) / (H * 0.78));
  const e = smoothstep(0, 1.15, d);
  let r = lerp(11.5, 2.2, e), g = lerp(21, 3.4, e), b = lerp(47, 10, Math.pow(e, 0.9));
  // Nebelfelder (große, langsame Formen)
  const n1 = clamp(0.5 + 0.9 * fbm(x / 820 + 3.1, y / 820 - 1.7));
  const n2 = clamp(0.5 + 0.9 * fbm(x / 760 - 5.3, y / 760 + 2.9));
  const n3 = clamp(0.45 + 0.9 * fbm(x / 1000 + 8.2, y / 1000 + 4.4));
  const violet = gauss2(x, y, W * 0.16, H * 0.14, W * 0.3, H * 0.42) * n1;
  const teal = gauss2(x, y, W * 0.86, H * 0.84, W * 0.3, H * 0.4) * n2;
  const blue = gauss2(x, y, W * 0.56, H * 0.5, W * 0.36, H * 0.42) * n3;
  const rose = gauss2(x, y, W * 0.93, H * 0.08, W * 0.2, H * 0.3) * n1;
  r += violet * 9.5 + teal * 0 + blue * 3 + rose * 5;
  g += violet * 4 + teal * 9 + blue * 6.5 + rose * 1.5;
  b += violet * 17 + teal * 11 + blue * 15 + rose * 8;
  return [r, g, b];
}, 1234);

// Mittlere Ebene: zarte, faserige Schleier (stärkere Parallaxe), nur dort gespeichert, wo sie existieren
const MID_PAD = 190;
const midLayer = rasterSmooth(W + MID_PAD * 2, H + MID_PAD * 2, 6, (lx, ly) => {
  const x = lx - MID_PAD, y = ly - MID_PAD;
  const warp = fbm(x / 1000 + 11, y / 1000 - 7) * 1.4;
  const ridge = 1 - Math.abs(fbm(x / 760 + warp, y / 820 - warp * 0.6, 3));
  const fil = Math.pow(clamp(ridge), 3.2);
  const mask = smoothstep(0.16, 0.55, fbm(x / 1150 - 2.2, y / 1150 + 6.1, 2));
  const k = clamp(0.5 + fbm(x / 700 + 4, y / 700, 2));      // Farbmischung blau ↔ violett
  const a = 19 * fil * mask;
  return [lerp(120, 175, k), lerp(160, 135, k), 255, a];
}, 4321, true, 96);

// Vignette über dem Bildinhalt (weich, elliptisch, gedithert): wirkt nur in Ecken und Rändern –
// die großflächige Randabdunklung steckt bereits im Hintergrund. Leere Kacheln entfallen.
const vignette = rasterSmooth(W, H, 8, (x, y) => {
  const d = Math.hypot((x - W / 2) / (W * 0.5), (y - H * 0.5) / (H * 0.5));
  const v = Math.pow(smoothstep(0.86, 1.42, d), 1.4) * 0.62;
  return [0, 0, 0, clamp(v) * 255];
}, 777, true, 60);

// Weiches Licht für die Übergangsmitte (additiv, zentriert auf den Zoom-Fokus)
const BLOOM_W = 1500, BLOOM_H = 1100;
const bloom = rasterSmooth(BLOOM_W, BLOOM_H, 8, (x, y) => {
  const d = Math.hypot((x - BLOOM_W / 2) / (BLOOM_W / 2), (y - BLOOM_H / 2) / (BLOOM_H / 2));
  const v = Math.pow(clamp(1 - d), 2.2);
  return [150, 185, 255, v * 255];
}, 99, true);

// ------------------------------------------------------------ Bokeh (drei Tiefenebenen, Tiefenschärfe-Eindruck)
const _bokehSprites = new Map();
function bokehSprite(kind, hex) {
  const key = kind + hex;
  let s = _bokehSprites.get(key);
  if (s) return s;
  const R = kind === 'disc' ? 64 : 32;
  s = makeCanvas(R * 2, R * 2);
  const g = s.getContext('2d');
  const [r, gg, b] = hexToRgb(hex);
  const col = (a) => `rgba(${r},${gg},${b},${a})`;
  const grad = g.createRadialGradient(R, R, 0, R, R, R);
  if (kind === 'speck') {        // ferner, scharfer Lichtpunkt
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.16, col(0.95)); grad.addColorStop(0.34, col(0.28));
    grad.addColorStop(0.62, col(0.06)); grad.addColorStop(1, col(0));
  } else if (kind === 'soft') {  // mittlere Ebene: weicher Lichthof
    grad.addColorStop(0, col(1)); grad.addColorStop(0.3, col(0.5)); grad.addColorStop(0.65, col(0.12)); grad.addColorStop(1, col(0));
  } else {                       // nahe Ebene: unscharfe Bokeh-Scheibe mit zartem Rand
    grad.addColorStop(0, col(0.5)); grad.addColorStop(0.62, col(0.58)); grad.addColorStop(0.8, col(0.78));
    grad.addColorStop(0.88, col(0.5)); grad.addColorStop(1, col(0));
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, R * 2, R * 2);
  _bokehSprites.set(key, s);
  return s;
}
const BOKEH_KIND = ['speck', 'soft', 'disc'];
const BOKEH_SPEED = [0.3, 0.58, 1.0];
const bokeh = (() => {
  const R = rng(2024);
  const out = [];
  const pick = () => { const v = R(); return v < 0.12 ? C.gen : v < 0.24 ? C.glu : v < 0.42 ? '#8fb0ff' : C.neuron; };
  const add = (n, layer) => { for (let i = 0; i < n; i++) out.push({ layer, a: R.range(0, TAU), u: R(), size: R.range(0.7, 1.35), col: pick(), tw: R.range(0, 10), sp: R.range(0.8, 1.2) }); };
  add(78, 0); add(34, 1); add(12, 2);
  return out;
})();

function drawBokeh(c, t, G) {
  const rMin = 26, rMax = 1250, lr = Math.log(rMax / rMin);
  for (const b of bokeh) {
    const u = fract(b.u + G * BOKEH_SPEED[b.layer] * 0.5 * b.sp);
    const r = rMin * Math.exp(u * lr);
    const ang = b.a + noise2(b.tw, t * 0.02) * 0.2;
    const x = W / 2 + Math.cos(ang) * r * 1.2, y = H / 2 + Math.sin(ang) * r * 0.8;
    const fade = Math.sin(Math.PI * u);
    let rad, al;
    if (b.layer === 0) { rad = 4.2 * b.size * (0.75 + u * 0.7); al = 0.34 * fade * (0.55 + 0.45 * Math.sin(t * 0.9 + b.tw * 3)); }
    else if (b.layer === 1) { rad = 13 * b.size * (0.55 + u * 1.5); al = 0.075 * fade * (0.8 + 0.2 * Math.sin(t * 0.6 + b.tw)); }
    else { rad = 30 * b.size * (0.45 + u * 2.3); al = 0.05 * fade * fade; }
    if (al < 0.004 || x < -rad || y < -rad || x > W + rad || y > H + rad) continue;
    c.globalAlpha = al;
    c.drawImage(bokehSprite(BOKEH_KIND[b.layer], b.col), x - rad, y - rad, rad * 2, rad * 2);
  }
  c.globalAlpha = 1;
}

// ------------------------------------------------------------ Hintergrund
function drawFar(c, t, G) {
  // Ferne Ebene: langsame Drift (Lissajous über die Reisetiefe G + sehr langsame Zeitdrift)
  const fx = Math.sin(G * 0.57 + 0.6) * 0.64 + Math.sin(t * 0.011 + 1.3) * 0.3;
  const fy = Math.cos(G * 0.43 + 0.2) * 0.64 + Math.sin(t * 0.009 + 4.1) * 0.3;
  c.drawImage(farLayer, Math.round(-FAR_PAD + fx * FAR_PAD * 0.97), Math.round(-FAR_PAD + fy * FAR_PAD * 0.97));
}
function drawMid(c, t, G) {
  // Mittlere Ebene: stärkere Parallaxe
  const mx = Math.sin(G * 0.83 + 2.0) * 0.66 + Math.sin(t * 0.017 + 0.4) * 0.3;
  const my = Math.cos(G * 0.69 + 1.1) * 0.66 + Math.sin(t * 0.013 + 2.2) * 0.3;
  blitTiles(c, midLayer, Math.round(-MID_PAD + mx * MID_PAD * 0.97), Math.round(-MID_PAD + my * MID_PAD * 0.97));
}
function drawBackground(c, t) {
  // Kaltstart: am Anfang ist alles schwarz, nur der Lichtpunkt der ersten Szene leuchtet
  const black = 1 - clamp((t - 4) / 7);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  if (black >= 0.999) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); return; }
  const G = TL.travelAt(t);
  drawFar(c, t, G);
  drawMid(c, t, G);
  drawBokeh(c, t, G);
  if (black > 0) { c.fillStyle = `rgba(0,0,0,${black})`; c.fillRect(0, 0, W, H); }
}

function drawPost(c) {
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  blitTiles(c, vignette, 0, 0);
}

// ------------------------------------------------------------ Szenen & Übergänge
/**
 * Maßstab eines Übergangs. Zoom-Fahrten laufen im log-Raum mit quadratischer Beschleunigung
 * (hinaus) bzw. Abbremsung (hinein): an der Überblendmitte haben beide Ebenen dieselbe
 * wahrgenommene Zoomgeschwindigkeit → eine durchgehende Kamerafahrt statt zweier Bewegungen.
 */
const ZOOM = { in: Math.log(1.8), inArrive: Math.log(1.62), out: Math.log(1.62), outArrive: Math.log(1.7) };
function transitionScale(tr, phase, k) {
  const a = k * k, b = (1 - k) * (1 - k);
  if (tr.type === 'zoomIn') return phase === 'out' ? Math.exp(ZOOM.in * a) : Math.exp(-ZOOM.inArrive * b);
  if (tr.type === 'zoomOut') return phase === 'out' ? Math.exp(-ZOOM.out * a) : Math.exp(ZOOM.outArrive * b);
  if (tr.type === 'fade') return phase === 'out' ? 1 + 0.045 * a : 1 - 0.035 * b;
  return 1;
}

function drawLayer(c, layer, t) {
  const sc = layer.scene;
  const S = TL.context(sc, t, layer);
  c.save();
  if (layer.tr && layer.phase !== 'main') {
    const tr = layer.tr;
    const s = transitionScale(tr, layer.phase, layer.k);
    const fx = tr.type === 'zoomIn' && layer.phase === 'out' ? (tr.fromX ?? tr.fx) : tr.fx;
    const fy = tr.type === 'zoomIn' && layer.phase === 'out' ? (tr.fromY ?? tr.fy) : tr.fy;
    if (s !== 1) { c.translate(fx, fy); c.scale(s, s); c.translate(-fx, -fy); }
  }
  sc.mod.draw(c, S);
  c.restore();
}

function drawScenes(c, layers, t) {
  if (layers.length === 1) { drawLayer(c, layers[0], t); return; }
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const w = clamp(layer.weight);
    if (w <= 0.002) continue;                       // unsichtbar → nicht zeichnen
    if (w >= 0.998) { drawLayer(c, layer, t); continue; } // voll deckend → direkt, ohne Puffer
    const b = i === 0 ? ctxA : ctxB;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, W, H);
    drawLayer(b, layer, t);
    c.globalAlpha = w;
    c.drawImage(i === 0 ? bufA : bufB, 0, 0);
    c.globalAlpha = 1;
  }
  // Weiches Licht in der Überblendmitte (wie Licht, das durch die Optik fällt)
  const inc = layers[layers.length - 1];
  if (inc.tr && inc.tr.dur > 0.5) {
    const bell = Math.pow(Math.sin(Math.PI * clamp(inc.k)), 3);
    const amt = (inc.tr.type === 'fade' ? 0.07 : 0.11) * bell;
    if (amt > 0.004) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = amt;
      c.drawImage(bloom, Math.round(inc.tr.fx - BLOOM_W / 2), Math.round(inc.tr.fy - BLOOM_H / 2));
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
  }
}

function renderFrame(t) {
  state.t = t;
  TL.lifecycle(t);
  drawBackground(ctx, t);
  const layers = TL.layersAt(t);
  drawScenes(ctx, layers, t);
  drawPost(ctx);
  if (state.subs) drawSubtitles(ctx, t);
  if (state.debug) drawDebug(ctx, t, layers);
}

// ------------------------------------------------------------ Untertitel (max. 2 Zeilen, Wort-Highlight)
const SUB = { size: 36, weight: 500, lh: 1.3, padX: 32, padY: 13, bottom: 1026, oneLine: 1180, maxW: 1400, radius: 18 };
const SUB_FONT = `${SUB.weight} ${SUB.size}px ${FONT.text}`;

const subtitleChunks = (() => {
  const chunks = [];
  for (const s of timings.sentences) {
    let cur = [];
    const ws = s.words;
    for (let i = 0; i < ws.length; i++) {
      cur.push(ws[i]);
      const txt = cur.map((w) => w.w).join(' ');
      const nxt = ws[i + 1];
      if (!nxt) break;
      const last = ws[i].w;
      const strong = /[,:;–.?!]$/.test(last) || last === '–';
      const end = /[.?!]$/.test(last);
      if (txt.length + 1 + nxt.w.length > 74 || (strong && txt.length > 38) || (end && txt.length > 12)) { chunks.push(cur); cur = []; }
    }
    if (cur.length) chunks.push(cur);
  }
  const out = chunks.map((ws) => ({ words: ws, start: ws[0].start, end: ws[ws.length - 1].end + 0.25 }))
    .map((c, i, arr) => ({ ...c, end: i + 1 < arr.length ? Math.min(c.end, arr[i + 1].start - 0.02) : c.end }));
  // Zusammenhängende Untertitel: Box bleibt stehen und morpht zur neuen Größe (kein Flackern)
  for (let i = 0; i < out.length; i++) {
    const c = out[i], n = out[i + 1];
    c.show0 = c.start - 0.05;
    c.linkNext = !!n && n.start - c.end < 0.6;
    c.show1 = c.linkNext ? n.start - 0.05 : c.end;
    c.linkPrev = i > 0 && out[i - 1].linkNext;
  }
  return out;
})();

let subCursor = 0;
function subtitleIndexAt(t) {
  const L = subtitleChunks;
  let i = Math.min(subCursor, L.length - 1);
  while (i > 0 && t < L[i].show0) i--;
  while (i < L.length - 1 && t >= L[i + 1].show0) i++;
  subCursor = i;
  return t >= L[i].show0 && t < L[i].show1 ? i : -1;
}

function splitLines(c, words) {
  const full = words.map((w) => w.w).join(' ');
  if (c.measureText(full).width <= SUB.oneLine) return [words];
  let best = 1, bestD = 1e9;
  for (let i = 1; i < words.length; i++) {
    const a = c.measureText(words.slice(0, i).map((w) => w.w).join(' ')).width;
    const b = c.measureText(words.slice(i).map((w) => w.w).join(' ')).width;
    if (Math.max(a, b) > SUB.maxW) continue;
    // ausgewogen, bevorzugt nach Satzzeichen; die obere Zeile darf etwas kürzer sein
    const d = Math.abs(a - b) + (a > b ? 30 : 0) + (/[,:;–]$/.test(words[i - 1].w) ? 0 : 120);
    if (d < bestD) { bestD = d; best = i; }
  }
  return [words.slice(0, best), words.slice(best)];
}

const subLayoutCache = new Map();
function subtitleLayout(c, idx) {
  let L = subLayoutCache.get(idx);
  if (L) return L;
  const ch = subtitleChunks[idx];
  c.save();
  c.font = SUB_FONT;
  if ('fontKerning' in c) c.fontKerning = 'normal';
  const lines = splitLines(c, ch.words).map((ws) => {
    const strs = ws.map((w) => w.w);
    const width = c.measureText(strs.join(' ')).width;
    const items = ws.map((w, i) => ({ w, x: i ? c.measureText(strs.slice(0, i).join(' ') + ' ').width : 0, width: c.measureText(w.w).width }));
    return { width, items };
  });
  const capH = c.measureText('H').actualBoundingBoxAscent || SUB.size * 0.727;
  c.restore();
  const lh = SUB.size * SUB.lh;
  const w = Math.max(...lines.map((l) => l.width)) + SUB.padX * 2;
  const h = lines.length * lh + SUB.padY * 2;
  L = { lines, w, h, lh, capH };
  // erst cachen, wenn die Schrift sicher geladen ist (sonst wären die Maße der Ersatzschrift gespeichert)
  if (document.fonts.check(SUB_FONT)) subLayoutCache.set(idx, L);
  return L;
}

function drawSubtitles(c, t) {
  const idx = subtitleIndexAt(t);
  if (idx < 0) return;
  const ch = subtitleChunks[idx];
  const L = subtitleLayout(c, idx);
  // Box: blendet nur am Anfang/Ende einer zusammenhängenden Folge, dazwischen morpht sie
  const boxIn = ch.linkPrev ? 1 : ease.out(clamp((t - ch.show0) / 0.22));
  const boxOut = ch.linkNext ? 1 : clamp((ch.show1 - t) / 0.2);
  const boxA = boxIn * boxOut;
  let bw = L.w, bh = L.h;
  if (ch.linkPrev) {
    const P = subtitleLayout(c, idx - 1);
    const m = ease.inOut(clamp((t - ch.show0) / 0.26));
    bw = lerp(P.w, L.w, m); bh = lerp(P.h, L.h, m);
  }
  const bx = W / 2 - bw / 2, by = SUB.bottom - bh;
  c.save();
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  // weiche Kante: zwei transparente Säume + Körper
  c.fillStyle = `rgba(2,5,13,${0.16 * boxA})`;
  roundRect(c, bx - 7, by - 7, bw + 14, bh + 14, SUB.radius + 7); c.fill();
  c.fillStyle = `rgba(2,5,13,${0.22 * boxA})`;
  roundRect(c, bx - 3, by - 3, bw + 6, bh + 6, SUB.radius + 3); c.fill();
  const gb = c.createLinearGradient(0, by, 0, by + bh);
  gb.addColorStop(0, `rgba(10,17,34,${0.66 * boxA})`);
  gb.addColorStop(1, `rgba(4,8,18,${0.72 * boxA})`);
  c.fillStyle = gb;
  roundRect(c, bx, by, bw, bh, SUB.radius); c.fill();
  c.strokeStyle = `rgba(180,205,255,${0.07 * boxA})`; c.lineWidth = 1;
  roundRect(c, bx + 0.5, by + 0.5, bw - 1, bh - 1, SUB.radius - 0.5); c.stroke();

  // Text: kurzes Einblenden mit sanftem Anheben, kurzes Ausblenden vor dem Wechsel
  const tIn = ease.out(clamp((t - ch.show0) / (ch.linkPrev ? 0.2 : 0.24)));
  const tOut = clamp((ch.show1 - t) / (ch.linkNext ? 0.09 : 0.2));
  const ta = tIn * tOut;
  if (ta > 0.003) {
    c.font = SUB_FONT;
    if ('fontKerning' in c) c.fontKerning = 'normal';
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const lift = (1 - tIn) * 7;
    const top = SUB.bottom - L.h + SUB.padY;
    let ul = null;                                   // Unterstreichung: aktuelles Wort
    L.lines.forEach((line, li) => {
      const x0 = W / 2 - line.width / 2;
      const base = top + L.lh * (li + 0.5) + L.capH / 2 + lift;
      for (const it of line.items) {
        const w = it.w;
        const spoken = smoothstep(w.start - 0.04, w.start + 0.08, t);
        const act = spoken * (1 - smoothstep(w.end + 0.02, w.end + 0.2, t));
        // kommend: gedämpftes Blaugrau · gesprochen: helles Weißblau · aktiv: reines Weiß
        const r = lerp(lerp(152, 226, spoken), 255, act), g = lerp(lerp(166, 233, spoken), 255, act), b = lerp(lerp(196, 247, spoken), 255, act);
        const a = ta * lerp(0.8, 0.97, spoken) + ta * 0.03 * act;
        c.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
        c.fillText(w.w, x0 + it.x, base);
        if (t >= w.start - 0.04) ul = { x: x0 + it.x, w: it.width, y: base, li, w0: w, line, it };
      }
    });
    if (ul) drawUnderline(c, ul, L, t, ta);
  }
  c.restore();
}

/** Karaoke-Unterstreichung: gleitet weich von Wort zu Wort (keine Sprünge, kein Zittern). */
function drawUnderline(c, ul, L, t, ta) {
  const w = ul.w0;
  // Vorgängerwort in derselben Zeile → Gleiten; sonst sanftes Einblenden
  const idx = ul.line.items.indexOf(ul.it);
  const prev = idx > 0 ? ul.line.items[idx - 1] : null;
  const m = ease.out(clamp((t - (w.start - 0.04)) / 0.16));
  let x = ul.x, ww = ul.w;
  const x0 = W / 2 - ul.line.width / 2;
  const glide = prev && w.start - prev.w.end < 0.5;
  if (glide) { x = lerp(x0 + prev.x, ul.x, m); ww = lerp(prev.width, ul.w, m); }
  const fadeIn = glide ? 1 : m;
  const hold = 1 - smoothstep(w.end + 0.15, w.end + 0.55, t);
  const a = ta * fadeIn * hold;
  if (a <= 0.003) return;
  const y = ul.y + SUB.size * 0.3;
  c.fillStyle = `rgba(46,230,255,${0.14 * a})`;
  roundRect(c, x - 2, y - 2.5, ww + 4, 8, 4); c.fill();
  const g = c.createLinearGradient(x, 0, x + ww, 0);
  g.addColorStop(0, `rgba(46,230,255,${0.55 * a})`);
  g.addColorStop(0.5, `rgba(120,240,255,${0.95 * a})`);
  g.addColorStop(1, `rgba(46,230,255,${0.55 * a})`);
  c.fillStyle = g;
  roundRect(c, x, y, ww, 3, 1.5); c.fill();
}

// ------------------------------------------------------------ Debug-Overlay
function drawDebug(c, t, layers) {
  const sc = TL.scenes[TL.sceneIndexAt(t)];
  const p = (t - sc.start) / (sc.end - sc.start);
  const lines = [
    `Szene ${sc.index + 1}/${TL.scenes.length}: ${sc.id} – ${sc.title}`,
    `Zeit ${fmt(t)} / ${fmt(TL.duration)}   Voiceover ${voice ? fmt(voice.currentTime) : '–'}`,
    `Szenen-Fortschritt ${(p * 100).toFixed(1)} %   Ebenen: ${layers.map((l) => `${l.scene.id}(${l.weight.toFixed(2)})`).join(' + ')}`,
    `FPS ${state.fps.toFixed(0)}   fehlende Cues: ${missingCues.size ? [...missingCues].slice(0, 4).join(', ') : 'keine'}`,
  ];
  const near = Object.entries(sc.cues).filter(([, v]) => Math.abs(v - t) < 2.5).map(([k, v]) => `${k}@${(v - t).toFixed(1)}`);
  lines.push(`Cues ±2,5 s: ${near.join('  ') || '–'}`);
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(20, 20, 900, 26 * lines.length + 20);
  c.font = `500 18px ${FONT.text}`; c.fillStyle = '#9ff'; c.textBaseline = 'top';
  lines.forEach((l, i) => c.fillText(l, 34, 30 + i * 26));
  c.restore();
}
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

// ------------------------------------------------------------ Render-Schnittstelle (für tools/render.mjs)
window.__render = {
  _dbg: () => ({ mid: midLayer.tiles.length, midArea: midLayer.tiles.reduce((a, t) => a + t.w * t.h, 0) / (midLayer.w * midLayer.h), vig: vignette.tiles.length, vigArea: vignette.tiles.reduce((a, t) => a + t.w * t.h, 0) / (W * H) }),
  duration: TL.duration,
  scenes: TL.scenes.map((s) => ({ id: s.id, title: s.title, start: s.start, end: s.end })),
  frame(t) { renderFrame(t); return true; },
  /** Zeitanteile eines Bildes (ms) – nur zur Performance-Analyse */
  profile(t) {
    const flush = () => ctx.getImageData(0, 0, 1, 1);
    const r = {};
    state.t = t; TL.lifecycle(t);
    flush();
    let t0 = performance.now();
    const lap = (k) => { flush(); const n = performance.now(); r[k] = n - t0; t0 = n; };
    const G = TL.travelAt(t);
    drawFar(ctx, t, G); lap('far');
    drawMid(ctx, t, G); lap('mid');
    drawBokeh(ctx, t, G); lap('bokeh');
    drawScenes(ctx, TL.layersAt(t), t); lap('scene');
    drawPost(ctx); lap('post');
    drawSubtitles(ctx, t); lap('subs');
    return r;
  },
  sfxEvents: () => TL.sfxEvents(),
  missingCues: () => [...missingCues],
  setSubs(v) { state.subs = !!v; },
  ready: document.fonts.ready
    .then(() => Promise.all(['400 40px Inter', '500 40px Inter', '600 40px Inter', '700 40px Inter', '600 40px InterDisplay', '700 40px InterDisplay']
      .map((f) => document.fonts.load(f))))
    .then(() => true),
};

// ------------------------------------------------------------ Player (Vorschau)
let voice, music, sfx;
if (!RENDER) setupPlayer();
else { document.body.classList.add('render'); }

function setupPlayer() {
  voice = document.getElementById('voice');
  music = document.getElementById('music');
  sfx = document.getElementById('sfx');
  const $ = (id) => document.getElementById(id);
  const scrub = $('scrub');
  scrub.max = TL.duration;
  // Szenenmarker
  const markers = $('markers');
  for (const s of TL.scenes) {
    const m = document.createElement('button');
    m.className = 'marker';
    m.style.left = `${(s.start / TL.duration) * 100}%`;
    m.title = `${s.index + 1}. ${s.title}`;
    m.onclick = () => seek(s.start + 0.01);
    markers.appendChild(m);
  }
  const setBtn = (id, on) => $(id).classList.toggle('off', !on);
  $('play').onclick = () => (state.playing ? pause() : play());
  $('restart').onclick = () => { seek(0); play(); };
  $('tVoice').onclick = () => { state.voice = !state.voice; voice.muted = !state.voice; setBtn('tVoice', state.voice); };
  $('tMusic').onclick = () => { state.music = !state.music; music.muted = !state.music; setBtn('tMusic', state.music); };
  $('tSubs').onclick = () => { state.subs = !state.subs; setBtn('tSubs', state.subs); if (!state.playing) renderFrame(state.t); };
  $('tDebug').onclick = () => { state.debug = !state.debug; setBtn('tDebug', state.debug); if (!state.playing) renderFrame(state.t); };
  setBtn('tSubs', state.subs); setBtn('tDebug', state.debug);
  scrub.oninput = () => seek(parseFloat(scrub.value));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); state.playing ? pause() : play(); }
    if (e.code === 'ArrowRight') seek(state.t + 5);
    if (e.code === 'ArrowLeft') seek(state.t - 5);
    if (e.key === 'd') $('tDebug').click();
    if (e.key === 'u') $('tSubs').click();
  });
  if (params.has('t')) state.t = parseFloat(params.get('t'));
  renderFrame(state.t);
  loop();

  function play() {
    state.playing = true; $('play').textContent = '❚❚ Pause';
    for (const a of [voice, music, sfx]) { a.currentTime = state.t; a.play().catch(() => {}); }
    state.lastNow = performance.now();
  }
  function pause() {
    state.playing = false; $('play').textContent = '▶ Play';
    for (const a of [voice, music, sfx]) a.pause();
  }
  function seek(t) {
    state.t = clamp(t, 0, TL.duration);
    for (const a of [voice, music, sfx]) { try { a.currentTime = state.t; } catch (e) { /* noch nicht geladen */ } }
    if (!state.playing) renderFrame(state.t);
  }
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = (now - state.lastNow) / 1000;
    state.lastNow = now;
    if (dt > 0) state.fps = lerp(state.fps || 60, 1 / dt, 0.05);
    if (!state.playing) return;
    // Master-Uhr = Voiceover (wenn es läuft), sonst Systemuhr
    if (!voice.paused && voice.readyState >= 2) state.t = voice.currentTime;
    else state.t += dt;
    for (const a of [music, sfx]) if (!a.paused && Math.abs(a.currentTime - state.t) > 0.15) a.currentTime = state.t;
    if (state.t >= TL.duration) { pause(); state.t = TL.duration; }
    scrub.value = state.t;
    $('time').textContent = `${fmt(state.t)} / ${fmt(TL.duration)}`;
    const sc = TL.scenes[TL.sceneIndexAt(state.t)];
    $('scene').textContent = `${sc.index + 1}. ${sc.title}`;
    renderFrame(state.t);
  }
}
