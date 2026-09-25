// Szene 14 – GABA-Interneurone, Netzwerkrhythmus (Gamma), Erregungs-Hemmungs-Gleichgewicht
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, hash, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, glowPath, fillPath, catmull, fract, noise2, mixColor, smoothstep, roundRect, pointAt } from '../animation.js';

const CEN = { x: 960, y: 345 };
const NP = 8;
const PYR = Array.from({ length: NP }, (_, i) => {
  const a = -Math.PI / 2 + (i / NP) * TAU + 0.2;
  return { x: CEN.x + Math.cos(a) * 470, y: CEN.y + Math.sin(a) * 190, a };
});
const T = 0.9;            // Periode (stark verlangsamt dargestellt)
const RAS = { x0: 380, x1: 1540, y0: 660, row: 15 };
const TRACE = { y: 825, h: 42 };

// Spikezeiten: synchron (d=0) … desynchronisiert (d=1)
function spikes(i, t0, t1, d) {
  const out = [];
  for (let k = Math.floor(t0 / T) - 1; k <= Math.floor(t1 / T) + 1; k++) {
    if (hash(i * 97 + k * 13.1) < d * 0.35) continue;
    const jit = (hash(i * 31 + k * 7.7) - 0.5) * lerp(0.05, 0.9, d) * T;
    const s = k * T + 0.15 * T + jit;
    if (s >= t0 && s <= t1) out.push(s);
  }
  return out;
}

function pyramid(ctx, x, y, s, col, a, fire) {
  ctx.save();
  ctx.fillStyle = rgba(mixColor(col, '#ffffff', fire * 0.6), a);
  ctx.beginPath(); ctx.moveTo(x, y - 30 * s); ctx.lineTo(x + 24 * s, y + 18 * s); ctx.lineTo(x - 24 * s, y + 18 * s); ctx.closePath(); ctx.fill();
  ctx.restore();
  strokePath(ctx, [{ x, y: y - 30 * s }, { x: x + 4 * s, y: y - 90 * s }], col, a * 0.8, 4 * s);
  strokePath(ctx, [{ x: x - 16 * s, y: y + 14 * s }, { x: x - 44 * s, y: y + 40 * s }], col, a * 0.6, 3 * s);
  strokePath(ctx, [{ x: x + 16 * s, y: y + 14 * s }, { x: x + 44 * s, y: y + 38 * s }], col, a * 0.6, 3 * s);
  if (fire > 0) glow(ctx, x, y, 90 * s, C.glu, a * fire * 0.9);
}

export default {
  id: 'gaba',
  transition: { type: 'fade', dur: 1.6 },
  sfx: [['grow', 'inter', 0, 0.4], ['chime', 'gaba', 0, 0.3], ['pulse', 'clock', 0, 0.35], ['swell', 'gamma', 0, 0.4], ['low', 'n1', 0, 0.4], ['dissolve', 'n3', 0, 0.4], ['click', 'ei', 0.5, 0.4], ['click', 'ei2', 0.8, 0.5]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.5, 1.3);
    heading(ctx, 'Hemmung & Rhythmus', 'GABA-Interneurone', S.on('inter', 1.0, ease.out) * (1 - S.on('ei', 1.0)), { color: C.gaba });
    const net = A * (1 - 0.8 * S.on('ei', 1.2));
    const d = S.on('n3', 2.5, ease.inOut);                 // Desynchronisation
    const weakN = S.on('n1', 1.2);                          // NMDA am Interneuron schwächer
    const inhib = S.on('brake', 1.0);
    const rhythm = S.on('clock', 1.0);
    // Interneuron-Aktivität (feuert kurz vor den Pyramidenzellen)
    const phase = fract((t - 0.15 * T * 0) / T);
    const inFire = rhythm * Math.exp(-(phase * T) * 9) * lerp(1, 0.35, S.on('n2', 1.5)) * (1 + (hash(Math.floor(t / T)) - 0.5) * d);
    // Axon-Körbe zum Pyramidenzell-Ring
    PYR.forEach((p, i) => {
      const pts = catmull([CEN, { x: lerp(CEN.x, p.x, 0.5) + Math.sin(i) * 40, y: lerp(CEN.y, p.y, 0.5) + Math.cos(i) * 30 }, { x: p.x, y: p.y + 6 }], 8);
      const k = S.on('gaba', 1.4, ease.inOut, i * 0.08);
      if (k > 0) glowPath(ctx, pts.slice(0, Math.max(2, Math.floor(pts.length * k))), C.gaba, net * 0.45, 2, 6);
      if (k >= 1 && rhythm > 0) {
        const f = clamp(phase * 3);
        if (f < 1) { const q = pointAt(pts, f); spark(ctx, q.x, q.y, 4, C.gaba, net * inFire * 1.2); }
      }
      // Korb um den Zellkörper
      ctx.strokeStyle = rgba(C.gaba, net * 0.5 * k); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, TAU * 0.8); ctx.stroke();
    });
    // Pyramidenzellen
    PYR.forEach((p, i) => {
      const sp = spikes(i, t - 0.6, t, lerp(0, 1, d));
      let fire = 0;
      for (const s of sp) fire = Math.max(fire, Math.exp(-(t - s) * 10));
      fire *= S.on('brake', 1.0) + (1 - S.on('brake', 1.0)) * 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + i * 2));
      const dim = inhib * inFire * 0.5 * (1 - d);
      pyramid(ctx, p.x, p.y, 1.1, mixColor(C.neuron, '#5d6b8f', dim), net * tween(t, S.start - 0.6 + i * 0.05, 1.2, ease.out), fire);
    });
    // Interneuron (Mitte)
    const ia = Math.max(0.5 * tween(t, S.start - 0.5, 1.2), S.on('inter', 1.0, ease.outBack)) * net;
    glow(ctx, CEN.x, CEN.y, 150 * (0.6 + inFire * 0.8), C.gaba, 0.35 * ia);
    dot(ctx, CEN.x, CEN.y, 32 * ia, mixColor(C.gaba, '#ffffff', inFire * 0.5), net);
    for (let k = 0; k < 5; k++) { const an = k * 1.25 + 0.3; strokePath(ctx, [{ x: CEN.x + Math.cos(an) * 30, y: CEN.y + Math.sin(an) * 30 }, { x: CEN.x + Math.cos(an) * 80, y: CEN.y + Math.sin(an) * 70 }], C.gaba, net * 0.8 * ia, 4); }
    if (S.on('inter', 1) > 0) callout(ctx, CEN.x + 30, CEN.y - 20, CEN.x + 250, 150, 'Interneuron', { p: S.win('inter', 'link', 0.8, 0.6), color: C.gaba, size: 30 });
    const gl = S.win('gaba', 'clock', 0.8, 0.6);
    if (gl > 0) badge(ctx, 'GABA: wichtigster hemmender Botenstoff', 960, 605, { color: C.gaba, p: gl, size: 26 });
    const ck = S.win('clock', 'gamma', 0.8, 0.6);
    if (ck > 0) badge(ctx, 'Taktgeber: bremst viele Zellen gleichzeitig', 960, 605, { color: C.gaba, p: ck, size: 26 });
    // NMDA-Rezeptoren am Interneuron
    const lk = S.on('link', 1.0);
    if (lk > 0) {
      for (let k = 0; k < 5; k++) {
        const an = k * 1.25 + 0.3;
        const x = CEN.x + Math.cos(an) * 80, y = CEN.y + Math.sin(an) * 70;
        dot(ctx, x, y, 7, '#6fb0ff', net * lk * (1 - 0.7 * weakN));
        glow(ctx, x, y, 22, '#6fb0ff', net * lk * 0.5 * (1 - weakN));
      }
      const l1 = S.win('n1', 'pm', 0.8, 0.8);
      if (l1 > 0) callout(ctx, CEN.x + 80, CEN.y + 60, CEN.x + 290, 600, 'NMDA-Signal abgeschwächt', { p: l1, color: '#6fb0ff', size: 28 });
      const l2 = S.win('n2', 'pm', 0.8, 0.8);
      if (l2 > 0) callout(ctx, CEN.x - 30, CEN.y + 20, CEN.x - 290, 600, 'hemmt weniger zuverlässig', { p: l2, color: C.gaba, size: 28 });
    }
    // Raster & Summenwelle
    const ra = S.on('sync', 1.2) * net;
    if (ra > 0) {
      const win = 4.0;
      strokePath(ctx, [{ x: RAS.x0, y: RAS.y0 - 12 }, { x: RAS.x1, y: RAS.y0 - 12 }], C.textDim, ra * 0.25, 1);
      for (let i = 0; i < NP; i++) {
        for (const s of spikes(i, t - win, t, d)) {
          const x = lerp(RAS.x0, RAS.x1, 1 - (t - s) / win);
          strokePath(ctx, [{ x, y: RAS.y0 + i * RAS.row }, { x, y: RAS.y0 + i * RAS.row + 11 }], C.glu, ra, 3);
        }
      }
      text(ctx, 'Aktivität der Zellen', RAS.x0 - 20, RAS.y0 + 56, { size: 20, weight: 600, color: C.textDim, font: 'text', align: 'right', alpha: ra });
      const ga = S.on('gamma', 1.2) * net;
      if (ga > 0) {
        const pts = [];
        for (let k = 0; k <= 240; k++) {
          const tau = t - win + (k / 240) * win;
          let v = 0;
          for (let i = 0; i < NP; i++) for (const s of spikes(i, tau - 0.4, tau + 0.4, d)) v += Math.exp(-((tau - s) ** 2) / (2 * 0.07 * 0.07));
          pts.push({ x: lerp(RAS.x0, RAS.x1, k / 240), y: TRACE.y - (v / NP) * TRACE.h * 1.4 + TRACE.h * 0.5 });
        }
        glowPath(ctx, pts, C.gaba, ga, 2.5, 8);
        text(ctx, 'Summenrhythmus', RAS.x0 - 20, TRACE.y, { size: 20, weight: 600, color: C.gaba, font: 'text', align: 'right', alpha: ga });
        const g2 = S.win('gamma2', 'link', 0.8, 0.8);
        if (g2 > 0) text(ctx, 'Gamma-Oszillationen (≈ 30 – 80 Hz, hier stark verlangsamt)', RAS.x1, TRACE.y + 50, { size: 22, weight: 600, color: C.gaba, font: 'text', align: 'right', alpha: g2, reveal: g2 });
        const wm = S.win('wm', 'link', 0.8, 0.8);
        if (wm > 0) { badge(ctx, 'Aufmerksamkeit', 1720, 640, { color: C.text, p: wm, size: 22 }); badge(ctx, 'Arbeitsgedächtnis', 1720, 700, { color: C.text, p: S.on('wm', 0.6, ease.out, 0.4), size: 22 }); }
        const n3 = S.win('n3', 'pm', 0.8, 0.8);
        if (n3 > 0) text(ctx, 'Das Netzwerk verliert seinen Takt', RAS.x1, TRACE.y + 50, { size: 26, weight: 700, color: C.warn, font: 'text', align: 'right', alpha: n3, reveal: n3 });
      }
    }
    const pm = S.win('pm', 'ei', 0.8, 0.8);
    if (pm > 0) {
      badge(ctx, 'Befunde: Veränderungen in bestimmten Interneuronen (Gewebestudien)', 960, 605, { color: C.text, p: pm, size: 22 });
      const gr = S.on('gred', 0.8);
      if (gr > 0) badge(ctx, 'häufig veränderte Gamma-Aktivität (EEG/MEG)', 960, 150, { color: C.gaba, p: gr, size: 22 });
    }
    // Erregungs-Hemmungs-Gleichgewicht (Waage)
    const ei = S.on('ei', 1.2);
    if (ei > 0) {
      const tilt = S.on('ei2', 1.5, ease.inOut) * 0.2 * Math.sin(1 + 0 * t) + Math.sin(t * 1.2) * 0.015;
      const cx = 960, cy = 470, L = 380;
      ctx.save(); ctx.translate(cx, cy);
      strokePath(ctx, [{ x: 0, y: 0 }, { x: 0, y: 250 }], C.textDim, ei, 6);
      fillPath(ctx, [{ x: -80, y: 260 }, { x: 80, y: 260 }, { x: 0, y: 220 }], rgba(C.textDim, 0.6 * ei));
      ctx.rotate(tilt);
      strokePath(ctx, [{ x: -L, y: 0 }, { x: L, y: 0 }], C.text, ei, 6);
      dot(ctx, 0, 0, 12, C.text, ei);
      for (const [sx, col, lab, sub] of [[-1, C.glu, 'Erregung', 'Glutamat'], [1, C.gaba, 'Hemmung', 'GABA']]) {
        ctx.save(); ctx.translate(sx * L, 0); ctx.rotate(-tilt);
        strokePath(ctx, [{ x: 0, y: 0 }, { x: -60, y: 120 }], C.textDim, ei, 2); strokePath(ctx, [{ x: 0, y: 0 }, { x: 60, y: 120 }], C.textDim, ei, 2);
        ctx.fillStyle = rgba(col, 0.25 * ei); ctx.strokeStyle = rgba(col, ei); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 125, 90, 20, 0, 0, TAU); ctx.fill(); ctx.stroke();
        for (let k = 0; k < 7; k++) spark(ctx, -50 + k * 17, 105 - (k % 2) * 8, 4.5, col, ei);
        text(ctx, lab, 0, 190, { size: 36, weight: 700, color: col, alpha: ei });
        text(ctx, sub, 0, 230, { size: 24, weight: 600, color: C.textDim, font: 'text', alpha: ei });
        ctx.restore();
      }
      ctx.restore();
      text(ctx, 'Erregung ↔ Hemmung', 960, 170, { size: 54, weight: 700, alpha: ei, reveal: ei, glow: 0.4 });
      const e2 = S.on('ei2', 1.0, ease.out, 0.5);
      if (e2 > 0) badge(ctx, 'aus der Balance → Informationsverarbeitung kann leiden', 960, 860, { color: C.warn, p: e2, size: 24 });
    }
  },
};
