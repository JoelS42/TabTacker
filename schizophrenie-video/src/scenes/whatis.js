// Szene 2 – Was ist Schizophrenie? Häufigkeit, Erkrankungsalter
import {
  W, H, C, clamp, lerp, ease, tween, glow, spark, dot, text, rgba, drawBrain, drawFigure, heading, statement, callout, badge,
  strokePath, fillPath, glowPath, subPath, noise2, catmull, smoothstep, roundRect, figureOutline,
} from '../animation.js';
import { makeNetwork, drawNetwork, icon, dotGrid } from './shared.js';

const FIG = { x: 600, y: 480, s: 0.56 };
const net = makeNetwork(31, { n: 260, brain: true, minD: 34, k: 3 });

// Erkrankungsalter: schematische Verteilung (log-normal, Median ~ 24 J.)
const AGE_MAX = 45;
const dens = (a) => (a <= 0 ? 0 : Math.exp(-((Math.log(a) - Math.log(24)) ** 2) / (2 * 0.27 * 0.27)) / a);
const PEAK = (() => { let m = 0; for (let a = 1; a < AGE_MAX; a += 0.1) m = Math.max(m, dens(a)); return m; })();
const CH = { x0: 300, x1: 1640, y0: 790, h: 440 };
const ax = (a) => lerp(CH.x0, CH.x1, a / AGE_MAX);
const ay = (a) => CH.y0 - (dens(a) / PEAK) * CH.h;
const curve = Array.from({ length: 181 }, (_, i) => { const a = (i / 180) * AGE_MAX; return { x: ax(a), y: ay(a) }; });
function area(a0, a1) {
  const pts = [{ x: ax(a0), y: CH.y0 }];
  for (let a = a0; a <= a1; a += 0.25) pts.push({ x: ax(a), y: ay(a) });
  pts.push({ x: ax(a1), y: CH.y0 });
  return pts;
}

const ASPECTS = [
  { cue: 'perc', label: 'Wahrnehmung', y: 300 },
  { cue: 'think', label: 'Denken', y: 400 },
  { cue: 'feel', label: 'Gefühle', y: 500 },
  { cue: 'drive', label: 'Antrieb', y: 600 },
];

function figureSpace(ctx, fn) {
  ctx.save(); ctx.translate(FIG.x, FIG.y); ctx.scale(FIG.s, FIG.s); fn(); ctx.restore();
}

export default {
  id: 'whatis',
  transition: { type: 'zoomIn', dur: 1.8, fromX: 960, fromY: 330, fx: 600, fy: 400 },
  sfx: [['chime', 'perc', 0, 0.25], ['chime', 'drive', 0, 0.25], ['click', 'myth', 0.6, 0.5], ['swell', 'prev', 0, 0.4], ['chime', 'early', 0, 0.3], ['low', 'why', 0, 0.5]],
  draw(ctx, S) {
    const t = S.t;
    const figA = tween(t, S.start, 1.4) * (1 - S.on('prev', 1.2) * 0.85) * (1 - S.on('onset', 1.2));
    // ---------------- Silhouette mit Gehirn-Netzwerk
    if (figA > 0) {
      figureSpace(ctx, () => {
        drawFigure(ctx, { alpha: figA, draw: tween(t, S.start - 0.5, 2.5), fill: 0.75 });
        ctx.save();
        ctx.beginPath();
        ctx.translate(-40, -120); ctx.scale(0.9, 0.9);
        drawBrain(ctx, { alpha: figA * 0.8, gyri: 0.6, fill: 0.35, lw: 2.2 / FIG.s });
        const jit = S.on('drive', 1.5) * (1 - S.on('myth', 1.5));
        drawNetwork(ctx, net, { t, zoom: FIG.s * 0.9, alpha: figA * 0.9, lw: 1.1, nodeR: 2.6, color: C.neuron, edgeColor: '#6f8fd6', pulses: 0.6, pulseColor: C.glu, wobble: 0.35 * jit, nodeGlow: 0.2 });
        ctx.restore();
      });
    }
    // ---------------- Überschrift
    heading(ctx, 'Grundlagen', 'Was ist Schizophrenie?', S.on('what', 1.2, ease.out) * (1 - S.on('prev', 0.8)), { x: 1080, y: 150 });
    // ---------------- Vier veränderliche Bereiche
    const asA = 1 - S.on('myth', 0.8);
    ASPECTS.forEach((as, i) => {
      const p = S.on(as.cue, 0.9, ease.out);
      if (p <= 0 || asA <= 0) return;
      const ox = 1110, oy = as.y + 40;
      const src = { x: FIG.x + 20, y: FIG.y - 150 + i * 20 };
      const jit = S.on('drive', 1.2) * 18;
      const pts = catmull([src, { x: lerp(src.x, ox, 0.45), y: lerp(src.y, oy, 0.2) + noise2(i, t * 0.8) * jit }, { x: lerp(src.x, ox, 0.8), y: oy + noise2(i + 4, t * 0.9) * jit * 0.6 }, { x: ox - 18, y: oy }], 8);
      glowPath(ctx, subPath(pts, 0, p), C.glu, 0.55 * asA, 1.6, 6);
      dot(ctx, ox, oy, 7, C.glu, p * asA);
      glow(ctx, ox, oy, 26, C.glu, 0.35 * p * asA);
      text(ctx, as.label, ox + 26, oy, { size: 40, weight: 600, align: 'left', reveal: p, alpha: asA });
    });
    // ---------------- Stimmen hören / Überzeugungen
    const vo = S.win('voices', 'myth', 0.8, 0.7);
    if (vo > 0) {
      const ex = FIG.x + 70 * FIG.s, ey = FIG.y + 30 * FIG.s;
      icon(ctx, 'ear', ex + 60, ey + 10, 70, C.warn, vo, t);
      text(ctx, 'Stimmen hören, die andere nicht hören', 1110, 780, { size: 30, weight: 600, align: 'left', color: C.warn, alpha: vo, reveal: S.on('voices', 1.2) });
    }
    const be = S.win('belief', 'myth', 0.8, 0.7);
    if (be > 0) text(ctx, 'feste Überzeugungen, die andere nicht teilen', 1110, 830, { size: 30, weight: 600, align: 'left', color: C.warn, alpha: be, reveal: S.on('belief', 1.2) });
    // ---------------- Mythos
    const my = S.win('myth', 'prev', 0.8, 0.7);
    if (my > 0) {
      const y = 470;
      text(ctx, '„Gespaltene Persönlichkeit“', 1400, y, { size: 58, weight: 700, alpha: my * 0.9, reveal: S.on('myth', 1.0) });
      const sk = S.on('myth', 0.8, ease.inOut, 1.0);
      strokePath(ctx, [{ x: 1035, y: y + 4 }, { x: lerp(1035, 1765, sk), y: y - 6 }], C.stress, my, 5);
      badge(ctx, 'VERBREITETER IRRTUM', 1400, y + 90, { color: C.stress, p: S.on('myth', 0.6, ease.out, 1.6), alpha: my, size: 24 });
    }
    // ---------------- Häufigkeit: 1000 Punkte
    const pv = S.win('prev', 'onset', 1.0, 0.9);
    if (pv > 0) {
      text(ctx, 'Lebenszeit-Häufigkeit', 960, 150, { size: 26, weight: 600, color: C.textDim, font: 'text', spacing: 3, alpha: pv, reveal: S.on('prev', 1) });
      const lit = new Set([137, 402, 611, 866, 259, 733, 948]);
      const order = [137, 402, 611, 866, 259, 733, 948];
      dotGrid(ctx, 960, 480, 50, 20, 26, {
        alpha: pv, reveal: S.on('prev', 1.6, ease.out), r: 5.2, color: '#4d6aa8', hlColor: C.warn,
        highlight: (i) => { const k = order.indexOf(i); return k < 0 ? 0 : tween(t, S.cue('prev') + 1.8 + k * 0.25, 0.6) * (k < 4 ? 1 : 0.6); },
      });
      text(ctx, 'etwa 4 – 7 von 1.000 Menschen', 960, 800, { size: 48, weight: 700, alpha: pv, reveal: S.on('prev', 1.2, ease.out, 2.2), glow: 0.3 });
    }
    // ---------------- Erkrankungsalter
    const on = S.on('onset', 1.4) * (1 - S.on('dev', 1.5));
    if (on > 0) {
      heading(ctx, 'Erkrankungsbeginn', 'Wann beginnt Schizophrenie?', on);
      // Achse
      strokePath(ctx, [{ x: CH.x0 - 20, y: CH.y0 }, { x: lerp(CH.x0 - 20, CH.x1 + 20, on), y: CH.y0 }], C.textDim, on * 0.8, 2);
      for (const a of [0, 13, 18, 25, 30, 40]) {
        const x = ax(a);
        strokePath(ctx, [{ x, y: CH.y0 }, { x, y: CH.y0 + 10 }], C.textDim, on * 0.7, 2);
        text(ctx, `${a}`, x, CH.y0 + 34, { size: 24, weight: 500, color: C.textDim, font: 'text', alpha: on });
      }
      text(ctx, 'Alter in Jahren', (CH.x0 + CH.x1) / 2, CH.y0 + 76, { size: 22, weight: 500, color: C.textDim, font: 'text', alpha: on });
      // Fläche + Kurve
      const cp = tween(t, S.cue('onset') + 0.3, 2.2, ease.inOut);
      const full = area(0.5, AGE_MAX);
      ctx.save();
      const g = ctx.createLinearGradient(0, CH.y0 - CH.h, 0, CH.y0);
      g.addColorStop(0, rgba(C.neuron, 0.28 * on)); g.addColorStop(1, rgba(C.neuron, 0.02 * on));
      ctx.beginPath(); ctx.rect(CH.x0 - 30, 0, (CH.x1 - CH.x0 + 60) * cp + 1, H); ctx.clip();
      fillPath(ctx, full, g);
      ctx.restore();
      glowPath(ctx, subPath(curve, 0, cp), C.neuron, on, 3, 10);
      // unter 18 (≈ jede zehnte)
      const e = S.on('early', 1.2) * (1 - S.on('dev', 1));
      if (e > 0) {
        fillPath(ctx, area(0.5, 18), rgba(C.glu, 0.45 * e));
        strokePath(ctx, [{ x: ax(18), y: CH.y0 }, { x: ax(18), y: CH.y0 - CH.h - 20 }], C.glu, e * 0.8, 2);
        callout(ctx, ax(15.5), ay(15.5) + 30, 560, 430, 'vor 18: etwa 1 von 10', { p: e, color: C.glu, size: 34 });
      }
      const c = S.on('child', 1.2) * (1 - S.on('dev', 1));
      if (c > 0) {
        fillPath(ctx, area(0.5, 13), rgba(C.warn, 0.9 * c));
        callout(ctx, ax(12.3), CH.y0 - 5, 560, 620, 'vor 13: sehr selten', { p: c, color: C.warn, size: 34 });
      }
      text(ctx, 'schematische Darstellung', CH.x1, CH.y0 + 76, { size: 20, weight: 500, color: C.textDim, font: 'text', align: 'right', alpha: on * 0.8 });
      // Warum gerade dann?
      const wy = S.on('why', 1.0) * (1 - S.on('dev', 1));
      if (wy > 0) {
        const px = ax(23), py = ay(23);
        glow(ctx, px, py, 200 * wy, C.warn, 0.25 * wy * (0.8 + 0.2 * Math.sin(t * 3)));
        text(ctx, 'Warum gerade dann?', px, py - 70, { size: 46, weight: 700, color: C.text, reveal: wy, glow: 0.5 });
      }
    }
    // Überleitung: Kurvenspitze wird zum Gehirn
    const dv = S.on('dev', 2.0);
    if (dv > 0) {
      ctx.save();
      ctx.translate(960, 470); ctx.scale(lerp(0.2, 0.62, ease.out(dv)), lerp(0.2, 0.62, ease.out(dv)));
      drawBrain(ctx, { alpha: dv, draw: dv, gyri: 0.7, fill: 0.45 });
      ctx.restore();
      text(ctx, 'Die Entwicklung des Gehirns', 960, 860, { size: 44, weight: 700, reveal: S.on('dev', 1.4, ease.out, 0.5) });
    }
  },
};
