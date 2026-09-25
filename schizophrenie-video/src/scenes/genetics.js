// Szene 6 – Genetik: Zwillinge, polygen, GWAS (287 Genorte), 22q11.2
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, fillPath, glowPath, fract, smoothstep, mixColor } from '../animation.js';
import { drawHelix, helixTargets, person, drawChromosome, icon } from './shared.js';

const N = 400;
const R = rng(61);
const START = Array.from({ length: N }, () => ({ x: R.range(-200, W + 200), y: R.range(-200, H + 200), d: R() }));
const GRID = Array.from({ length: N }, (_, i) => ({ x: 960 + ((i % 25) - 12) * 44, y: 470 + (Math.floor(i / 25) - 7.5) * 36 }));
const CHANGED = new Set(Array.from({ length: 150 }, () => R.int(0, N - 1)));

// Manhattan-Plot (schematisch)
const CHR = [248, 242, 198, 190, 181, 171, 159, 145, 138, 134, 135, 133, 114, 107, 102, 90, 83, 80, 59, 64, 47, 51];
const MP = { x0: 220, x1: 1720, y0: 790, h: 470, ymax: 20 };
const manhattan = (() => {
  const tot = CHR.reduce((a, b) => a + b, 0);
  const pts = [];
  let acc = 0;
  const RR = rng(7);
  CHR.forEach((len, c) => {
    const n = Math.round(len / 3.2);
    const nPeaks = Math.max(2, Math.round(len / 45));
    const peaks = Array.from({ length: nPeaks }, () => ({ pos: RR(), h: 8.2 + RR() * 7 }));
    if (c === 5) peaks.push({ pos: 0.18, h: 19.5 }); // MHC-Region auf Chromosom 6
    for (let i = 0; i < n; i++) {
      const f = i / n;
      let v = -Math.log(Math.max(1e-6, RR())) * 1.1;
      for (const pk of peaks) { const d = Math.abs(f - pk.pos) * len; if (d < 3) v = Math.max(v, pk.h * (1 - d / 3) * (0.7 + 0.3 * RR())); }
      pts.push({ x: lerp(MP.x0, MP.x1, (acc + f * len) / tot), v, c, r: RR() });
    }
    acc += len;
  });
  return pts;
})();
const mpY = (v) => MP.y0 - (Math.min(v, MP.ymax) / MP.ymax) * MP.h;
const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));

export default {
  id: 'genetics',
  transition: { type: 'zoomIn', dur: 1.8, fromX: 960, fromY: 480 },
  sfx: [['grow', 'dna', 0, 0.6], ['chime', 'twin2', 0.3, 0.3], ['dissolve', 'poly', 0, 0.6], ['click', 'notone', 0.8, 0.4], ['swell', 'gwas', 0, 0.5], ['chime', 'loci', 0, 0.4],
    ['click', 'del', 1.0, 0.5], ['chime', 'quarter', 0.3, 0.3], ['swell', 'prob', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    heading(ctx, 'Einflüsse · 1', 'Genetik', tween(t, S.start, 1.2) * (1 - S.on('gwas', 0.6) + S.on('common', 1.0)) * (1 - S.on('prob', 1)), { color: C.gen });
    const ph = t * 0.9;
    // ---------------- Partikel → Helix → Raster
    const helixUp = S.on('twins', 1.5);
    const toGrid = S.on('poly', 2.0, ease.inOut);
    const partA = tween(t, S.start - 0.5, 1) * (1 - S.on('gwas', 1.2));
    const hy = lerp(470, 250, helixUp), amp = lerp(95, 40, helixUp);
    const HT = helixTargets(N, lerp(250, 560, helixUp), lerp(1670, 1360, helixUp), hy, amp, 4.5, ph);
    if (partA > 0) {
      const helixLine = tween(t, S.start + 2.4, 1.2) * (1 - toGrid);
      if (helixLine > 0) drawHelix(ctx, lerp(250, 560, helixUp), lerp(1670, 1360, helixUp), hy, { amp, turns: 4.5, phase: ph, alpha: helixLine * partA * 0.6, glow: false, n: 180 });
      const many = S.on('many', 2.5);
      for (let i = 0; i < N; i++) {
        const k = tween(t, S.start + 0.2 + START[i].d * 1.2, 1.8, ease.inOut);
        const h = HT[i];
        let x = lerp(START[i].x, h.x, k), y = lerp(START[i].y, h.y, k);
        x = lerp(x, GRID[i].x, toGrid); y = lerp(y, GRID[i].y, toGrid);
        const depth = lerp(0.45 + 0.55 * (h.z + 1) / 2, 1, toGrid);
        const ch = CHANGED.has(i) ? many * (0.6 + 0.4 * Math.sin(t * 2 + i)) : 0;
        const col = ch > 0 ? mixColor(C.gen, '#ffffff', ch * 0.5) : C.gen;
        spark(ctx, x, y, lerp(2.4, 3.6, toGrid) * (1 + ch * 0.35), col, partA * depth * (0.55 + ch * 0.45));
      }
    }
    // ---------------- Zwillinge
    const tw = S.on('twins', 1.2) * (1 - S.on('poly', 1.0));
    if (tw > 0) {
      text(ctx, 'Zwillings- & Familienstudien: großer erblicher Anteil', 960, 400, { size: 30, weight: 600, color: C.text, alpha: tw, reveal: S.on('twins', 1.4, ease.out, 0.5) });
      const concord = new Set([1, 4, 6, 8]);
      for (let i = 0; i < 10; i++) {
        const x = 330 + i * 140, y = 600;
        const k = tween(t, S.cue('twins') + 0.5 + i * 0.08, 0.6, ease.outBack);
        const aff = tween(t, S.cue('twin2') + i * 0.05, 0.6);
        const aff2 = concord.has(i) ? tween(t, S.cue('twin2') + 1.2 + i * 0.05, 0.6) : 0;
        const c1 = mixColor('#6f8fd6', C.warn, aff), c2 = mixColor('#6f8fd6', C.warn, aff2);
        person(ctx, x - 26, y, 64 * k, c1, tw, 0.3 + aff * 0.4);
        person(ctx, x + 26, y, 64 * k, c2, tw, 0.3 + aff2 * 0.4);
        if (aff > 0) glow(ctx, x - 26, y - 10, 50, C.warn, 0.25 * aff * tw);
        if (aff2 > 0) glow(ctx, x + 26, y - 10, 50, C.warn, 0.25 * aff2 * tw);
        const sm = S.win('same', 'notfate', 0.6, 0.6);
        if (sm > 0) icon(ctx, 'dna', x, y + 72, 30, C.gen, sm * tw, t);
      }
      const t2 = S.win('twin2', 'poly', 0.8, 0.8, 1.6);
      if (t2 > 0) text(ctx, 'Erkrankt ein eineiiger Zwilling, bleibt der andere in über der Hälfte der Fälle gesund', 960, 745, { size: 28, weight: 600, color: C.warn, alpha: t2, reveal: t2 });
      const sm = S.win('same', 'notfate', 0.6, 0.6);
      if (sm > 0) text(ctx, 'nahezu identische Gene', 960, 800, { size: 26, weight: 600, color: C.gen, alpha: sm, reveal: sm });
      const nf = S.win('notfate', 'poly', 0.8, 0.8);
      if (nf > 0) statement(ctx, 'Gene allein entscheiden nicht.', 830, nf, { size: 52 });
    }
    // ---------------- Polygen
    const po = S.win('poly', 'gwas', 1.0, 1.0);
    if (po > 0) {
      statement(ctx, 'Polygenes Risiko', 150, S.on('poly', 1.2, ease.out), { size: 56, color: C.gen, alpha: po });
      const no = S.win('notone', 'many', 0.6, 0.8);
      if (no > 0) {
        glow(ctx, GRID[212].x, GRID[212].y, 60, C.warn, 0.5 * no);
        text(ctx, '„das Schizophrenie-Gen“?', 960, 800, { size: 40, weight: 700, color: C.warn, alpha: no, reveal: S.on('notone', 0.8) });
        const sk = S.on('notone', 0.6, ease.inOut, 1.0);
        strokePath(ctx, [{ x: 740, y: 804 }, { x: lerp(740, 1180, sk), y: 796 }], C.stress, no, 5);
      }
      const ma = S.win('many', 'gwas', 0.8, 0.8);
      if (ma > 0) text(ctx, 'sehr viele Varianten – jede mit winzigem Effekt', 960, 800, { size: 38, weight: 700, color: C.text, alpha: ma, reveal: ma });
      // Risiko-Anzeige wächst in winzigen Schritten
      const ti = S.on('tiny', 3.0, ease.linear) * po;
      if (ti > 0) {
        const bx = 1720, top = 250, bot = 690;
        strokePath(ctx, [{ x: bx, y: bot }, { x: bx, y: top }], C.textDim, po * 0.35, 14);
        const steps = Math.floor(ti * 30);
        for (let i = 0; i < steps; i++) strokePath(ctx, [{ x: bx - 7, y: bot - i * 5 }, { x: bx + 7, y: bot - i * 5 }], C.gen, po, 3);
        text(ctx, 'Anfälligkeit', bx, bot + 34, { size: 22, weight: 600, color: C.gen, font: 'text', alpha: po });
      }
    }
    // ---------------- GWAS / Manhattan-Plot
    const gw = S.win('gwas', 'common', 1.2, 1.0);
    if (gw > 0) {
      const draw = S.on('gwas', 2.5, ease.inOut);
      heading(ctx, 'Genomweite Assoziationsstudie', 'Hunderte Regionen im Erbgut', gw, { color: C.gen });
      strokePath(ctx, [{ x: MP.x0, y: MP.y0 }, { x: MP.x1, y: MP.y0 }], C.textDim, gw * 0.7, 2);
      for (const p of manhattan) {
        if ((p.x - MP.x0) / (MP.x1 - MP.x0) > draw) continue;
        const sig = p.v > 7.3;
        const col = sig ? C.gen : p.c % 2 ? '#5b74b8' : '#8aa1d8';
        const grow = clamp((draw - (p.x - MP.x0) / (MP.x1 - MP.x0)) * 8);
        const y = mpY(p.v * grow);
        if (sig) spark(ctx, p.x, y, 2.6, col, gw * S.on('loci', 1.0) * 0.8 + gw * 0.2);
        dot(ctx, p.x, y, 2.4, col, gw * 0.85);
      }
      const sy = mpY(7.3);
      ctx.save(); ctx.setLineDash([10, 8]);
      strokePath(ctx, [{ x: MP.x0, y: sy }, { x: lerp(MP.x0, MP.x1, draw), y: sy }], C.warn, gw * 0.8, 2);
      ctx.restore();
      text(ctx, 'Signifikanzschwelle', MP.x1, sy - 22, { size: 20, weight: 600, color: C.warn, font: 'text', align: 'right', alpha: gw * draw });
      text(ctx, 'Chromosomen 1 – 22', (MP.x0 + MP.x1) / 2, MP.y0 + 34, { size: 22, weight: 500, color: C.textDim, font: 'text', alpha: gw });
      text(ctx, 'Stärke der Assoziation ↑', MP.x0 + 150, MP.y0 - MP.h - 10, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: gw, align: 'center' });
      const lo = S.on('loci', 1.2, ease.out);
      if (lo > 0) {
        text(ctx, '287 Genregionen', 1340, 300, { size: 56, weight: 700, color: C.gen, alpha: gw, reveal: lo, glow: 0.5 });
        text(ctx, 'Daten von über 76.000 Betroffenen', 1340, 356, { size: 26, weight: 600, color: C.text, font: 'text', alpha: gw, reveal: lo });
        text(ctx, 'Trubetskoy et al., Nature 2022 · schematische Darstellung', 1340, 396, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: gw * lo });
      }
    }
    // ---------------- Häufige Varianten – fast jeder trägt einige
    const co = S.win('common', 'rare', 1.0, 1.0);
    if (co > 0) {
      const RR = rng(17);
      for (let i = 0; i < 24; i++) {
        const x = 360 + (i % 12) * 110, y = 330 + Math.floor(i / 12) * 190;
        const k = tween(t, S.cue('common') + i * 0.04, 0.7, ease.outBack);
        person(ctx, x, y, 70 * k, '#7f9ee0', co, 0.25);
        const nv = 2 + RR.int(0, 6);
        const ev = S.on('everyone', 1.2, ease.out, i * 0.03);
        for (let v = 0; v < nv; v++) spark(ctx, x - 28 + RR() * 56, y + 12 + RR() * 34, 2.4, C.gen, co * ev);
      }
      text(ctx, 'häufige Varianten: fast jeder Mensch trägt einige', 960, 150, { size: 34, weight: 700, alpha: co, reveal: S.on('common', 1.2) });
      // Glockenkurven: große Überschneidung
      const su = S.on('sum', 1.5, ease.inOut);
      if (su > 0) {
        const x0 = 380, x1 = 1540, y0 = 820, h = 150;
        const c1 = [], c2 = [];
        for (let i = 0; i <= 120; i++) {
          const x = lerp(-3.5, 4, i / 120);
          c1.push({ x: lerp(x0, x1, i / 120), y: y0 - gauss(x, 0, 1) * h });
          c2.push({ x: lerp(x0, x1, i / 120), y: y0 - gauss(x, 0.6, 1) * h });
        }
        fillPath(ctx, [...c1, { x: x1, y: y0 }, { x: x0, y: y0 }], rgba('#6f8fd6', 0.15 * su * co));
        glowPath(ctx, c1, '#8fa7e0', su * co, 2.5, 6);
        glowPath(ctx, c2, C.gen, su * co, 2.5, 6);
        text(ctx, 'Allgemeinbevölkerung', 560, y0 - h - 18, { size: 22, weight: 600, color: '#8fa7e0', font: 'text', alpha: su * co });
        text(ctx, 'Betroffene (Durchschnitt)', 1330, y0 - h - 18, { size: 22, weight: 600, color: C.gen, font: 'text', alpha: su * co });
        text(ctx, 'polygene Belastung →', x1, y0 + 26, { size: 20, weight: 500, color: C.textDim, font: 'text', align: 'right', alpha: su * co });
        badge(ctx, 'große Überschneidung', 960, y0 + 30, { color: C.text, p: su, alpha: co, size: 22 });
      }
    }
    // ---------------- Seltene Veränderung: 22q11.2
    const ra = S.win('rare', 'prob', 1.0, 1.0);
    if (ra > 0) {
      text(ctx, 'seltene Veränderungen mit stärkerem Effekt', 960, 150, { size: 34, weight: 700, alpha: ra, reveal: S.on('rare', 1.2) });
      const dk = S.on('del', 1.5, ease.inOut, 0.6);
      const cx = 540, cy = 520;
      drawChromosome(ctx, cx, cy, 560, 78, {
        alpha: ra * S.on('rare', 1.0), centromere: 0.16, color: C.gen,
        bands: [{ f0: 0.05, f1: 0.1, shade: 0.4 }, { f0: 0.3, f1: 0.36, shade: 0.35 }, { f0: 0.45, f1: 0.53, shade: 0.6 }, { f0: 0.62, f1: 0.7, shade: 0.45 }, { f0: 0.8, f1: 0.86, shade: 0.55 }],
        gap: dk > 0 ? { f0: 0.215, f1: 0.27, k: dk } : null,
      });
      text(ctx, 'Chromosom 22', cx, cy + 320, { size: 26, weight: 600, color: C.gen, font: 'text', alpha: ra });
      if (dk > 0) {
        callout(ctx, cx + 48, cy - 280 + 560 * 0.24, 820, 330, '22q11.2-Deletion', { p: dk, color: C.warn, size: 40 });
        const d2 = S.on('del2', 1.0);
        text(ctx, 'ein kleines fehlendes Stück', 832, 380, { size: 26, weight: 600, color: C.text, font: 'text', align: 'left', alpha: ra * d2, reveal: d2 });
        text(ctx, 'etwa 1 von 2.000 – 4.000 Geburten', 832, 418, { size: 22, weight: 500, color: C.textDim, font: 'text', align: 'left', alpha: ra * d2 });
      }
      const qa = S.on('quarter', 1.0);
      if (qa > 0) {
        for (let i = 0; i < 4; i++) {
          const x = 960 + i * 150, y = 620;
          const warm = i === 0 ? tween(t, S.cue('quarter') + 0.3, 0.6) : 0;
          const cool = i > 0 ? S.on('three', 0.8, ease.out, i * 0.15) : 0;
          const col = warm > 0 ? mixColor('#7f9ee0', C.warn, warm) : mixColor('#7f9ee0', C.gaba, cool * 0.6);
          person(ctx, x, y, 100 * ease.outBack(qa), col, ra, 0.3 + warm * 0.4);
          if (warm > 0) glow(ctx, x, y - 10, 80, C.warn, 0.3 * warm * ra);
        }
        text(ctx, '≈ 1 von 4 entwickelt eine Psychose', 1185, 740, { size: 30, weight: 700, color: C.warn, alpha: ra, reveal: S.on('quarter', 1.0, ease.out, 0.4) });
        const th = S.on('three', 1.0);
        if (th > 0) text(ctx, '3 von 4 nicht', 1185, 785, { size: 30, weight: 700, color: C.gaba, alpha: ra, reveal: th });
      }
      const nn = S.on('notneeded', 1.0);
      if (nn > 0) badge(ctx, 'Beispiel für erhöhtes Risiko – keine notwendige Voraussetzung', 1185, 860, { color: C.text, p: nn, alpha: ra, size: 22 });
    }
    // ---------------- Schluss: Wahrscheinlichkeiten
    const pb = S.on('prob', 1.4);
    if (pb > 0) {
      drawHelix(ctx, 300, 1620, 470, { amp: 70, turns: 4, phase: ph, alpha: pb * 0.8, draw: S.on('prob', 2.0) });
      statement(ctx, 'Gene verändern Wahrscheinlichkeiten.', 220, S.on('prob', 1.2, ease.out), { size: 54 });
      statement(ctx, 'Sie legen nichts endgültig fest.', 740, S.on('nofix', 1.2, ease.out), { size: 54, color: C.gen });
    }
  },
};
