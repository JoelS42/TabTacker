// Szene 10 – Mikroglia & Komplement-System (Immunprozesse an Synapsen)
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, fillPath, catmull, blobPts, fract, noise2, mixColor } from '../animation.js';
import { makeMicroglia, drawMicroglia, miniSynapse, icon } from './shared.js';

const MG = makeMicroglia(17, { n: 11, size: 1.6 });
const CELL = { x: 700, y: 540 };
const SY = [
  { x: 1240, y: 330 }, { x: 1440, y: 420 }, { x: 1300, y: 620 }, { x: 1560, y: 700 }, { x: 1650, y: 400 },
];
const WEAKI = 2;
const R = rng(101);
const DEBRIS = Array.from({ length: 6 }, (_, i) => ({ x: 380 + R.range(-120, 120), y: 300 + R.range(-60, 120) + i * 50, r: R.range(5, 10), ph: R() }));

/** C1q: „Tulpenstrauß“ mit sechs Köpfen */
function c1q(ctx, x, y, s, a, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  for (let k = 0; k < 6; k++) {
    const an = -Math.PI / 2 + (k - 2.5) * 0.28;
    const ex = Math.cos(an) * 26 * s, ey = Math.sin(an) * 26 * s;
    strokePath(ctx, [{ x: 0, y: 8 * s }, { x: ex * 0.5, y: ey * 0.5 }, { x: ex, y: ey }], C.compl, a, 2);
    dot(ctx, ex, ey, 4.5 * s, C.compl, a);
  }
  strokePath(ctx, [{ x: 0, y: 8 * s }, { x: 0, y: 22 * s }], C.compl, a, 3);
  ctx.restore();
  glow(ctx, x, y, 30 * s, C.compl, 0.25 * a);
}

export default {
  id: 'microglia',
  transition: { type: 'fade', dur: 1.6 },
  sfx: [['grow', 'immune', 0, 0.5], ['click', 'debris', 1.0, 0.4], ['chime', 'how', 0, 0.3], ['swell', 'compl', 0, 0.4], ['click', 'c1q', 0.5, 0.5], ['click', 'c3', 0.4, 0.5], ['click', 'flag', 0, 0.4], ['engulf', 'eat', 0.8, 0.9]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.4, 1.4);
    heading(ctx, 'Immunzellen des Gehirns', 'Mikroglia', S.on('immune', 1.2, ease.out) * (1 - S.on('compl', 1.0) * 0.0), { color: C.mg });
    // Synapsen rechts
    const sa = S.on('synreg', 1.2) * A;
    const weakDim = S.on('how', 1.5);
    const eat = tween(t, S.cue('eat') + 0.6, 1.8, ease.inOut);
    SY.forEach((s, i) => {
      const weak = i === WEAKI;
      let al = sa, sc = 1;
      if (weak) { al *= 1 - 0.35 * weakDim; sc = 1 - eat; al *= 1 - clamp((eat - 0.7) / 0.3); }
      miniSynapse(ctx, s.x, s.y, 56 * Math.max(0.05, sc), { alpha: al, t, active: weak ? 0 : 0.5 + 0.5 * Math.sin(t * 2 + i), color: weak ? mixColor(C.neuron, '#6d7690', weakDim) : C.neuron });
    });
    const q = S.win('how', 'compl', 0.8, 0.8);
    if (q > 0) {
      SY.forEach((s, i) => text(ctx, '?', s.x + 50, s.y - 70, { size: 46, weight: 700, color: C.warn, alpha: q * (0.6 + 0.4 * Math.sin(t * 3 + i)) }));
      statement(ctx, 'Welche Synapse soll weg?', 880, q, { size: 46 });
    }
    // Zelltrümmer
    const db = S.win('debris', 'how', 0.8, 0.8);
    DEBRIS.forEach((d, i) => {
      const grab = i === 0 ? tween(t, S.cue('debris') + 0.5, 1.8, ease.inOut) : 0;
      const x = lerp(d.x, CELL.x - 20, grab), y = lerp(d.y, CELL.y - 10, grab);
      fillPath(ctx, catmull(blobPts(x, y, d.r, d.ph * 10, t * 0.2, 0.35, 7), 3, true), rgba('#8a8fa6', A * 0.7 * (1 - grab * 0.9) * (0.4 + 0.6 * clamp(1 - S.on('synreg', 2)))));
    });
    // Mikroglia
    const reach = 0.75 + 0.25 * Math.sin(t * 0.8) * S.on('survey', 1.0);
    const tg = SY[WEAKI];
    const tgK = tween(t, S.cue('receptor'), 1.8, ease.inOut) * (1 - tween(t, S.cue('eat') + 2.4, 1.0));
    const tgDeb = tween(t, S.cue('debris'), 1.0) * (1 - tween(t, S.cue('debris') + 2.0, 1.0));
    const target = tgK > 0 ? { x: tg.x - 10, y: tg.y + 10, k: tgK } : { x: DEBRIS[0].x, y: DEBRIS[0].y, k: tgDeb };
    const mgx = lerp(CELL.x, 860, S.on('receptor', 2)), mgy = CELL.y;
    drawMicroglia(ctx, MG, { x: mgx, y: mgy, t, alpha: A, reach, target, targetProc: tgK > 0 ? 2 : 6 });
    const sv = S.win('survey', 'debris', 0.8, 0.5);
    if (sv > 0) {
      for (let k = 0; k < 3; k++) { const r = 150 + fract(t * 0.35 + k / 3) * 260; glow(ctx, mgx, mgy, 0, C.mg, 0); ctx.strokeStyle = rgba(C.mg, sv * 0.25 * (1 - fract(t * 0.35 + k / 3))); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mgx, mgy, r, 0, TAU); ctx.stroke(); }
      badge(ctx, 'tasten ständig ihre Umgebung ab', 700, 880, { color: C.mg, p: sv, size: 24 });
    }
    if (db > 0) badge(ctx, 'beseitigen Zelltrümmer', 700, 880, { color: C.textDim, p: S.win('debris', 'synreg', 0.6, 0.5), size: 24 });
    const sr = S.win('synreg', 'how', 0.6, 0.6, 0.3);
    if (sr > 0) badge(ctx, 'können an der Regulation von Synapsen beteiligt sein', 960, 880, { color: C.glu, p: sr, size: 24 });
    // Komplement-System
    const cp = S.on('compl', 1.2);
    if (cp > 0) {
      text(ctx, 'Komplement-System', 1440, 150, { size: 44, weight: 700, color: C.compl, alpha: cp, reveal: cp, glow: 0.4 });
      const c2 = S.win('compl2', 'c1q', 0.8, 0.8);
      if (c2 > 0) {
        icon(ctx, 'virus', 1250, 250, 70, '#9aa9c7', c2, t);
        c1q(ctx, 1250, 200, 0.9, c2);
        text(ctx, 'markiert eigentlich Krankheitserreger', 1320, 252, { size: 26, weight: 600, color: C.text, align: 'left', font: 'text', alpha: c2, reveal: c2 });
      }
      // C1q-Moleküle schweben zur schwachen Synapse
      for (let k = 0; k < 5; k++) {
        const st = { x: 1100 + k * 150, y: 60 + (k % 2) * 40 };
        const land = tween(t, S.cue('c1q') + k * 0.25, 2.2, ease.inOut);
        const ang = -Math.PI / 2 + (k - 2) * 0.55;
        const end = { x: tg.x + Math.cos(ang) * 44, y: tg.y + 16 + Math.sin(ang) * 40 };
        const x = lerp(st.x + noise2(k, t * 0.4) * 60, end.x, land), y = lerp(st.y + noise2(k + 5, t * 0.4) * 40, end.y, land);
        c1q(ctx, x, y, 0.75, cp * (1 - clamp((eat - 0.6) / 0.4)), ang + Math.PI / 2);
      }
      const c3 = S.on('c3', 1.5);
      if (c3 > 0) for (let k = 0; k < 14; k++) {
        const an = (k / 14) * TAU;
        const r = lerp(120, 30, c3) + Math.sin(t * 2 + k) * 3;
        spark(ctx, tg.x + Math.cos(an) * r * (1 - eat), tg.y + 16 + Math.sin(an) * r * (1 - eat), 3, C.compl, cp * (1 - clamp((eat - 0.6) / 0.4)));
      }
      if (S.on('c1q', 1) > 0) callout(ctx, tg.x + 30, tg.y - 30, 1560, 250, 'C1q', { p: S.win('c1q', 'receptor', 0.8, 0.6), color: C.compl, size: 32 });
      if (c3 > 0) callout(ctx, tg.x + 40, tg.y + 60, 1560, 850, 'C3', { p: S.win('c3', 'receptor', 0.8, 0.6), color: C.compl, size: 32 });
      const fl = S.on('flag', 0.8);
      if (fl > 0 && eat < 1) {
        for (let k = 0; k < 4; k++) {
          const an = -Math.PI / 2 + (k - 1.5) * 0.6;
          const bx = tg.x + Math.cos(an) * 30, by = tg.y + 10 + Math.sin(an) * 30;
          const fx = bx + Math.cos(an) * 34 * fl, fy = by + Math.sin(an) * 34 * fl;
          strokePath(ctx, [{ x: bx, y: by }, { x: fx, y: fy }], C.compl, cp * (1 - eat), 2.5);
          ctx.fillStyle = rgba(C.compl, cp * (1 - eat));
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 20, fy + 6 + Math.sin(t * 5 + k) * 4); ctx.lineTo(fx + 2, fy + 14); ctx.fill();
        }
        badge(ctx, 'wie kleine Markierungsfähnchen', 1300, 880, { color: C.compl, p: S.win('flag', 'receptor', 0.6, 0.6), size: 24 });
      }
      const rc = S.win('receptor', null, 0.8);
      if (rc > 0) {
        const tip = { x: lerp(mgx, tg.x, tgK), y: lerp(mgy, tg.y, tgK) };
        callout(ctx, tip.x - 20, tip.y + 30, 900, 860, 'Rezeptor erkennt die Markierung', { p: rc * (1 - S.on('eat', 0.6, ease.inOut, 1.5)), color: C.mg, size: 28 });
      }
      const ea = S.on('eat', 1.0, ease.out, 0.8);
      if (ea > 0) badge(ctx, 'Synapse wird aufgenommen und abgebaut', 960, 880, { color: C.mg, p: ea, size: 26 });
    }
  },
};
