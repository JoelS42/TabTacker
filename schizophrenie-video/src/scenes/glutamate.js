// Szene 12 – Akt IV: Glutamat-Synapse und Glutamat-Glutamin-Zyklus
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, glowPath, fillPath, catmull, blobPts, fract, noise2, mixColor, pointAt, subPath, smoothstep } from '../animation.js';
import { flow } from './shared.js';

const R = rng(121);
// Präsynaptisches Endknöpfchen (oben) und postsynaptischer Dorn (unten)
const PRE = catmull([
  { x: 900, y: 40 }, { x: 900, y: 120 }, { x: 760, y: 170 }, { x: 620, y: 270 }, { x: 590, y: 380 }, { x: 650, y: 455 }, { x: 800, y: 478 },
  { x: 960, y: 482 }, { x: 1120, y: 478 }, { x: 1270, y: 455 }, { x: 1330, y: 380 }, { x: 1300, y: 270 }, { x: 1160, y: 170 }, { x: 1020, y: 120 }, { x: 1020, y: 40 },
], 8, false);
const POST = catmull([
  { x: 900, y: 1100 }, { x: 900, y: 900 }, { x: 740, y: 840 }, { x: 610, y: 720 }, { x: 600, y: 610 }, { x: 680, y: 552 }, { x: 820, y: 540 },
  { x: 960, y: 538 }, { x: 1100, y: 540 }, { x: 1240, y: 552 }, { x: 1320, y: 610 }, { x: 1310, y: 720 }, { x: 1180, y: 840 }, { x: 1020, y: 900 }, { x: 1020, y: 1100 },
], 8, false);
const ASTRO_L = catmull([{ x: 0, y: 330 }, { x: 250, y: 360 }, { x: 470, y: 420 }, { x: 560, y: 505 }, { x: 470, y: 590 }, { x: 250, y: 650 }, { x: 0, y: 690 }], 8);
const ASTRO_R = ASTRO_L.map((p) => ({ x: W - p.x, y: p.y }));
const VES = [
  { x: 800, y: 300 }, { x: 900, y: 250 }, { x: 1040, y: 270 }, { x: 1150, y: 320 }, { x: 720, y: 390 }, { x: 1210, y: 400 },
  { x: 880, y: 420, dock: 0 }, { x: 980, y: 430, dock: 1 }, { x: 1070, y: 415, dock: 2 }, { x: 960, y: 340 },
];
const REC = [{ x: 800, kind: 'AMPA' }, { x: 900, kind: 'NMDA' }, { x: 1020, kind: 'NMDA' }, { x: 1120, kind: 'AMPA' }];
const GLU = Array.from({ length: 60 }, (_, i) => ({
  src: VES[6 + (i % 3)], dx: R.range(-180, 180), rec: R() < 0.45 ? REC[i % 4] : null, side: R() < 0.5 ? -1 : 1, d: R(), ph: R() * 10,
}));
// Rückweg Glutamin: Astrozyt → Endknöpfchen
const BACK_L = catmull([{ x: 420, y: 460 }, { x: 430, y: 330 }, { x: 560, y: 220 }, { x: 760, y: 230 }, { x: 860, y: 330 }], 10);
const BACK_R = BACK_L.map((p) => ({ x: W - p.x, y: p.y }));
const CYCLE = catmull([{ x: 960, y: 380 }, { x: 960, y: 510 }, { x: 760, y: 520 }, { x: 470, y: 505 }, { x: 420, y: 330 }, { x: 600, y: 200 }, { x: 860, y: 250 }, { x: 960, y: 380 }], 10);

function receptor(ctx, r, a, lit, t) {
  const y = 540;
  const w = r.kind === 'NMDA' ? 44 : 32, h = r.kind === 'NMDA' ? 70 : 54;
  const col = r.kind === 'NMDA' ? '#6fb0ff' : '#7fe0d0';
  ctx.save();
  ctx.fillStyle = rgba(mixColor(col, C.glu, lit * 0.6), a * 0.9);
  ctx.beginPath(); ctx.ellipse(r.x - w * 0.28, y, w * 0.26, h / 2, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r.x + w * 0.28, y, w * 0.26, h / 2, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (lit > 0) glow(ctx, r.x, y, 60, C.glu, a * lit * 0.6);
}

export default {
  id: 'glutamate',
  transition: { type: 'zoomIn', dur: 2.0, fromX: 960, fromY: 520 },
  sfx: [['whoosh', 'into', 0, 0.5], ['impulse', 'ap', 0.3, 0.8], ['click', 'fuse', 0.2, 0.5], ['release', 'release', 0, 0.8], ['click', 'bind', 0.2, 0.4], ['click', 'ampa', 0, 0.3], ['click', 'nmda', 0, 0.3],
    ['swell', 'astro', 0, 0.4], ['chime', 'convert', 0.3, 0.3], ['whoosh', 'back', 0, 0.3], ['chime', 'reconv', 0.3, 0.3], ['swell', 'cycle', 0, 0.5]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.6, 1.4);
    heading(ctx, 'Akt IV · Botenstoffe', 'Glutamat', S.on('into', 1.0, ease.out) * (1 - S.on('cycle', 1) * 0.0), { color: C.glu, x: 90, y: 100 });
    // Astrozyten
    const as = S.on('astro', 1.2);
    for (const P of [ASTRO_L, ASTRO_R]) {
      fillPath(ctx, P, rgba(C.astro, (0.12 + 0.22 * as) * A));
      strokePath(ctx, P, C.astro, A * (0.35 + 0.5 * as), 2.5);
    }
    if (as > 0) {
      glow(ctx, 380, 505, 180, C.astro, 0.25 * as * A); glow(ctx, W - 380, 505, 180, C.astro, 0.25 * as * A);
      callout(ctx, 330, 600, 260, 800, 'Astrozyt', { p: S.win('astro', 'cycle', 0.8, 0.8), color: C.astro, size: 32 });
      // Transporter
      for (const x of [560, W - 560]) { dot(ctx, x, 505, 9, C.astro, as * A); glow(ctx, x, 505, 30, C.astro, as * A * 0.5); }
    }
    // Membranen
    const draw = tween(t, S.start - 0.2, 2.0);
    fillPath(ctx, [...PRE, { x: 1020, y: 0 }, { x: 900, y: 0 }], rgba('#20315f', 0.55 * A));
    glowPath(ctx, subPath(PRE, 0, draw), '#9fb6ff', A, 3, 8);
    fillPath(ctx, POST, rgba('#1d2c55', 0.55 * A));
    glowPath(ctx, subPath(POST, 0, draw), '#9fb6ff', A, 3, 8);
    // Aktionspotential
    const ap = tween(t, S.cue('ap'), 1.2, ease.in);
    if (ap > 0 && ap < 1) { glow(ctx, 960, lerp(0, 380, ap), 70, C.glu, 0.9 * A); glow(ctx, 960, lerp(0, 380, ap), 20, '#ffffff', A, 1); }
    const apFlash = Math.exp(-Math.max(0, t - S.cue('ap') - 1.2) * 3) * (t > S.cue('ap') + 1.2 ? 1 : 0);
    if (apFlash > 0.01) glow(ctx, 960, 400, 360, C.glu, 0.25 * apFlash * A);
    const apL = S.win('ap', 'fuse', 0.5, 0.6);
    if (apL > 0) text(ctx, 'elektrisches Signal', 1060, 120, { size: 28, weight: 600, color: C.glu, align: 'left', alpha: apL });
    // Vesikel
    const vA = S.on('vesicles', 1.2) * A;
    const gluLit = S.on('glu', 1.0);
    const fuse = S.on('fuse', 1.6, ease.inOut);
    const reconv = S.on('reconv', 1.5);
    VES.forEach((v, i) => {
      let x = v.x, y = v.y, r = 30, al = vA;
      if (v.dock !== undefined) {
        y = lerp(v.y, 482, fuse); r = lerp(30, 18, fuse);
        al *= 1 - smoothstep(0.75, 1, fuse) + reconv;
        if (reconv > 0) { y = lerp(482, v.y, reconv); r = lerp(18, 30, reconv); }
      }
      if (al <= 0.01) return;
      ctx.save(); ctx.strokeStyle = rgba('#b9c9ff', al * 0.9); ctx.lineWidth = 2.5; ctx.fillStyle = rgba('#0c1733', al * 0.7);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      for (let k = 0; k < 7; k++) {
        const an = k * 0.9 + i + t * 0.6, rr = r * 0.55 * (0.4 + (k % 3) * 0.3);
        spark(ctx, x + Math.cos(an) * rr, y + Math.sin(an) * rr, 2.6, C.glu, al * (0.3 + 0.7 * gluLit));
      }
    });
    const vl = S.win('vesicles', 'glu', 0.8, 0.6);
    if (vl > 0) callout(ctx, VES[3].x + 30, VES[3].y - 10, 1480, 250, 'Vesikel', { p: vl, color: '#b9c9ff', size: 34 });
    const gl = S.win('glu', 'ap', 0.8, 0.6);
    if (gl > 0) callout(ctx, VES[3].x + 20, VES[3].y + 10, 1480, 250, 'gefüllt mit Glutamat', { p: gl, color: C.glu, size: 34 });
    const mn = S.win('main', 'ap', 0.8, 0.6);
    if (mn > 0) badge(ctx, 'wichtigster erregender Botenstoff des Gehirns', 960, 880, { color: C.glu, p: mn, size: 26 });
    // Rezeptoren
    const bindP = S.on('bind', 1.0);
    REC.forEach((r) => receptor(ctx, r, A * S.on('into', 1.5), bindP * (0.6 + 0.4 * Math.sin(t * 5 + r.x)) * (1 - S.on('astro', 2) * 0.8), t));
    const am = S.win('ampa', 'astro', 0.8, 0.8);
    if (am > 0) { callout(ctx, 800, 575, 520, 800, 'AMPA: reagiert schnell', { p: am, color: '#7fe0d0', size: 30 }); callout(ctx, 1120, 575, 1400, 800, '', { p: am, color: '#7fe0d0', size: 30 }); }
    const nm = S.win('nmda', 'astro', 0.8, 0.8);
    if (nm > 0) callout(ctx, 1020, 580, 1260, 740, 'NMDA', { p: nm, color: '#6fb0ff', size: 34 });
    const cl = S.win('cleft', 'bind', 0.6, 0.6);
    if (cl > 0) callout(ctx, 1250, 510, 1480, 420, 'synaptischer Spalt', { p: cl, color: C.text, size: 30 });
    // Glutamat-Moleküle: Freisetzung → Spalt → Rezeptor → Astrozyt → Glutamin → zurück
    const tRel = S.cue('release'), tAst = S.cue('astro'), tConv = S.cue('convert'), tBack = S.cue('back'), tRe = S.cue('reconv');
    if (t > tRel) {
      for (const g of GLU) {
        const k1 = tween(t, tRel + g.d * 0.4, 1.8 + g.d, ease.out);
        let x = lerp(g.src.x, g.src.x + g.dx * 0.8, k1) + noise2(g.ph, t * 0.8) * 10 * k1;
        let y = lerp(482, g.rec ? 528 : 505 + noise2(g.ph + 3, t * 0.7) * 12, k1);
        if (g.rec) x = lerp(x, g.rec.x + noise2(g.ph, t) * 8, tween(t, tRel + 1 + g.d, 1.2));
        const side = g.side;
        const k2 = tween(t, tAst + g.d * 1.2, 2.0, ease.inOut);
        const ax = side < 0 ? 380 + noise2(g.ph, t * 0.5) * 60 : W - 380 + noise2(g.ph, t * 0.5) * 60;
        const ay = 505 + noise2(g.ph + 7, t * 0.5) * 50;
        x = lerp(x, ax, k2); y = lerp(y, ay, k2);
        const conv = tween(t, tConv + g.d * 0.8, 1.0);
        const k3 = tween(t, tBack + g.d * 1.6, 2.2, ease.inOut);
        if (k3 > 0) { const p = pointAt(side < 0 ? BACK_L : BACK_R, k3); x = lerp(x, p.x, Math.min(1, k3 * 3)); y = lerp(y, p.y, Math.min(1, k3 * 3)); if (k3 > 0.33) { x = p.x; y = p.y; } }
        const re = tween(t, tRe + g.d * 0.8, 1.0);
        const intoV = tween(t, tRe + 0.8 + g.d, 1.4, ease.inOut);
        if (intoV > 0) { const v = VES[6 + (Math.floor(g.d * 3) % 3)]; x = lerp(x, v.x + noise2(g.ph, t) * 10, intoV); y = lerp(y, v.y + noise2(g.ph + 1, t) * 10, intoV); }
        const col = mixColor(C.glu, C.gln, conv * (1 - re));
        const al = A * (1 - smoothstep(0.8, 1, intoV)) * (1 - S.on('cycle', 1.0));
        spark(ctx, x, y, 3.2, col, al);
      }
    }
    const cv = S.win('convert', 'cycle', 0.8, 0.8);
    if (cv > 0) { text(ctx, 'Glutamat → Glutamin', 300, 250, { size: 32, weight: 700, color: C.gln, alpha: cv, reveal: cv }); }
    const bk = S.win('back', 'cycle', 0.8, 0.8);
    if (bk > 0) text(ctx, 'Glutamin zurück zur Nervenzelle', 1500, 170, { size: 28, weight: 600, color: C.gln, alpha: bk, reveal: bk });
    const rc = S.win('reconv', 'cycle', 0.8, 0.8);
    if (rc > 0) text(ctx, 'Glutamin → Glutamat', 1500, 215, { size: 28, weight: 600, color: C.glu, alpha: rc, reveal: rc });
    // Zyklus
    const cy = S.on('cycle', 1.4);
    if (cy > 0) {
      glowPath(ctx, subPath(CYCLE, 0, cy), C.glu, 0.5 * cy, 3, 10);
      for (let i = 0; i < 26; i++) {
        const f = fract(i / 26 + t * 0.12);
        const p = pointAt(CYCLE, f);
        const inAstro = f > 0.3 && f < 0.72;
        spark(ctx, p.x, p.y, 3.4, inAstro ? C.gln : C.glu, cy);
      }
      text(ctx, 'Glutamat-Glutamin-Zyklus', 960, 880, { size: 38, weight: 700, color: C.gln, alpha: cy, reveal: cy, glow: 0.4 });
      const bl = S.on('balance', 1.0);
      if (bl > 0) badge(ctx, 'hilft, die Erregung im Gleichgewicht zu halten', 1440, 200, { color: C.text, p: bl, size: 24 });
    }
  },
};
