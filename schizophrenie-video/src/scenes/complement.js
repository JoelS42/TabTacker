// Szene 11 – Komplement / C4: genetische Variation → Komplement → Markierung → Mikroglia → Entfernung
import { W, H, C, TAU, clamp, lerp, ease, tween, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, glowPath, catmull, fract, roundRect, mixColor, pointAt, subPath } from '../animation.js';
import { drawHelix, drawChromosome, makeMicroglia, drawMicroglia, miniSynapse, flow, icon } from './shared.js';

const MGS = makeMicroglia(23, { n: 7, size: 0.42 });
const CHAIN = [
  { cue: 'ch1', label: 'genetische Variation', color: C.gen },
  { cue: 'ch2', label: 'mehr Komplement-Signal', color: C.compl },
  { cue: 'ch3', label: 'mehr markierte Synapsen', color: C.glu },
  { cue: 'ch4', label: 'mehr Aufnahme durch Mikroglia', color: C.mg },
  { cue: 'ch5', label: 'mehr synaptische Entfernung', color: C.textDim },
].map((c, i) => ({ ...c, x: 250 + i * 355, y: 500 }));

export default {
  id: 'complement',
  transition: { type: 'zoomOut', dur: 1.8 },
  sfx: [['swell', 'circle', 0, 0.5], ['chime', 'c4', 0, 0.4], ['click', 'variants', 0, 0.3], ['chime', 'more', 0, 0.3], ['click', 'ch1', 0, 0.4], ['click', 'ch2', 0, 0.4], ['click', 'ch3', 0, 0.4], ['click', 'ch4', 0, 0.4], ['click', 'ch5', 0, 0.4], ['low', 'villain', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.4, 1.4);
    const part1 = A * (1 - S.on('chain', 1.2));
    heading(ctx, 'Genetik trifft Immunsystem', 'Komplement-Faktor C4', S.on('circle', 1.2, ease.out) * (1 - S.on('chain', 1.0)), { color: C.compl });
    const ci = S.win(S.start - 0.6, 'mhc', 1.2, 1.2);
    if (ci > 0) {
      drawHelix(ctx, 300, 1620, 540, { amp: 80, turns: 4, phase: t * 0.9, alpha: ci * 0.9, draw: tween(t, S.start - 0.6, 2.2) });
      text(ctx, 'zurück zur Genetik', 960, 760, { size: 40, weight: 700, color: C.gen, alpha: ci, reveal: S.on('circle', 1.2) });
    }
    if (part1 > 0) {
      // Chromosom 6 mit MHC-Region
      const cx = 300, cy = 560;
      drawChromosome(ctx, cx, cy, 560, 74, { alpha: part1 * S.on('mhc', 1.2), centromere: 0.38, color: C.gen, bands: [{ f0: 0.08, f1: 0.14, shade: 0.5 }, { f0: 0.2, f1: 0.26, shade: 0.7 }, { f0: 0.5, f1: 0.58, shade: 0.5 }, { f0: 0.7, f1: 0.78, shade: 0.4 }] });
      const band = { x: cx + 40, y: cy - 280 + 560 * 0.23 };
      const mh = S.on('mhc', 1.2);
      if (mh > 0) {
        glow(ctx, band.x - 40, band.y, 60, C.compl, 0.5 * mh * part1);
        text(ctx, 'Chromosom 6', cx, cy + 320, { size: 24, weight: 600, color: C.gen, font: 'text', alpha: part1 * mh });
        // Lupe: Region mit vielen Immungenen
        const lz = S.on('mhc', 1.4, ease.out, 0.6);
        strokePath(ctx, [band, { x: 620, y: 300 }], C.compl, part1 * lz * 0.6, 1.5);
        strokePath(ctx, [{ x: band.x, y: band.y + 10 }, { x: 620, y: 520 }], C.compl, part1 * lz * 0.6, 1.5);
        ctx.save(); ctx.strokeStyle = rgba(C.compl, part1 * lz * 0.8); ctx.lineWidth = 2; roundRect(ctx, 620, 300, 1180 * lz, 220, 18); ctx.stroke(); ctx.restore();
        drawHelix(ctx, 650, lerp(650, 1770, lz), 410, { amp: 38, turns: 6, phase: t * 0.8, alpha: part1 * lz * 0.35, glow: false, n: 140 });
        for (let g = 0; g < 14; g++) {
          const gx = 680 + g * 78, isC4 = g === 8;
          const k = tween(t, S.cue('mhc') + 1.0 + g * 0.05, 0.5, ease.outBack);
          const c4k = isC4 ? S.on('c4', 1.0) : 0;
          ctx.save();
          ctx.fillStyle = rgba(isC4 ? mixColor('#7f9ee0', C.compl, c4k) : '#7f9ee0', part1 * (0.35 + 0.5 * k + c4k * 0.3));
          roundRect(ctx, gx, 380 - 22 * k * (1 + c4k * 0.4), 56, 60 * k * (1 + c4k * 0.4), 8); ctx.fill();
          ctx.restore();
          if (isC4 && c4k > 0) { glow(ctx, gx + 28, 410, 90, C.compl, 0.5 * c4k * part1); text(ctx, 'C4', gx + 28, 410, { size: 28, weight: 700, color: '#ffffff', alpha: part1 * c4k }); }
        }
        text(ctx, 'Region mit vielen Immungenen (MHC)', 1210, 490, { size: 26, weight: 600, color: C.compl, alpha: part1 * lz, reveal: lz });
        const st = S.win('mhc', 'c4', 0.8, 0.6, 1.4);
        if (st > 0) badge(ctx, 'eines der stärksten genetischen Signale', 1210, 580, { color: C.gen, p: st, size: 24 });
        const cb = S.win('c4b', 'variants', 0.8, 0.6);
        if (cb > 0) badge(ctx, 'C4: ein Baustein des Komplement-Systems', 1210, 580, { color: C.compl, p: cb, size: 24 });
      }
      // Varianten → unterschiedlich viel C4A
      const va = S.on('variants', 1.2);
      if (va > 0) {
        const rows = [1, 2, 3];
        rows.forEach((n, i) => {
          const y = 640 + i * 70;
          const k = S.on('variants', 0.8, ease.out, i * 0.3);
          text(ctx, `Variante ${i + 1}`, 700, y, { size: 24, weight: 600, color: C.textDim, font: 'text', align: 'left', alpha: part1 * k });
          for (let c = 0; c < n; c++) { ctx.save(); ctx.fillStyle = rgba(C.compl, part1 * k); roundRect(ctx, 850 + c * 60, y - 16, 48, 32, 6); ctx.fill(); ctx.restore(); text(ctx, 'C4A', 874 + c * 60, y + 1, { size: 15, weight: 700, color: '#2a0c1c', font: 'text', alpha: part1 * k }); }
          const ex = S.on('expr', 1.5, ease.out, i * 0.2);
          ctx.save(); ctx.fillStyle = rgba(C.compl, 0.35 * part1 * ex); roundRect(ctx, 1080, y - 12, 180 * n * ex, 24, 12); ctx.fill(); ctx.restore();
        });
        text(ctx, 'Menge an C4A →', 1080, 610, { size: 22, weight: 600, color: C.compl, font: 'text', align: 'left', alpha: part1 * S.on('expr', 1) });
      }
      // Studie
      const sd = S.on('study', 1.0);
      if (sd > 0) {
        badge(ctx, 'Sekar et al., Nature 2016', 1640, 660, { color: C.text, p: sd, alpha: part1, size: 22 });
        const mo = S.on('more', 1.5, ease.inOut);
        const gx0 = 1500, gx1 = 1820, gy0 = 860, gy1 = 720;
        strokePath(ctx, [{ x: gx0, y: gy1 - 10 }, { x: gx0, y: gy0 }, { x: gx1, y: gy0 }], C.textDim, part1 * mo, 2);
        glowPath(ctx, subPath([{ x: gx0 + 10, y: gy0 - 30 }, { x: gx1 - 10, y: gy0 - 75 }], 0, mo), C.warn, part1, 3, 8);
        text(ctx, 'C4A-Menge →', gx1, gy0 + 24, { size: 18, weight: 500, color: C.textDim, font: 'text', align: 'right', alpha: part1 * mo });
        text(ctx, 'Risiko: leicht höher', gx0 + 6, gy1 - 30, { size: 20, weight: 600, color: C.warn, font: 'text', align: 'left', alpha: part1 * mo });
      }
    }
    // ---------------- Modellkette
    const ch = S.on('chain', 1.2);
    if (ch > 0) {
      heading(ctx, 'Forschungsmodell', 'Von der Genvariante zum Synapsenabbau', ch, { color: C.compl });
      CHAIN.forEach((c, i) => {
        const p = Math.max(S.on(c.cue, 0.9, ease.out), 0.25 * S.on('chain', 1.0));
        if (i < CHAIN.length - 1) {
          const n = CHAIN[i + 1];
          const pts = catmull([{ x: c.x + 60, y: c.y }, { x: (c.x + n.x) / 2, y: c.y - 30 + Math.sin(t + i) * 8 }, { x: n.x - 60, y: n.y }], 10);
          const q = S.on(n.cue, 1.0, ease.inOut, -0.6);
          glowPath(ctx, subPath(pts, 0, q), c.color, 0.7 * ch, 2.2, 8);
          if (q >= 1) flow(ctx, pts, t, { n: 4, speed: 0.4, color: c.color, r: 2.8, alpha: ch });
        }
        if (p <= 0) return;
        glow(ctx, c.x, c.y, 110 * p, c.color, 0.22 * ch * p);
        ctx.save(); ctx.strokeStyle = rgba(c.color, ch * p * 0.9); ctx.lineWidth = 2.5; ctx.fillStyle = rgba('#060b18', 0.8 * ch * p);
        ctx.beginPath(); ctx.arc(c.x, c.y, 62 * ease.outBack(p), 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, 60, 0, TAU); ctx.clip();
        if (i === 0) drawHelix(ctx, c.x - 50, c.x + 50, c.y, { amp: 18, turns: 1.6, phase: t * 1.5, alpha: ch * p, n: 60, glow: false });
        if (i === 1) for (let k = 0; k < 6; k++) { const an = k * 1.05 + t * 0.5; spark(ctx, c.x + Math.cos(an) * 28, c.y + Math.sin(an) * 28, 4, C.compl, ch * p); }
        if (i === 2 || i === 4) miniSynapse(ctx, c.x, c.y + 6, 34, { alpha: ch * p * (i === 4 ? 0.3 + 0.7 * (1 - fract(t * 0.4)) : 1), t, color: i === 4 ? '#6d7690' : C.neuron });
        if (i === 2) for (let k = 0; k < 3; k++) spark(ctx, c.x - 18 + k * 18, c.y - 20, 3, C.compl, ch * p);
        if (i === 3) drawMicroglia(ctx, MGS, { x: c.x, y: c.y, t, alpha: ch * p, reach: 0.9 });
        ctx.restore();
        text(ctx, c.label, c.x, c.y + (i % 2 ? -110 : 110), { size: 25, weight: 700, color: c.color === C.textDim ? C.text : c.color, alpha: ch, reveal: p });
      });
      const mi = S.win('mice', 'villain', 0.8, 0.6);
      if (mi > 0) badge(ctx, 'passende Hinweise aus Tier- und Zellmodellen', 960, 760, { color: C.text, p: mi, size: 26 });
      const vi = S.on('villain', 1.0);
      if (vi > 0) {
        text(ctx, 'C4 ist kein Bösewicht', 960, 760, { size: 40, weight: 700, color: C.text, alpha: ch, reveal: vi });
        const vt = S.on('vital', 1.0);
        if (vt > 0) text(ctx, 'Das Komplement-System ist lebenswichtig für die Abwehr.', 960, 810, { size: 28, weight: 600, color: C.gaba, font: 'text', alpha: ch, reveal: vt });
      }
      const op = S.on('open', 1.0);
      if (op > 0) { badge(ctx, 'FORSCHUNGSMODELL', 780, 870, { color: C.warn, p: op, size: 24 }); badge(ctx, 'NICHT VOLLSTÄNDIG GEKLÄRT', 1140, 870, { color: C.warn, p: S.on('open', 0.8, ease.out, 0.4), size: 24 }); }
    }
  },
};
