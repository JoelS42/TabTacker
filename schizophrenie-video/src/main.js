// =====================================================================
//  main.js – Player, Hintergrund, Untertitel, Debug, Render-Schnittstelle
// =====================================================================
import { W, H, C, clamp, lerp, rgba, glow, rng, noise2, fract, ease, makeCanvas, text, roundRect, FONT, measure } from './animation.js';
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

// ------------------------------------------------------------ Hintergrund
const bokeh = (() => {
  const R = rng(2024);
  return Array.from({ length: 150 }, (_, i) => ({
    a: R.range(0, Math.PI * 2), u: R(), layer: i % 3, size: R.range(0.6, 1.8), hue: R() < 0.12 ? C.gen : R() < 0.2 ? C.glu : C.neuron, tw: R.range(0, 10),
  }));
})();
const grain = (() => {
  const tiles = [];
  for (let k = 0; k < 4; k++) {
    const c = makeCanvas(256, 256), g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    const R = rng(99 + k);
    for (let i = 0; i < img.data.length; i += 4) { const v = 110 + R() * 40; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
})();
let vignette = null;

function drawBackground(c, t) {
  const g = c.createRadialGradient(W * 0.5, H * 0.46, 60, W * 0.5, H * 0.5, W * 0.72);
  g.addColorStop(0, '#0b1631');
  g.addColorStop(0.55, '#060c1c');
  g.addColorStop(1, '#020309');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // Parallax-Bokeh: bewegt sich mit der „Reisetiefe“ G (Zoom hinein → nach außen)
  const G = TL.travelAt(t);
  const speeds = [0.35, 0.6, 1.0];
  const rMin = 30, rMax = 1250, lr = Math.log(rMax / rMin);
  for (const b of bokeh) {
    const u = fract(b.u + G * speeds[b.layer] * 0.5);
    const r = rMin * Math.exp(u * lr);
    const x = W / 2 + Math.cos(b.a + noise2(b.tw, t * 0.02) * 0.2) * r * 1.2;
    const y = H / 2 + Math.sin(b.a + noise2(b.tw, t * 0.02) * 0.2) * r * 0.8;
    const fade = Math.sin(Math.PI * u);
    const s = (b.layer + 1) * b.size * (0.6 + u * 2.2);
    glow(c, x, y, s * 6, b.hue, 0.05 * fade * (0.7 + 0.3 * Math.sin(t * 0.7 + b.tw)));
  }
  // Kaltstart: am Anfang ist alles schwarz, nur der Lichtpunkt der ersten Szene leuchtet
  const black = 1 - clamp((t - 4) / 7);
  if (black > 0) { c.fillStyle = `rgba(0,0,0,${black})`; c.fillRect(0, 0, W, H); }
}

function drawPost(c, t) {
  if (!vignette) {
    vignette = makeCanvas(W, H);
    const v = vignette.getContext('2d');
    const g = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
  }
  c.drawImage(vignette, 0, 0);
  // Feines, statisches Korn gegen Banding in dunklen Verläufen (statisch = effizient kodierbar)
  c.save();
  c.globalAlpha = 0.035;
  c.globalCompositeOperation = 'overlay';
  for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) c.drawImage(grain[0], x, y);
  c.restore();
}
const hash2 = (x) => fract(Math.sin(Math.floor(x * 24) * 91.7) * 43758.5);

// ------------------------------------------------------------ Szenen zeichnen
function drawLayer(c, layer, t) {
  const sc = layer.scene;
  const S = TL.context(sc, t, layer);
  c.save();
  if (layer.tr && layer.phase !== 'main') {
    const tr = layer.tr, k = layer.k;
    let s = 1;
    if (tr.type === 'zoomIn') s = layer.phase === 'out' ? lerp(1, 1.9, ease.in(k)) : lerp(0.62, 1, ease.out(k));
    else if (tr.type === 'zoomOut') s = layer.phase === 'out' ? lerp(1, 0.6, ease.in(k)) : lerp(1.7, 1, ease.out(k));
    else if (tr.type === 'fade') s = layer.phase === 'out' ? lerp(1, 1.04, k) : lerp(0.97, 1, k);
    const fx = tr.type === 'zoomIn' && layer.phase === 'out' ? (tr.fromX ?? tr.fx) : tr.fx;
    const fy = tr.type === 'zoomIn' && layer.phase === 'out' ? (tr.fromY ?? tr.fy) : tr.fy;
    c.translate(fx, fy); c.scale(s, s); c.translate(-fx, -fy);
  }
  sc.mod.draw(c, S);
  c.restore();
}

function renderFrame(t) {
  state.t = t;
  TL.lifecycle(t);
  drawBackground(ctx, t);
  const layers = TL.layersAt(t);
  if (layers.length === 1) {
    drawLayer(ctx, layers[0], t);
  } else {
    for (const [i, layer] of layers.entries()) {
      const b = i === 0 ? ctxA : ctxB;
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.globalAlpha = 1;
      b.globalCompositeOperation = 'source-over';
      b.clearRect(0, 0, W, H);
      drawLayer(b, layer, t);
      ctx.save();
      ctx.globalAlpha = clamp(layer.weight);
      ctx.drawImage(i === 0 ? bufA : bufB, 0, 0);
      ctx.restore();
    }
  }
  drawPost(ctx, t);
  if (state.subs) drawSubtitles(ctx, t);
  if (state.debug) drawDebug(ctx, t, layers);
}

// ------------------------------------------------------------ Untertitel (max. 2 Zeilen, Wort-Highlight)
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
  return chunks.map((ws, i) => ({ words: ws, start: ws[0].start, end: ws[ws.length - 1].end + 0.25 }))
    .map((c, i, arr) => ({ ...c, end: i + 1 < arr.length ? Math.min(c.end, arr[i + 1].start - 0.02) : c.end }));
})();

function splitLines(c, words, size) {
  const full = words.map((w) => w.w).join(' ');
  if (measure(c, full, size, 500, 'text') < 1400) return [words];
  let best = null, bestD = 1e9;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).map((w) => w.w).join(' '), b = words.slice(i).map((w) => w.w).join(' ');
    const d = Math.abs(a.length - b.length) + (/[,:;–]$/.test(words[i - 1].w) ? 0 : 6);
    if (d < bestD) { bestD = d; best = i; }
  }
  return [words.slice(0, best), words.slice(best)];
}

function drawSubtitles(c, t) {
  const ch = subtitleChunks.find((x) => t >= x.start - 0.05 && t < x.end);
  if (!ch) return;
  const a = clamp((t - ch.start + 0.05) / 0.18) * clamp((ch.end - t) / 0.18);
  const size = 34;
  const lines = splitLines(c, ch.words, size);
  c.save();
  c.font = `500 ${size}px ${FONT.text}`;
  const lh = size * 1.32;
  const widths = lines.map((l) => c.measureText(l.map((w) => w.w).join(' ')).width);
  const bw = Math.max(...widths) + 56, bh = lines.length * lh + 26;
  const by = H - 62 - bh;
  c.fillStyle = `rgba(3,6,14,${0.62 * a})`;
  roundRect(c, W / 2 - bw / 2, by, bw, bh, 14); c.fill();
  c.textBaseline = 'middle';
  lines.forEach((l, li) => {
    let x = W / 2 - widths[li] / 2;
    const y = by + 13 + lh * (li + 0.5);
    for (const w of l) {
      const active = t >= w.start && t < w.end + 0.08;
      const spoken = t >= w.start;
      c.fillStyle = active ? `rgba(255,255,255,${a})` : spoken ? `rgba(226,233,248,${a * 0.95})` : `rgba(170,184,212,${a * 0.8})`;
      c.fillText(w.w, x, y);
      if (active) { c.fillStyle = `rgba(46,230,255,${0.8 * a})`; c.fillRect(x, y + size * 0.62, c.measureText(w.w).width, 2); }
      x += c.measureText(w.w + ' ').width;
    }
  });
  c.restore();
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
  duration: TL.duration,
  scenes: TL.scenes.map((s) => ({ id: s.id, title: s.title, start: s.start, end: s.end })),
  frame(t) { renderFrame(t); return true; },
  sfxEvents: () => TL.sfxEvents(),
  missingCues: () => [...missingCues],
  setSubs(v) { state.subs = !!v; },
  ready: document.fonts.ready.then(() => document.fonts.load(`700 40px InterDisplay`)).then(() => true),
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
