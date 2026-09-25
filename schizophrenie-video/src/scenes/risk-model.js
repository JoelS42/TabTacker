// Szenen 19 + 20 – Vulnerabilitäts-Stress-Modell (Federwaage) und drei Lebenswege
import { W, H, C, TAU, clamp, lerp, ease, tween, glow, spark, dot, text, rgba, heading, statement, badge, strokePath, glowPath, fillPath, catmull, fract, noise2, mixColor, roundRect, subPath, pointAt, smoothstep } from '../animation.js';
import { person } from './shared.js';

// ================================================================ model
const LEFT = [{ cue: 'l1', label: 'Genetik' }, { cue: 'l2', label: 'frühe Entwicklung' }, { cue: 'l3', label: 'neuronale Reifung' }];
const RIGHT = [{ cue: 'r1', label: 'Stress' }, { cue: 'r2', label: 'Cannabis' }, { cue: 'r3', label: 'Umwelt' }, { cue: 'r4', label: 'weitere Faktoren' }];
const EXTRA = [{ off: 0.0, label: 'Belastung' }, { off: 0.7, label: 'Belastung' }];
const PROT = [{ cue: 'p1', label: 'stabile Beziehungen' }, { cue: 'p2', label: 'ausreichend Schlaf' }, { cue: 'p3', label: 'Strategien gegen Stress' }, { cue: 'p4', label: 'frühe Unterstützung' }];
const THR = 800;

function spring(ctx, x, y0, y1, a, col, coils = 11, w = 34) {
  const pts = [{ x, y: y0 }];
  for (let i = 1; i < coils * 2; i++) pts.push({ x: x + (i % 2 ? -w : w), y: lerp(y0 + 14, y1 - 14, i / (coils * 2)) });
  pts.push({ x, y: y1 });
  glowPath(ctx, pts, col, a, 3, 8);
}

function block(ctx, x, y, w, h, col, label, a) {
  ctx.save(); ctx.fillStyle = rgba(col, 0.28 * a); ctx.strokeStyle = rgba(col, a); ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - h, w, h, 8); ctx.fill(); ctx.stroke(); ctx.restore();
  text(ctx, label, x, y - h / 2 + 1, { size: 19, weight: 600, color: C.text, font: 'text', alpha: a });
}

export const model = {
  id: 'model',
  transition: { type: 'fade', dur: 1.8 },
  sfx: [['chime', 'vsm', 0, 0.3], ['click', 'l1', 0.3, 0.4], ['click', 'l2', 0.3, 0.4], ['click', 'l3', 0.3, 0.4], ['click', 'r1', 0.3, 0.4], ['click', 'r2', 0.3, 0.4], ['click', 'r3', 0.3, 0.4], ['click', 'r4', 0.3, 0.4],
    ['click', 'tip', 0.3, 0.5], ['click', 'tip', 1.0, 0.5], ['low', 'tip', 1.6, 0.6], ['chime', 'p1', 0, 0.3], ['chime', 'p2', 0, 0.3], ['chime', 'p3', 0, 0.3], ['chime', 'p4', 0, 0.3], ['swell', 'combo', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.4, 1.2);
    heading(ctx, 'Akt VI · Modell', 'Vulnerabilitäts-Stress-Modell', S.on('vsm', 1.2, ease.out) * (1 - S.on('notone', 1.0) * 0.0), { color: C.gen });
    const fit = S.win('fit', 'vsm', 0.6, 0.6);
    if (fit > 0) statement(ctx, 'Wie passt das zusammen?', 520, fit, { size: 56 });
    const sc = Math.max(0.3 * A * (1 - fit), S.on('vsm', 1.4));
    if (sc <= 0) return;
    // Last & Stütze
    const wl = LEFT.map((l) => S.on(l.cue, 1.0, ease.outBack, 0.2));
    const wr = RIGHT.map((r) => S.on(r.cue, 1.0, ease.outBack, 0.2));
    const we = EXTRA.map((e) => S.on('tip', 1.0, ease.outBack, 0.3 + e.off));
    const wp = PROT.map((p) => S.on(p.cue, 1.2, ease.inOut));
    const load = wl.reduce((a, b) => a + b, 0) + wr.reduce((a, b) => a + b, 0) + we.reduce((a, b) => a + b, 0);
    const support = wp.reduce((a, b) => a + b, 0);
    const bob = Math.sin(t * 2.2) * 4 * sc;
    const beamY = 290 + load * 31 - support * 20 + bob;
    const tilt = (wr.reduce((a, b) => a + b, 0) + we.reduce((a, b) => a + b, 0) - wl.reduce((a, b) => a + b, 0)) * 0.012;
    // Aufhängung + Feder
    strokePath(ctx, [{ x: 760, y: 100 }, { x: 1160, y: 100 }], C.textDim, sc * A, 6);
    const stable = S.on('stable', 1.0) * (1 - S.on('tip', 1.0)) + S.on('protect', 1.0);
    spring(ctx, 960, 100, beamY - 20, sc * A, mixColor('#9fb3e6', C.gaba, clamp(stable)));
    const L = 400;
    const lx = 960 - L * Math.cos(tilt), ly = beamY + L * Math.sin(tilt), rx = 960 + L * Math.cos(tilt), ry = beamY - L * Math.sin(tilt);
    strokePath(ctx, [{ x: lx, y: ly }, { x: rx, y: ry }], C.text, sc * A, 7);
    dot(ctx, 960, beamY, 12, C.text, sc * A);
    // Schwelle
    const over = smoothstep(THR - 12, THR + 8, beamY + 240);
    ctx.save(); ctx.setLineDash([14, 10]);
    strokePath(ctx, [{ x: 360, y: THR }, { x: 1560, y: THR }], mixColor(C.warn, C.stress, over), sc * A * (0.6 + 0.4 * over), 3);
    ctx.restore();
    text(ctx, 'Schwelle', 1590, THR, { size: 26, weight: 700, color: over > 0.5 ? C.stress : C.warn, align: 'left', alpha: sc * A });
    if (over > 0) glow(ctx, 960, THR, 520, C.stress, 0.25 * over * A);
    // Schalen
    for (const [side, px, py, items, ws, col, title] of [[-1, lx, ly, LEFT, wl, C.gen, 'BIOLOGISCHE VULNERABILITÄT'], [1, rx, ry, [...RIGHT, ...EXTRA], [...wr, ...we], C.stress, 'BELASTUNGEN']]) {
      const panY = py + 200;
      strokePath(ctx, [{ x: px, y: py }, { x: px - 120, y: panY }], C.textDim, sc * A, 2);
      strokePath(ctx, [{ x: px, y: py }, { x: px + 120, y: panY }], C.textDim, sc * A, 2);
      ctx.save(); ctx.strokeStyle = rgba(col, sc * A); ctx.lineWidth = 3; ctx.fillStyle = rgba(col, 0.1 * sc * A);
      ctx.beginPath(); ctx.moveTo(px - 150, panY); ctx.quadraticCurveTo(px, panY + 70, px + 150, panY); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      items.forEach((it, i) => {
        const k = ws[i];
        if (k <= 0) return;
        const col2 = it.label === 'Belastung' ? '#ff8a5b' : col;
        const bw = 220, bh = 34;
        const yy = panY - 4 - i * (bh + 4) - (1 - k) * 160;
        block(ctx, px, yy, bw, bh, col2, it.label, sc * A * clamp(k));
      });
      text(ctx, title, px, panY + 90, { size: 24, weight: 700, color: col, spacing: 2, alpha: sc * A * S.on(side < 0 ? 'left' : 'right', 1.0) });
    }
    // Schutzfaktoren: tragen die Waage
    PROT.forEach((p, i) => {
      const k = wp[i];
      if (k <= 0) return;
      const x = 380 + i * 386, y = 205;
      badge(ctx, p.label, x, y, { color: C.gaba, p: k, size: 22 });
      const target = { x: lerp(lx, rx, 0.15 + i * 0.23), y: lerp(ly, ry, 0.15 + i * 0.23) };
      glowPath(ctx, subPath(catmull([{ x, y: y + 22 }, { x: lerp(x, target.x, 0.5), y: (y + target.y) / 2 - 30 }, target], 8), 0, k), C.gaba, 0.6 * A, 2, 8);
    });
    const stl = S.win('stable', 'tip', 0.6, 0.5);
    if (stl > 0) badge(ctx, 'gut abgefedert → stabil', 960, 880 - 20, { color: C.gaba, p: stl, size: 26 });
    const tpl = S.win('tip', 'protect', 0.8, 0.6, 1.6);
    if (tpl > 0) badge(ctx, 'mehrere Faktoren zusammen → Schwelle überschritten', 960, 860, { color: C.stress, p: tpl, size: 26 });
    const nt = S.on('notone', 1.0);
    if (nt > 0) {
      ctx.save(); ctx.fillStyle = rgba('#03050b', 0.72 * nt); ctx.fillRect(0, 0, W, H); ctx.restore();
      statement(ctx, 'Nicht ein einzelner Faktor entscheidet,', 440, nt, { size: 54 });
      statement(ctx, 'sondern die Kombination über die Entwicklung hinweg.', 540, S.on('combo', 1.2, ease.out), { size: 46, color: C.gen });
    }
  },
};

// ================================================================ lives
const LANES = [
  { id: 'A', y: 300, base: 30, events: [{ f: 0.55, h: 24 }], outcome: 'keine Psychose', color: C.gaba, vul: 0.55, cue: 'A', ev: 'A2', out: 'A3' },
  { id: 'B', y: 520, base: 30, events: [{ f: 0.4, h: 26 }, { f: 0.6, h: 28 }, { f: 0.76, h: 26 }], outcome: 'Risiko erhöht', color: C.warn, vul: 0.45, cue: 'B', ev: 'B2', out: 'B3' },
  { id: 'C', y: 740, base: 62, events: [{ f: 0.38, h: 26 }, { f: 0.58, h: 28 }, { f: 0.74, h: 26 }], outcome: 'Risiko höher – aber nicht sicher', color: C.stress, vul: 0.9, cue: 'C', ev: 'C2', out: 'C3' },
];
const X0 = 330, X1 = 1360, THRH = 150;

export const lives = {
  id: 'lives',
  transition: { type: 'fade', dur: 1.6 },
  sfx: [['grow', 'A', 0, 0.4], ['click', 'A2', 0.3, 0.3], ['chime', 'A3', 0, 0.3], ['grow', 'B', 0, 0.4], ['click', 'B2', 0.3, 0.3], ['chime', 'B3', 0, 0.3], ['grow', 'C', 0, 0.4], ['click', 'C2', 0.3, 0.3], ['chime', 'C3', 0, 0.3], ['boom', 'big', 0, 0.8]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.4, 1.2) * (1 - 0.85 * S.on('big', 1.0));
    heading(ctx, 'Akt VI · Wahrscheinlichkeiten', 'Drei Lebenswege', S.on('three', 1.2, ease.out) * A, { color: C.warn });
    // Altersachse
    strokePath(ctx, [{ x: X0, y: 800 }, { x: X1, y: 800 }], C.textDim, A * 0.6, 2);
    for (const [a, lab] of [[0, 'Geburt'], [0.45, 'Kindheit'], [0.7, 'Jugend'], [1, 'junges Erwachsenenalter']]) text(ctx, lab, lerp(X0, X1, a), 828, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: A * 0.9 });
    LANES.forEach((ln) => {
      const pre = tween(t, S.start - 0.3, 1.2);
      text(ctx, `Person ${ln.id}`, X0 - 30, ln.y - 40, { size: 30, weight: 700, color: C.textDim, align: 'right', alpha: A * pre * 0.6 * (1 - S.on(ln.cue, 0.5)) });
      strokePath(ctx, [{ x: X0, y: ln.y - ln.base }, { x: X1, y: ln.y - ln.base }], C.textDim, A * pre * 0.25 * (1 - S.on(ln.cue, 1.0)), 2);
      const p = S.on(ln.cue, 2.2, ease.inOut);
      if (p <= 0) return;
      const evp = S.on(ln.ev, 1.4, ease.inOut);
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const f = i / 120;
        let h = ln.base;
        for (const e of ln.events) h += e.h * smoothstep(e.f - 0.04, e.f + 0.04, f) * evp;
        pts.push({ x: lerp(X0, X1, f), y: ln.y - h + Math.sin(f * 20 + ln.y) * 2 });
      }
      // Vulnerabilitätsband
      fillPath(ctx, [...pts.map((q) => ({ x: q.x, y: ln.y })), ...pts.slice().reverse().map((q) => ({ x: q.x, y: ln.y - ln.base }))], rgba(C.gen, 0.18 * A * p));
      // Schwelle
      ctx.save(); ctx.setLineDash([8, 8]);
      strokePath(ctx, [{ x: X0, y: ln.y - THRH }, { x: X1, y: ln.y - THRH }], C.textDim, A * 0.4 * p, 1.5);
      ctx.restore();
      glowPath(ctx, subPath(pts, 0, p), mixColor(C.neuron, ln.color, S.on(ln.out, 1.0)), A, 3, 10);
      ln.events.forEach((e, i) => { if (evp > 0) { const q = pointAt(pts, e.f); icon0(ctx, q.x, q.y, A * clamp(evp * 1.5 - i * 0.2)); } });
      text(ctx, `Person ${ln.id}`, X0 - 30, ln.y - 40, { size: 30, weight: 700, color: C.text, align: 'right', alpha: A * p });
      text(ctx, ln.id === 'A' ? 'genetische Vulnerabilität' : ln.id === 'B' ? 'mittlere Vulnerabilität' : 'hohe Vulnerabilität', X0 - 30, ln.y - 4, { size: 20, weight: 600, color: C.gen, font: 'text', align: 'right', alpha: A * p });
      const o = S.on(ln.out, 1.0);
      if (o > 0) {
        const e = pts[pts.length - 1];
        if (ln.id === 'C') for (let k = 0; k < 14; k++) glow(ctx, e.x + noise2(k, t * 0.5) * 50, e.y + noise2(k + 9, t * 0.5) * 40, 40, ln.color, 0.1 * o * A);
        glow(ctx, e.x, e.y, 70, ln.color, 0.4 * o * A);
        dot(ctx, e.x, e.y, 10, ln.color, o * A);
        text(ctx, ln.outcome, e.x + 30, e.y, { size: 28, weight: 700, color: ln.color, align: 'left', alpha: A, reveal: o });
      }
    });
    const c4 = S.win('C4', 'big', 0.8, 0.6);
    if (c4 > 0) badge(ctx, 'violett = Vulnerabilität · rote Punkte = Belastungen · gestrichelt = Schwelle', 960, 150, { color: C.textDim, p: c4, size: 20 });
    const bg = S.on('big', 1.0, ease.out);
    if (bg > 0) {
      statement(ctx, 'RISIKO IST KEINE VORBESTIMMUNG.', 470, bg, { size: 76, spacing: 3, glow: 0.8 });
      statement(ctx, 'Es beschreibt Wahrscheinlichkeiten – keine Schicksale.', 570, S.on('big2', 1.2, ease.out), { size: 40, color: C.gen });
    }
  },
};

function icon0(ctx, x, y, a) { glow(ctx, x, y, 26, C.stress, 0.5 * a); dot(ctx, x, y, 7, C.stress, a); }
