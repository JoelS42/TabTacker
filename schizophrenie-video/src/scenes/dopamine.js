// Szene 15 – Dopamin: Bahnen, Striatum, aberrante Salienz, Verbindung zu Glutamat/GABA
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, hash, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, glowPath, fillPath, catmull, fract, noise2, mixColor, smoothstep, drawBrain, pointAt, subPath } from '../animation.js';
import { flow } from './shared.js';

const B = { x: 760, y: 540, s: 0.92 };
const VTA = { x: 150, y: 140 }, SN = { x: 190, y: 150 };
const STR_V = { x: -140, y: 10 }, STR_D = { x: -90, y: -80 }, PFC = { x: -350, y: -150 }, HIP = { x: 60, y: 110 };
const PATHS = [
  { name: 'mesolimbisch', from: VTA, pts: [VTA, { x: 40, y: 70 }, { x: -60, y: 40 }, STR_V], w: 1.0 },
  { name: 'mesokortikal', from: VTA, pts: [VTA, { x: 80, y: -60 }, { x: -120, y: -200 }, PFC], w: 0.6 },
  { name: 'nigrostriatal', from: SN, pts: [SN, { x: 120, y: 30 }, { x: 10, y: -80 }, STR_D], w: 0.85 },
].map((p) => ({ ...p, c: catmull(p.pts, 10) }));
const STRIATUM = catmull([{ x: 40, y: -120 }, { x: -60, y: -150 }, { x: -170, y: -110 }, { x: -200, y: -20 }, { x: -150, y: 40 }, { x: -80, y: 30 }, { x: -110, y: -40 }, { x: -60, y: -90 }, { x: 20, y: -80 }], 6, true);
const HIPPO = catmull([{ x: -20, y: 150 }, { x: 40, y: 120 }, { x: 110, y: 110 }, { x: 150, y: 70 }, { x: 130, y: 60 }, { x: 90, y: 90 }, { x: 30, y: 105 }, { x: -20, y: 130 }], 6, true);
const R = rng(151);
const ITEMS = Array.from({ length: 24 }, (_, i) => ({ x: 1470 + (i % 6) * 62 + R.range(-10, 10), y: 330 + Math.floor(i / 6) * 70 + R.range(-10, 10), s: R.range(8, 14), kind: R.int(0, 2) }));
const IMPORTANT = 9;
const TRI = [{ x: 960, y: 250, label: 'GLUTAMAT', color: C.glu }, { x: 680, y: 700, label: 'GABA', color: C.gaba }, { x: 1240, y: 700, label: 'DOPAMIN', color: C.da }];

const toS = (p) => ({ x: B.x + p.x * B.s, y: B.y + p.y * B.s });

export default {
  id: 'dopamine',
  transition: { type: 'zoomOut', dur: 2.0 },
  sfx: [['swell', 'da', 0, 0.5], ['grow', 'paths', 0, 0.4], ['chime', 'str', 0, 0.3], ['chime', 'pfc', 0, 0.3], ['chime', 'sal2', 0, 0.3], ['swell', 'pet', 0, 0.4],
    ['click', 'ab', 0.5, 0.4], ['click', 'ab', 1.4, 0.4], ['click', 'ab', 2.3, 0.4], ['low', 'meds', 0, 0.4], ['whoosh', 'hippo', 0, 0.4], ['swell', 'triad', 0, 0.6]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.5, 1.4);
    const brainA = A * (1 - 0.75 * S.on('triad', 1.2));
    heading(ctx, 'Botenstoff', 'Dopamin', S.on('da', 1.0, ease.out) * (1 - S.on('triad', 1)), { color: C.da });
    ctx.save(); ctx.translate(B.x, B.y); ctx.scale(B.s, B.s);
    drawBrain(ctx, { alpha: brainA, gyri: 0.45, fill: 0.45 });
    // Striatum
    const st = S.on('str', 1.0) * 0.6 + S.on('rel', 1.5) * 0.4;
    fillPath(ctx, STRIATUM, rgba(C.da, (0.12 + 0.25 * st) * brainA));
    strokePath(ctx, STRIATUM, C.da, brainA * (0.35 + 0.5 * st), 2, true);
    // Hippocampus
    const hp = S.on('hippo', 1.2);
    fillPath(ctx, HIPPO, rgba(C.glu, (0.08 + 0.35 * hp) * brainA));
    strokePath(ctx, HIPPO, C.glu, brainA * (0.25 + 0.6 * hp), 2, true);
    // Mittelhirn-Kerne
    const md = S.on('mid', 1.0);
    for (const n of [VTA, SN]) { glow(ctx, n.x, n.y, 60 + 20 * Math.sin(t * 2), C.da, brainA * (0.25 + 0.5 * md)); dot(ctx, n.x, n.y, 10, C.da, brainA * (0.4 + 0.6 * md)); }
    // Bahnen
    PATHS.forEach((p, i) => {
      const k = S.on('paths', 1.8, ease.inOut, i * 0.4);
      if (k <= 0) return;
      glowPath(ctx, subPath(p.c, 0, k), C.da, brainA * 0.6 * p.w, 3, 10);
      if (k >= 1) flow(ctx, p.c, t, { n: Math.round(10 * p.w), speed: 0.22 + i * 0.05, color: C.da, r: 3.2, alpha: brainA * p.w });
    });
    // PET: erhöhte Synthese/Freisetzung im Striatum
    const pet = S.on('pet', 1.8);
    if (pet > 0) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
      glow(ctx, -100, -50, 260 * pulse, '#ff8a3d', 0.45 * pet * brainA);
      glow(ctx, -100, -50, 140 * pulse, C.da, 0.55 * pet * brainA);
      for (let k = 0; k < 18; k++) { const an = k * 0.35 + t * 0.4; const r = 60 + (k % 4) * 30; spark(ctx, -100 + Math.cos(an) * r, -50 + Math.sin(an) * r * 0.6, 3, C.da, pet * brainA); }
    }
    // Antipsychotika an D2-Rezeptoren
    const me = S.win('meds', 'notiso', 0.8, 0.8);
    if (me > 0) {
      for (let k = 0; k < 6; k++) {
        const x = -170 + k * 45, y = -60 + Math.sin(k) * 40;
        ctx.save(); ctx.strokeStyle = rgba('#dfe6f5', me * brainA); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 14, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.fillStyle = rgba('#dfe6f5', me * brainA); ctx.fillRect(x - 12, y - 22 - 8 * (1 - S.on('meds', 1.0)), 24, 8); ctx.restore();
      }
    }
    // Hippocampus → Dopamin
    if (hp > 0) {
      const hpath = catmull([{ x: 100, y: 95 }, { x: 170, y: 60 }, { x: 175, y: 110 }, VTA], 8);
      glowPath(ctx, subPath(hpath, 0, hp), C.glu, brainA, 3, 10);
      flow(ctx, hpath, t, { n: 6, speed: 0.4, color: C.glu, r: 3, alpha: brainA * hp });
    }
    ctx.restore();
    // Beschriftungen (Bildschirm)
    const mdl = S.win('mid', 'sal', 0.8, 0.6);
    if (mdl > 0) callout(ctx, toS(VTA).x + 10, toS(VTA).y + 10, toS(VTA).x + 180, 800, 'Kerngebiete im Mittelhirn', { p: mdl, color: C.da, size: 28 });
    const sl = S.win('str', 'sal', 0.8, 0.6);
    if (sl > 0) callout(ctx, toS({ x: -170, y: -110 }).x, toS({ x: -170, y: -110 }).y, 420, 250, 'Striatum', { p: sl, color: C.da, size: 32 });
    const pl = S.win('pfc', 'sal', 0.8, 0.6);
    if (pl > 0) callout(ctx, toS(PFC).x, toS(PFC).y, 420, 330, 'präfrontaler Kortex', { p: pl, color: C.da, size: 30 });
    const ptl = S.win('paths', 'str', 0.8, 0.6);
    if (ptl > 0) text(ctx, 'verschiedene Bahnen – nicht einheitlich', 760, 880, { size: 28, weight: 600, color: C.da, alpha: ptl, reveal: ptl });
    const pe = S.win('pet', 'idea', 0.8, 0.8);
    if (pe > 0) {
      callout(ctx, toS({ x: -100, y: -50 }).x, toS({ x: -100, y: -50 }).y, 720, 800, 'mehr Dopamin-Bildung & -Freisetzung', { p: pe, color: '#ffb35c', size: 30 });
      text(ctx, 'im Striatum – bei vielen Betroffenen (Bildgebung)', 732, 842, { size: 22, weight: 500, color: C.textDim, font: 'text', align: 'left', alpha: pe });
    }
    const rl = S.win('rel', 'pet', 0.8, 0.6);
    if (rl > 0) badge(ctx, 'besonders relevant für psychotische Symptome', 760, 880, { color: C.da, p: rl, size: 24 });
    // Salienz-Panel
    const sa = S.on('sal', 1.0) * (1 - S.on('meds', 1.0));
    if (sa > 0) {
      text(ctx, 'Was ist wichtig?', 1625, 250, { size: 32, weight: 700, color: C.text, alpha: sa, reveal: sa });
      const ab = S.on('ab', 1.0);
      ITEMS.forEach((it, i) => {
        const imp = i === IMPORTANT ? S.on('sal2', 0.8) * (1 - ab * 0.6) : 0;
        const wrongF = ab * Math.max(0, Math.sin(t * 2.3 + i * 1.9)) ** 12 * (i % 3 === 0 ? 1 : 0);
        const col = imp > 0.3 || wrongF > 0.3 ? C.da : '#6f7fa8';
        if (it.kind === 0) dot(ctx, it.x, it.y, it.s * 0.8, col, sa * 0.9);
        else if (it.kind === 1) { ctx.save(); ctx.fillStyle = rgba(col, sa * 0.9); ctx.fillRect(it.x - it.s * 0.7, it.y - it.s * 0.7, it.s * 1.4, it.s * 1.4); ctx.restore(); }
        else fillPath(ctx, [{ x: it.x, y: it.y - it.s }, { x: it.x + it.s, y: it.y + it.s * 0.7 }, { x: it.x - it.s, y: it.y + it.s * 0.7 }], rgba(col, sa * 0.9));
        if (imp > 0) { ctx.strokeStyle = rgba(C.da, sa * imp); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(it.x, it.y, 26, 0, TAU); ctx.stroke(); glow(ctx, it.x, it.y, 60, C.da, 0.4 * imp * sa); }
        if (wrongF > 0.05) glow(ctx, it.x, it.y, 50, C.da, wrongF * sa * 0.8);
      });
      if (ab > 0) {
        const chain = [0, 3, 9, 15, 18, 21].map((i) => ITEMS[i]);
        for (let k = 0; k < chain.length - 1; k++) strokePath(ctx, subPath([chain[k], chain[k + 1]], 0, clamp(ab * 3 - k * 0.4)), C.da, sa * 0.6, 2);
        text(ctx, 'Unwichtiges wirkt plötzlich bedeutsam', 1625, 640, { size: 24, weight: 600, color: C.da, font: 'text', alpha: sa, reveal: ab });
      }
      const s2 = S.win('sal2', 'idea', 0.6, 0.6);
      if (s2 > 0) text(ctx, 'Dopamin markiert, was Aufmerksamkeit verdient', 1625, 640, { size: 22, weight: 600, color: C.da, font: 'text', alpha: s2, reveal: s2 });
      const id = S.win('idea', 'meds', 0.6, 0.6);
      if (id > 0) badge(ctx, 'Erklärungsidee: „aberrante Salienz“', 1625, 700, { color: C.warn, p: id, size: 22 });
      const a2 = S.win('ab2', 'meds', 0.6, 0.6);
      if (a2 > 0) badge(ctx, 'ein möglicher Weg zu Wahnideen', 1625, 760, { color: C.warn, p: a2, size: 22 });
    }
    const ml = S.win('meds', 'notiso', 0.8, 0.8);
    if (ml > 0) {
      text(ctx, 'Antipsychotika', 1560, 400, { size: 38, weight: 700, color: C.text, alpha: ml, reveal: ml });
      text(ctx, 'wirken v. a. an Dopamin-Rezeptoren (D2)', 1560, 450, { size: 24, weight: 600, color: C.textDim, font: 'text', alpha: ml });
      text(ctx, 'helfen besonders gegen', 1560, 520, { size: 24, weight: 600, color: C.textDim, font: 'text', alpha: ml });
      text(ctx, 'Wahn & Halluzinationen', 1560, 560, { size: 30, weight: 700, color: C.da, alpha: ml, reveal: S.on('meds', 1.0, ease.out, 1.0) });
    }
    const ni = S.win('notiso', 'triad', 0.8, 0.8);
    if (ni > 0) {
      text(ctx, 'arbeitet nicht isoliert', 1560, 400, { size: 38, weight: 700, color: C.text, alpha: ni, reveal: ni });
      if (hp > 0) callout(ctx, toS(HIP).x, toS(HIP).y + 10, 1300, 820, 'Hippocampus: Glutamat-Aktivität beeinflusst Dopamin', { p: hp * ni, color: C.glu, size: 26 });
    }
    // Dreieck Glutamat – GABA – Dopamin
    const tr = S.on('triad', 1.4);
    if (tr > 0) {
      for (let i = 0; i < 3; i++) {
        const a = TRI[i], b = TRI[(i + 1) % 3];
        const mid = { x: (a.x + b.x) / 2 + (960 - (a.x + b.x) / 2) * -0.15, y: (a.y + b.y) / 2 + (540 - (a.y + b.y) / 2) * -0.15 };
        const pts = catmull([a, mid, b], 10);
        glowPath(ctx, subPath(pts, 0, tr), '#c7d3f0', tr * 0.5, 2, 8);
        flow(ctx, pts, t, { n: 5, speed: 0.3, color: a.color, r: 3.5, alpha: tr });
        flow(ctx, pts.slice().reverse(), t, { n: 5, speed: 0.3, color: b.color, r: 3.5, alpha: tr, phase: 0.5 });
      }
      TRI.forEach((n, i) => {
        const k = S.on('triad', 0.8, ease.outBack, i * 0.3);
        glow(ctx, n.x, n.y, 120 * k, n.color, 0.35 * tr);
        dot(ctx, n.x, n.y, 26 * k, n.color, tr);
        text(ctx, n.label, n.x, n.y + (i === 0 ? -60 : 66), { size: 36, weight: 700, color: n.color, alpha: tr, reveal: k, spacing: 4 });
      });
      const t2 = S.on('triad2', 1.2);
      if (t2 > 0) text(ctx, 'eng miteinander verbunden', 960, 520, { size: 34, weight: 700, color: C.text, alpha: t2, reveal: t2 });
    }
  },
};
