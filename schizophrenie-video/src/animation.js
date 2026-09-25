// =====================================================================
//  animation.js – Kern der Bildsprache
//  Mathematik, Easing, deterministischer Zufall, Rauschen, Farben,
//  virtuelle Kamera, Zeichen-Primitive (Glühen, Neuronen, Text …).
//  Alles ist eine reine Funktion der Zeit: kein Zustand zwischen Frames.
// =====================================================================

export const W = 1920;
export const H = 1080;
export const TAU = Math.PI * 2;

// ------------------------------------------------------------ Mathe
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => { const t = invLerp(a, b, x); return t * t * (3 - 2 * t); };
export const mix2 = (p, q, t) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const fract = (x) => x - Math.floor(x);

export const ease = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  expo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
};

/** Fortschritt 0..1 einer Animation, die bei t0 startet und dur Sekunden dauert. */
export function tween(t, t0, dur, e = ease.inOut) {
  if (dur <= 0) return t >= t0 ? 1 : 0;
  return e(clamp((t - t0) / dur));
}

/** Keyframe-Spur: keys = [[zeit, wert], ...]; Werte sind Zahlen oder Objekte mit Zahlfeldern. */
export function track(t, keys, e = ease.inOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const k = e(clamp((t - t0) / Math.max(1e-6, t1 - t0)));
      if (typeof v0 === 'number') return lerp(v0, v1, k);
      const o = {};
      for (const key in v0) o[key] = lerp(v0[key], v1[key], k);
      return o;
    }
  }
  return keys[keys.length - 1][1];
}

// ------------------------------------------------------------ Zufall & Rauschen
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.gauss = () => { let u = 0, v = 0; while (u === 0) u = f(); while (v === 0) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  return f;
}

export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); }

// 2D-Simplex-Rauschen (kompakt, deterministisch)
const _perm = new Uint8Array(512);
(() => { const r = rng(1337); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) _perm[i] = p[i & 255]; })();
const _g2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
export function noise2(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s), j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t), y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { const g = _g2[_perm[ii + _perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { const g = _g2[_perm[ii + i1 + _perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { const g = _g2[_perm[ii + 1 + _perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
  return 70 * n; // ~[-1, 1]
}
export const noise1 = (x, seed = 0) => noise2(x, seed * 17.13 + 3.7);

// ------------------------------------------------------------ Farben (visuelle Identität)
export const C = {
  bg0: '#03050b',
  bg1: '#081226',
  neuron: '#bcd4ff',     // neutrale Nervenzellen (kühles Weißblau)
  neuronDim: '#5b7bb8',
  gen: '#b18cff',        // Genetik – violett
  glu: '#2ee6ff',        // Glutamat – cyan
  gln: '#9ff5e1',        // Glutamin – helles Mint
  gaba: '#3ee089',       // GABA – grün
  da: '#ffd23f',         // Dopamin – gelb
  mg: '#ff9f43',         // Mikroglia – orange
  stress: '#ff5a4f',     // Stress – warmes Rot
  myelin: '#fff4dc',     // Myelin – helle Isolierschicht
  compl: '#ff6fb5',      // Komplement – pink
  thc: '#c6f25a',        // THC – limette
  ecb: '#e6fff6',        // Endocannabinoide
  astro: '#8f8cff',      // Astrozyt – indigo
  ca: '#e9fbff',         // Calcium-Ionen
  immune: '#ff9f43',
  text: '#eef3ff',
  textDim: '#9aa9c7',
  warn: '#ffb86b',
  pos: '#ffb347',
  neg: '#7d9bd6',
  cog: '#5fd4d0',
};

const _rgbCache = new Map();
export function hexToRgb(hex) {
  let v = _rgbCache.get(hex);
  if (v) return v;
  const h = hex.replace('#', '');
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  _rgbCache.set(hex, v);
  return v;
}
export function rgba(hex, a = 1) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${clamp(a)})`; }
export function mixColor(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], clamp(t))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------ Leucht-Sprites (schnelles additives Glühen)
const _spriteCache = new Map();
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
export { makeCanvas };

export function glowSprite(color, hard = 0) {
  const key = color + '|' + hard;
  let s = _spriteCache.get(key);
  if (s) return s;
  const R = 128;
  s = makeCanvas(R * 2, R * 2);
  const g = s.getContext('2d');
  const [r, gg, b] = hexToRgb(color);
  const grad = g.createRadialGradient(R, R, 0, R, R, R);
  if (hard) {
    grad.addColorStop(0, `rgba(255,255,255,1)`);
    grad.addColorStop(0.18, `rgba(${r},${gg},${b},1)`);
    grad.addColorStop(0.32, `rgba(${r},${gg},${b},0.35)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  } else {
    grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    grad.addColorStop(0.25, `rgba(${r},${gg},${b},0.45)`);
    grad.addColorStop(0.6, `rgba(${r},${gg},${b},0.1)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, R * 2, R * 2);
  _spriteCache.set(key, s);
  return s;
}

/** Additiver Lichtpunkt. r = Radius des Lichthofs. */
export function glow(ctx, x, y, r, color, a = 1, hard = 0) {
  if (a <= 0.003 || r <= 0.2) return;
  const prevA = ctx.globalAlpha, prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * clamp(a);
  ctx.drawImage(glowSprite(color, hard), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

/**
 * Viele Lichtpunkte in einem Zug (gleiche Farbe): spart pro Punkt die Zustandswechsel
 * von glow(). items: flache Liste [x, y, r, a, x, y, r, a, …].
 * op: 'lighter' (additiv, wie glow) oder 'source-over' (≈ halbe Kosten; auf dunklem Grund gleich).
 */
export function glowMany(ctx, items, color, hard = 0, op = 'lighter') {
  if (!items.length) return;
  const prevA = ctx.globalAlpha, prevOp = ctx.globalCompositeOperation;
  const spr = glowSprite(color, hard);
  ctx.globalCompositeOperation = op;
  for (let i = 0; i < items.length; i += 4) {
    const r = items[i + 2], a = items[i + 3];
    if (a <= 0.003 || r <= 0.2) continue;
    ctx.globalAlpha = prevA * clamp(a);
    ctx.drawImage(spr, items[i] - r, items[i + 1] - r, r * 2, r * 2);
  }
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

/** Heller Kern + Hof – für Partikel/Moleküle */
export function spark(ctx, x, y, r, color, a = 1) {
  glow(ctx, x, y, r * 4, color, a * 0.55);
  glow(ctx, x, y, r * 1.6, color, a, 1);
}

export function dot(ctx, x, y, r, color, a = 1) {
  if (a <= 0.003) return;
  ctx.fillStyle = rgba(color, a);
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fill();
}

export function ring(ctx, x, y, r, color, a = 1, w = 2, from = 0, to = TAU) {
  if (a <= 0.003) return;
  ctx.strokeStyle = rgba(color, a); ctx.lineWidth = w;
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), from, to); ctx.stroke();
}

// ------------------------------------------------------------ Kamera
export class Camera {
  constructor(x = 0, y = 0, zoom = 1, rot = 0) { this.x = x; this.y = y; this.zoom = zoom; this.rot = rot; }
  set(x, y, zoom = this.zoom, rot = 0) { this.x = x; this.y = y; this.zoom = zoom; this.rot = rot; return this; }
  from(o) { this.x = o.x; this.y = o.y; this.zoom = o.zoom ?? o.z ?? 1; this.rot = o.rot || 0; return this; }
  apply(ctx) {
    ctx.translate(W / 2, H / 2);
    if (this.rot) ctx.rotate(this.rot);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
  toScreen(p) {
    let dx = (p.x - this.x) * this.zoom, dy = (p.y - this.y) * this.zoom;
    if (this.rot) { const c = Math.cos(this.rot), s = Math.sin(this.rot); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; }
    return { x: W / 2 + dx, y: H / 2 + dy };
  }
}

/** Log-interpolierter Zoom (natürliches „Durchfliegen“ über Größenordnungen). */
export function zoomLerp(z0, z1, t) { return Math.exp(lerp(Math.log(z0), Math.log(z1), t)); }

/** Kamera-Spur mit log-Zoom: keys = [[t, {x,y,z}], ...] */
export function camTrack(t, keys, e = ease.inOut) {
  if (t <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i];
    const [t1, b] = keys[i + 1];
    if (t <= t1) {
      const k = e(clamp((t - t0) / Math.max(1e-6, t1 - t0)));
      // Beim Zoomen bleibt der Fokuspunkt stabil: Position linear in „Bildschirm-Raum“
      const z = zoomLerp(a.z, b.z, k);
      const wz = (1 / z - 1 / a.z) / ((1 / b.z - 1 / a.z) || 1e-9);
      const kk = Math.abs(b.z - a.z) > 1e-6 ? clamp(wz) : k;
      return { x: lerp(a.x, b.x, kk), y: lerp(a.y, b.y, kk), z, rot: lerp(a.rot || 0, b.rot || 0, k) };
    }
  }
  return { ...keys[keys.length - 1][1] };
}

// ------------------------------------------------------------ Pfade
export function catmull(pts, segs = 8, closed = false) {
  const out = [];
  const n = pts.length;
  if (n < 2) return pts.slice();
  const get = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < segs; s++) {
      const t = s / segs, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(closed ? { ...pts[0] } : { ...pts[n - 1] });
  return out;
}

export function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; }

/** Punkt bei Anteil f (0..1) entlang eines Polygonzugs */
export function pointAt(pts, f) {
  f = clamp(f);
  const L = polyLength(pts) * f;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= L) {
      const k = seg > 0 ? (L - acc) / seg : 0;
      return { x: lerp(pts[i - 1].x, pts[i].x, k), y: lerp(pts[i - 1].y, pts[i].y, k), a: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) };
    }
    acc += seg;
  }
  const p = pts[pts.length - 1];
  return { x: p.x, y: p.y, a: 0 };
}

/** Teilpfad [f0..f1] als Punktliste */
export function subPath(pts, f0, f1) {
  f0 = clamp(f0); f1 = clamp(f1);
  if (f1 <= f0) return [];
  if (f0 === 0 && f1 === 1) return pts.slice();          // häufigster Fall: ganzer Pfad
  const total = polyLength(pts);
  const L0 = total * f0, L1 = total * f1;
  const out = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const s0 = acc, s1 = acc + seg;
    if (s1 >= L0 && s0 <= L1) {
      const ka = seg > 0 ? clamp((L0 - s0) / seg) : 0;
      const kb = seg > 0 ? clamp((L1 - s0) / seg) : 1;
      if (!out.length) out.push({ x: lerp(a.x, b.x, ka), y: lerp(a.y, b.y, ka) });
      out.push({ x: lerp(a.x, b.x, kb), y: lerp(a.y, b.y, kb) });
    }
    acc = s1;
    if (acc > L1) break;
  }
  return out;
}

/** Geräte-Skalierung des aktuellen Transforms (für pixelgenaue Strichbreiten) */
export function deviceScale(ctx) {
  const m = ctx.getTransform();
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}

export function strokePath(ctx, pts, color, a = 1, w = 2, closed = false) {
  if (a <= 0.003 || pts.length < 2) return;
  // Dünne Striche (1–1,4 Geräte-px) als 1-px-Haarlinie mit gleicher „Tintenmenge“:
  // optisch gleich, im Software-Renderer aber ~3× schneller.
  const wd = w * deviceScale(ctx);
  if (wd > 1 && wd <= 1.4 && a * wd <= 1) { ctx.strokeStyle = rgba(color, a * wd); ctx.lineWidth = 0.999 * w / wd; }
  else { ctx.strokeStyle = rgba(color, a); ctx.lineWidth = w; }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
  ctx.stroke();
}

export function fillPath(ctx, pts, fill) {
  if (pts.length < 3) return;
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath(); ctx.fill();
}

/** Linie mit weichem Glühen (zweifach gezeichnet) */
export function glowPath(ctx, pts, color, a = 1, w = 2, glowW = 8) {
  if (a <= 0.003 || pts.length < 2) return;
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  strokePath(ctx, pts, color, a * 0.16, w + glowW);
  strokePath(ctx, pts, color, a * 0.22, w + glowW * 0.4);
  ctx.globalCompositeOperation = op;
  strokePath(ctx, pts, color, a, w);
}

/** Verjüngter Strich (Dendrit/Axon): Breite von w0 nach w1 */
export function taper(ctx, pts, w0, w1, color, a = 1) {
  if (a <= 0.003 || pts.length < 2) return;
  ctx.fillStyle = rgba(color, a);
  const n = pts.length;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let dx = q.x - o.x, dy = q.y - o.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const w = lerp(w0, w1, i / (n - 1)) / 2;
    left.push({ x: p.x - dy * w, y: p.y + dx * w });
    right.push({ x: p.x + dy * w, y: p.y - dx * w });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
  const e = pts[n - 1];
  ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1e-3, w1 / 2), 0, TAU); ctx.fill();
}

/** Organischer Umriss (Zellkörper): Radius moduliert durch Rauschen */
export function blobPts(x, y, r, seed = 0, t = 0, wob = 0.12, n = 40, stretch = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + wob * noise2(Math.cos(a) * 1.2 + seed * 9.1, Math.sin(a) * 1.2 + t * 0.35 + seed);
    pts.push({ x: x + Math.cos(a) * r * k * stretch, y: y + Math.sin(a) * r * k });
  }
  return pts;
}

export function blob(ctx, x, y, r, color, a = 1, seed = 0, t = 0, wob = 0.12) {
  const pts = catmull(blobPts(x, y, r, seed, t, wob, 14), 4, true);
  fillPath(ctx, pts, rgba(color, a));
  return pts;
}

// ------------------------------------------------------------ Text
export const FONT = {
  display: 'InterDisplay, Inter, "IBM Plex Sans", system-ui, sans-serif',
  text: 'Inter, "IBM Plex Sans", system-ui, sans-serif',
};

/**
 * Text mit Einblend-Animation.
 * opts: size, weight(400|500|600|700|800), color, alpha, align('left'|'center'|'right'),
 *       base('middle'|'alphabetic'|'top'), spacing(px), font('display'|'text'),
 *       reveal(0..1) – zeichenweises Einblenden mit leichter Aufwärtsbewegung,
 *       glow(0..1) – leichtes Leuchten
 * Rückgabe: Textbreite (px)
 */
const _glyphCache = new Map();
/** x-Versätze aller Zeichen aus Präfix-Messungen (inkl. Kerning) → Einblenden ohne Sprung am Ende. */
function glyphOffsets(ctx, chars, key) {
  let a = _glyphCache.get(key);
  if (a) return a;
  a = new Float32Array(chars.length + 1);
  let acc = '';
  for (let i = 0; i < chars.length; i++) { acc += chars[i]; a[i + 1] = ctx.measureText(acc).width; }
  // erst cachen, wenn alle Schriften geladen sind (sonst würden Maße der Ersatzschrift gespeichert)
  if (typeof document === 'undefined' || document.fonts.status === 'loaded') {
    if (_glyphCache.size > 1500) _glyphCache.clear();
    _glyphCache.set(key, a);
  }
  return a;
}

export function text(ctx, str, x, y, o = {}) {
  const size = o.size ?? 40, weight = o.weight ?? 600, color = o.color ?? C.text;
  const alpha = o.alpha ?? 1, align = o.align ?? 'center', base = o.base ?? 'middle';
  const reveal = o.reveal ?? 1, spacing = o.spacing ?? 0;
  if (alpha <= 0.003 || reveal <= 0) return 0;
  ctx.save();
  const font = `${weight} ${size}px ${o.font === 'text' ? FONT.text : FONT.display}`;
  ctx.font = font;
  ctx.textBaseline = base;
  const hasLS = 'letterSpacing' in ctx;
  if (hasLS) ctx.letterSpacing = `${spacing}px`;
  const width = ctx.measureText(str).width;
  let x0 = x;
  if (align === 'center') x0 = x - width / 2;
  else if (align === 'right') x0 = x - width;
  ctx.textAlign = 'left';
  if (o.glow) {
    ctx.shadowColor = rgba(color, 0.55 * o.glow);
    ctx.shadowBlur = size * 0.45;
  }
  if (reveal >= 1) {
    ctx.fillStyle = rgba(color, alpha);
    ctx.fillText(str, x0, y);
  } else {
    // zeichenweise: jedes Zeichen blendet weich ein und setzt sich mit sanfter Aufwärtsbewegung
    const chars = Array.from(str);
    const n = chars.length, span = 6;
    const off = hasLS ? glyphOffsets(ctx, chars, `${font}|${spacing}|${str}`) : null;
    const px = (i) => (off ? off[i] : i === 0 ? 0 : ctx.measureText(chars.slice(0, i).join('')).width + spacing * i);
    // bereits vollständig sichtbare Zeichen in einem Zug zeichnen (identische Glyphenlage wie am Ende)
    let done = 0;
    while (done < n && reveal * (n + span) / span - done / span >= 1) done++;
    if (done > 0) {
      ctx.fillStyle = rgba(color, alpha);
      ctx.fillText(done === n ? str : chars.slice(0, done).join(''), x0, y);
    }
    for (let i = done; i < n; i++) {
      const k = clamp(reveal * (n + span) / span - i / span);
      if (k <= 0) break;
      const ka = k * k * (3 - 2 * k);
      const km = 1 - Math.pow(1 - k, 4);
      ctx.fillStyle = rgba(color, alpha * ka);
      ctx.fillText(chars[i], x0 + px(i), y + (1 - km) * size * 0.3);
    }
  }
  ctx.restore();
  return width;
}

const _capCache = new Map();
/** Versalhöhe einer Schrift (für optisch exakt zentrierte Beschriftungen). */
export function capHeight(ctx, size, weight = 600, font = 'text') {
  const key = `${weight}|${size}|${font}`;
  let v = _capCache.get(key);
  if (v) return v;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font === 'text' ? FONT.text : FONT.display}`;
  v = ctx.measureText('H').actualBoundingBoxAscent || size * 0.727;
  ctx.restore();
  if (typeof document === 'undefined' || document.fonts.status === 'loaded') _capCache.set(key, v);
  return v;
}

export function measure(ctx, str, size, weight = 600, font = 'display', spacing = 0) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font === 'text' ? FONT.text : FONT.display}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Beschriftung mit feiner Führungslinie (Leader) von Anker zum Text. */
export function callout(ctx, ax, ay, tx, ty, str, o = {}) {
  const p = o.p ?? 1, color = o.color ?? C.text, lineColor = o.lineColor ?? color;
  if (p <= 0) return;
  const a = o.alpha ?? 1;
  const k1 = clamp(p * 2), k2 = clamp(p * 2 - 1);
  const mx = tx + (tx > ax ? -14 : 14);
  const pts = [{ x: ax, y: ay }, { x: mx, y: ty }, { x: tx, y: ty }];
  strokePath(ctx, subPath(pts, 0, ease.out(k1)), lineColor, a * 0.7, o.lw ?? 1.5);
  dot(ctx, ax, ay, 3.2, lineColor, a * k1);
  ring(ctx, ax, ay, 3.2 + 4.5 * ease.out(k1), lineColor, a * k1 * 0.3, 1.2);
  text(ctx, str, tx + (tx > ax ? 12 : -12), ty, { size: o.size ?? 28, weight: o.weight ?? 600, color, alpha: a, align: tx > ax ? 'left' : 'right', reveal: k2, font: o.font });
}

/** Kleines Etikett (z. B. „Hypothese“) mit Rahmen – optisch exakt zentriert, sanftes Erscheinen */
export function badge(ctx, str, x, y, o = {}) {
  const size = o.size ?? 22, color = o.color ?? C.warn, p = clamp(o.p ?? 1), a = (o.alpha ?? 1) * p;
  if (a <= 0.003) return;
  const sp = 0.9;
  const tw = measure(ctx, str, size, 600, 'text', sp) - sp;   // ohne Laufweite nach dem letzten Zeichen
  const padX = size * 0.8;
  const w = tw + padX * 2;
  const h = size * 1.72;
  const x0 = (o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2);
  const k = ease.out(p), sc = 0.94 + 0.06 * k;
  ctx.save();
  if (sc < 0.999) { const cx = x0 + w / 2; ctx.translate(cx, y); ctx.scale(sc, sc); ctx.translate(-cx, -y); }
  ctx.fillStyle = rgba(color, a * 0.1);
  roundRect(ctx, x0, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = rgba(color, a * 0.72); ctx.lineWidth = 1.3;
  roundRect(ctx, x0 + 0.5, y - h / 2 + 0.5, w - 1, h - 1, h / 2 - 0.5); ctx.stroke();
  text(ctx, str, x0 + padX, y + capHeight(ctx, size, 600, 'text') / 2, { size, weight: 600, color, alpha: a, font: 'text', spacing: sp, align: 'left', base: 'alphabetic' });
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Szenen-Überschrift oben links (Kicker + Titel), dezent */
export function heading(ctx, kicker, title, p = 1, o = {}) {
  if (p <= 0) return;
  const x = o.x ?? 110, y = o.y ?? 108;
  const a = o.alpha ?? 1;
  const k = ease.out(clamp(p));
  ctx.save();
  strokePath(ctx, [{ x, y: y - 42 }, { x: x + 46 * k, y: y - 42 }], o.color ?? C.glu, a * k, 3);
  ctx.restore();
  if (kicker) text(ctx, kicker.toUpperCase(), x, y - 12, { size: 20, weight: 600, color: C.textDim, alpha: a * k, align: 'left', font: 'text', spacing: 3, reveal: clamp(p * 1.4) });
  text(ctx, title, x, y + 28, { size: 44, weight: 700, color: C.text, alpha: a, align: 'left', reveal: clamp(p * 1.2 - 0.1) });
}

/** Großer zentrierter Aussagesatz */
export function statement(ctx, str, y, p = 1, o = {}) {
  if (p <= 0) return;
  text(ctx, str, o.x ?? W / 2, y, { size: o.size ?? 64, weight: o.weight ?? 700, color: o.color ?? C.text, alpha: (o.alpha ?? 1), reveal: clamp(p), spacing: o.spacing ?? 0, glow: o.glow ?? 0.4 });
}

// ------------------------------------------------------------ Nervenzellen
/**
 * Erzeugt eine Nervenzelle mit verzweigten Dendriten und Axon.
 * Rückgabe: { x, y, r, branches:[{pts, s, e, w0, w1, depth}], axon:{pts,s,e}, spines:[{b, f, side}] }
 * s/e = Anteil des Wachstums (0..1), in dem der Ast wächst.
 */
export function makeNeuron(seed, o = {}) {
  const R = rng(seed);
  const x = o.x ?? 0, y = o.y ?? 0, size = o.size ?? 1;
  const r = (o.somaR ?? 16) * size;
  const nDend = o.dendrites ?? R.int(4, 7);
  const branches = [];
  const baseAng = o.angle ?? R.range(0, TAU);
  const grow = (px, py, ang, len, w, depth, s, parent) => {
    const segs = 6;
    const pts = [{ x: px, y: py }];
    let a = ang, cx = px, cy = py;
    for (let i = 1; i <= segs; i++) {
      a += R.range(-0.28, 0.28);
      cx += Math.cos(a) * len / segs; cy += Math.sin(a) * len / segs;
      pts.push({ x: cx, y: cy });
    }
    const sm = catmull(pts, 3);
    const e = Math.min(1, s + (o.growSpan ?? 0.35) * (0.6 + 0.4 * len / (90 * size)));
    const br = { pts: sm, s, e, w0: w, w1: w * 0.35, depth, parent };
    branches.push(br);
    if (depth < (o.maxDepth ?? 3) && len > 18 * size) {
      const kids = depth === 0 ? 2 : R.int(1, 2);
      for (let k = 0; k < kids; k++) {
        const f = R.range(0.45, 0.95);
        const p = pointAt(sm, f);
        grow(p.x, p.y, a + R.range(-0.9, 0.9), len * R.range(0.5, 0.75), w * 0.6, depth + 1, lerp(s, e, f), br);
      }
    }
  };
  for (let i = 0; i < nDend; i++) {
    const ang = baseAng + (i / nDend) * TAU + R.range(-0.3, 0.3);
    grow(x + Math.cos(ang) * r * 0.7, y + Math.sin(ang) * r * 0.7, ang, R.range(60, 110) * size * (o.dendLen ?? 1), (o.dendW ?? 5) * size, 0, R.range(0.0, 0.15));
  }
  let axon = null;
  if (o.axonLen !== 0) {
    const aang = o.axonAngle ?? baseAng + Math.PI + R.range(-0.3, 0.3);
    const L = (o.axonLen ?? 260) * size;
    const pts = [{ x: x + Math.cos(aang) * r, y: y + Math.sin(aang) * r }];
    let a = aang, cx = pts[0].x, cy = pts[0].y;
    for (let i = 1; i <= 10; i++) { a += R.range(-0.16, 0.16); cx += Math.cos(a) * L / 10; cy += Math.sin(a) * L / 10; pts.push({ x: cx, y: cy }); }
    axon = { pts: catmull(pts, 4), s: 0.1, e: 0.85 };
  }
  // Dornen (Spines) auf Dendriten
  const spines = [];
  if (o.spines) {
    for (const b of branches) {
      if (b.depth === 0) continue;
      const n = R.int(2, 5);
      for (let i = 0; i < n; i++) spines.push({ b, f: R.range(0.2, 0.95), side: R() < 0.5 ? -1 : 1, len: R.range(5, 9) * size });
    }
  }
  return { x, y, r, branches, axon, spines, seed };
}

/**
 * Zeichnet eine Nervenzelle. grow 0..1 steuert das Wachstum.
 * o: color, alpha, t (Zeit für Bewegung), glow, lw (Linienfaktor), axonColor
 */
export function drawNeuron(ctx, N, grow = 1, o = {}) {
  const color = o.color ?? C.neuron, a = o.alpha ?? 1, t = o.t ?? 0;
  if (a <= 0.003) return;
  const lw = o.lw ?? 1;
  for (const b of N.branches) {
    const k = clamp((grow - b.s) / (b.e - b.s));
    if (k <= 0) continue;
    const pts = subPath(b.pts, 0, ease.out(k));
    if (pts.length < 2) continue;
    taper(ctx, pts, b.w0 * lw, lerp(b.w0, b.w1, k) * lw, mixColor(color, '#2a3d6e', b.depth * 0.18), a);
  }
  if (N.axon && o.axon !== false) {
    const k = clamp((grow - N.axon.s) / (N.axon.e - N.axon.s));
    if (k > 0) {
      const pts = subPath(N.axon.pts, 0, ease.out(k));
      strokePath(ctx, pts, o.axonColor ?? color, a * 0.8, 2.2 * lw * (N.r / 16));
    }
  }
  if (N.spines.length && grow > 0.7) {
    const sa = a * clamp((grow - 0.7) / 0.3);
    ctx.strokeStyle = rgba(color, sa * 0.8); ctx.lineWidth = 1.2 * lw;
    for (const s of N.spines) {
      const p = pointAt(s.b.pts, s.f);
      const nx = -Math.sin(p.a) * s.side, ny = Math.cos(p.a) * s.side;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + nx * s.len, p.y + ny * s.len); ctx.stroke();
      dot(ctx, p.x + nx * s.len, p.y + ny * s.len, 1.8 * lw, color, sa);
    }
  }
  const sk = clamp(grow / 0.12);
  if (sk > 0) {
    const pts = catmull(blobPts(N.x, N.y, N.r * ease.outBack(sk), N.seed, t, 0.14, 12), 4, true);
    ctx.save();
    const g = ctx.createRadialGradient(N.x - N.r * 0.3, N.y - N.r * 0.3, 0, N.x, N.y, N.r * 1.3);
    g.addColorStop(0, rgba('#ffffff', a * 0.95));
    g.addColorStop(0.35, rgba(color, a * 0.9));
    g.addColorStop(1, rgba(color, a * 0.55));
    fillPath(ctx, pts, g);
    ctx.restore();
    if (o.glow) glow(ctx, N.x, N.y, N.r * 4, color, a * o.glow);
  }
}

// ------------------------------------------------------------ Gehirn (Seitenansicht, Stirn links)
const BRAIN_OUTLINE = [
  [-480, -20], [-472, -140], [-425, -252], [-335, -332], [-212, -378], [-72, -392], [70, -386], [200, -360],
  [322, -310], [412, -240], [470, -150], [495, -40], [482, 58], [432, 128], [352, 162], [250, 170], [150, 192],
  [40, 216], [-80, 226], [-188, 206], [-258, 160], [-282, 102], [-304, 64], [-382, 82], [-450, 60],
].map(([x, y]) => ({ x, y }));
export const brainOutline = catmull(BRAIN_OUTLINE, 6, true);
export const cerebellumOutline = catmull([
  [180, 190], [250, 178], [340, 170], [420, 190], [468, 238], [455, 296], [390, 330], [300, 336], [225, 310], [190, 258],
].map(([x, y]) => ({ x, y })), 6, true);
export const brainstemOutline = catmull([
  [140, 200], [220, 196], [236, 260], [232, 330], [246, 440], [196, 446], [170, 340], [150, 270],
].map(([x, y]) => ({ x, y })), 6, true);

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + 1e-9) + a.x) inside = !inside;
  }
  return inside;
}

/** Punkte gleichmäßig im Gehirn verteilen (Poisson-ähnlich) */
export function samplesInBrain(n, seed = 3, minD = 22) {
  const R = rng(seed);
  const out = [];
  let tries = 0;
  while (out.length < n && tries < n * 60) {
    tries++;
    const p = { x: R.range(-490, 500), y: R.range(-395, 230) };
    if (!pointInPoly(p, brainOutline)) continue;
    let ok = true;
    for (const q of out) { if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < minD * minD) { ok = false; break; } }
    if (ok) out.push(p);
  }
  return out;
}

// Gyri: Rauschen-Flusslinien innerhalb des Umrisses (einmal berechnet)
let _gyri = null;
export function brainGyri() {
  if (_gyri) return _gyri;
  const R = rng(77);
  const lines = [];
  // Zentralfurche und Sylvische Furche (anatomische Orientierung)
  lines.push({ pts: catmull([{ x: 30, y: -386 }, { x: 10, y: -300 }, { x: 24, y: -210 }, { x: -6, y: -120 }, { x: 8, y: -40 }, { x: -18, y: 40 }], 6), w: 2.2, major: true });
  lines.push({ pts: catmull([{ x: -292, y: 70 }, { x: -200, y: 40 }, { x: -80, y: 20 }, { x: 60, y: -10 }, { x: 180, y: -40 }, { x: 280, y: -60 }], 6), w: 2.4, major: true });
  for (let i = 0; i < 70; i++) {
    let p = { x: R.range(-470, 480), y: R.range(-380, 200) };
    if (!pointInPoly(p, brainOutline)) { i--; continue; }
    const pts = [p];
    const len = R.int(8, 16);
    const sc = 0.0055;
    for (let k = 0; k < len; k++) {
      const a = noise2(p.x * sc + 11, p.y * sc - 7) * Math.PI * 1.6 + R.range(-0.4, 0.4);
      const q = { x: p.x + Math.cos(a) * 13, y: p.y + Math.sin(a) * 13 };
      if (!pointInPoly(q, brainOutline)) break;
      pts.push(q); p = q;
    }
    if (pts.length > 4) lines.push({ pts: catmull(pts, 3), w: R.range(1.2, 2), major: false });
  }
  _gyri = lines;
  return lines;
}

// Kleinhirn-Falten (statisch, einmal berechnet)
let _cbFolds = null;
function cerebellumFolds() {
  if (_cbFolds) return _cbFolds;
  _cbFolds = [];
  for (let i = 0; i < 6; i++) {
    const yy = 200 + i * 22;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const xx = 200 + k * 16;
      const p = { x: xx, y: yy + Math.sin(k * 0.8 + i) * 4 + (xx - 330) * (xx - 330) * 0.0006 * (i - 2) };
      if (pointInPoly(p, cerebellumOutline)) pts.push(p);
    }
    _cbFolds.push(pts);
  }
  return _cbFolds;
}

/**
 * Zeichnet das stilisierte Gehirn (Seitenansicht) im aktuellen Koordinatensystem.
 * o: alpha, draw (0..1 Kontur zeichnen), fill, gyri(0..1), color, cerebellum
 */
export function drawBrain(ctx, o = {}) {
  const a = o.alpha ?? 1, color = o.color ?? C.neuron, d = o.draw ?? 1;
  if (a <= 0.003) return;
  if (o.fill !== 0) {
    ctx.save();
    const g = ctx.createRadialGradient(-80, -120, 40, 0, -60, 620);
    g.addColorStop(0, rgba('#1b2d55', a * (o.fill ?? 0.55)));
    g.addColorStop(1, rgba('#0a1430', a * (o.fill ?? 0.55) * 0.6));
    fillPath(ctx, brainOutline, g);
    if (o.cerebellum !== false) {
      fillPath(ctx, brainstemOutline, rgba('#0e1a38', a * (o.fill ?? 0.55)));
      fillPath(ctx, cerebellumOutline, rgba('#12224a', a * (o.fill ?? 0.55)));
    }
    ctx.restore();
  }
  const gy = o.gyri ?? 1;
  if (gy > 0) {
    for (const l of brainGyri()) {
      strokePath(ctx, d >= 1 ? l.pts : subPath(l.pts, 0, d), color, a * gy * (l.major ? 0.5 : 0.22), l.w);
    }
    if (o.cerebellum !== false) {
      for (const pts of cerebellumFolds()) strokePath(ctx, pts, color, a * gy * 0.22, 1.4);
    }
  }
  glowPath(ctx, subPath(brainOutline, 0, d), color, a * 0.85, o.lw ?? 2.4, 10);
  if (o.cerebellum !== false) {
    glowPath(ctx, subPath(cerebellumOutline, 0, d), color, a * 0.6, 1.8, 6);
    strokePath(ctx, subPath(brainstemOutline, 0, d), color, a * 0.5, 1.6);
  }
}

export const BRAIN_REGIONS = {
  pfc: { x: -360, y: -150 },
  motor: { x: -20, y: -300 },
  parietal: { x: 250, y: -240 },
  occipital: { x: 420, y: -40 },
  temporal: { x: -80, y: 140 },
  hippocampus: { x: 40, y: 110 },
  striatum: { x: -120, y: -40 },
  thalamus: { x: 30, y: -40 },
  midbrain: { x: 150, y: 150 },
  hypothalamus: { x: -60, y: 70 },
  pituitary: { x: -70, y: 150 },
};

// ------------------------------------------------------------ Silhouette (Kopf & Oberkörper, Profil nach links)
const HEAD = [
  [40, -520], [-160, -505], [-340, -440], [-470, -330], [-560, -190], [-586, -70], [-596, 0], [-640, 70],
  [-690, 150], [-676, 172], [-632, 190], [-634, 222], [-618, 246], [-640, 262], [-628, 286], [-642, 304],
  [-618, 330], [-600, 380], [-560, 420], [-470, 446], [-330, 450], [-300, 520], [-310, 600],
  // Brust & Schulter
  [-360, 700], [-430, 800], [-470, 930], [-480, 1080], [560, 1080], [560, 920], [520, 790], [440, 700],
  // Nacken/Hinterkopf
  [330, 600], [300, 480], [390, 400], [500, 280], [560, 120], [566, -60], [520, -250], [420, -410], [250, -500],
].map(([x, y]) => ({ x, y }));
export const figureOutline = catmull(HEAD, 6, true);

export function drawFigure(ctx, o = {}) {
  const a = o.alpha ?? 1, color = o.color ?? C.neuron;
  if (a <= 0.003) return;
  ctx.save();
  const g = ctx.createLinearGradient(-600, -500, 500, 1000);
  g.addColorStop(0, rgba('#132449', a * (o.fill ?? 0.7)));
  g.addColorStop(1, rgba('#070d1f', a * (o.fill ?? 0.7)));
  fillPath(ctx, figureOutline, g);
  ctx.restore();
  glowPath(ctx, subPath(figureOutline, 0, o.draw ?? 1), color, a * 0.7, 2.2, 14);
}
