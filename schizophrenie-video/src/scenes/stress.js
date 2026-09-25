// Szene 17 – Akt V: Stress, soziale Faktoren, Stressachse (HPA) und Cortisol
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, glowPath, fillPath, catmull, fract, noise2, mixColor, subPath, pointAt, drawFigure, drawBrain, BRAIN_REGIONS } from '../animation.js';
import { makeNetwork, drawNetwork, icon, flow } from './shared.js';

const net = makeNetwork(171, { n: 200, brain: true, minD: 38, k: 3 });
// Figur-Koordinaten (Profil): Gehirn liegt bei translate(-40,-120) scale(0.9)
const br = (p) => ({ x: -40 + p.x * 0.9, y: -120 + p.y * 0.9 });
const HYPO = br(BRAIN_REGIONS.hypothalamus), PIT = br(BRAIN_REGIONS.pituitary);
const ADR = { x: 360, y: 830 }, KID = { x: 380, y: 900 };
const ACTH = catmull([PIT, { x: -60, y: 180 }, { x: 60, y: 420 }, { x: 250, y: 650 }, ADR], 10);
const CORT = catmull([ADR, { x: 200, y: 700 }, { x: 40, y: 480 }, { x: -20, y: 200 }, { x: 40, y: -100 }], 10);
const STRESSORS = [
  { cue: 'sleep', label: 'Schlafmangel', kind: 'moon' },
  { cue: 'bully', label: 'Mobbing', kind: 'bolt' },
  { cue: 'excl', label: 'Ausgrenzung', kind: 'exclude' },
  { cue: 'chronic', label: 'chronischer Stress', kind: 'stress' },
  { cue: 'trauma', label: 'belastende Kindheitserfahrungen', kind: 'heart' },
  { cue: 'city', label: 'Aufwachsen in Großstädten', kind: 'city' },
  { cue: 'migr', label: 'Migration & Diskriminierung', kind: 'group' },
].map((s, i) => ({ ...s, x: i < 4 ? 1160 : 1480, y: i < 4 ? 250 + i * 150 : 300 + (i - 4) * 170 }));

export default {
  id: 'stress',
  transition: { type: 'zoomOut', dur: 2.0 },
  sfx: [['whooshOut', 'leave', 0, 0.6], ['click', 'sleep', 0, 0.3], ['click', 'bully', 0, 0.3], ['click', 'excl', 0, 0.3], ['click', 'chronic', 0, 0.3], ['low', 'trauma', 0, 0.4], ['click', 'city', 0, 0.3], ['click', 'migr', 0, 0.3],
    ['swell', 'social', 0, 0.4], ['impulse', 'h1', 0, 0.4], ['impulse', 'h2', 0, 0.4], ['impulse', 'h3', 0, 0.4], ['release', 'cort', 0, 0.5], ['low', 'nocause', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.6, 1.2);
    const k = S.on('leave', 2.4, ease.inOut);
    const fs = lerp(1.5, 0.52, k);
    const FX = lerp(1020, 600, k), FY = lerp(765, 340, k);
    heading(ctx, 'Akt V · Belastungen', 'Stress', S.on('person', 1.2, ease.out) * (1 - S.on('axis', 1.0)), { color: C.stress });
    const hpaOn = S.on('axis', 1.2);
    if (hpaOn > 0) heading(ctx, 'Hypothalamus · Hypophyse · Nebennieren', 'Die Stressachse', hpaOn, { color: C.stress });
    ctx.save(); ctx.translate(FX, FY); ctx.scale(fs, fs);
    drawFigure(ctx, { alpha: A * S.on('leave', 1.5), fill: 0.7 });
    ctx.save(); ctx.translate(-40, -120); ctx.scale(0.9, 0.9);
    drawBrain(ctx, { alpha: A, gyri: 0.5, fill: 0.3 });
    const plast = S.on('plast', 1.5) * (1 - S.on('nocause', 1));
    drawNetwork(ctx, net, { t, zoom: fs * 0.9, alpha: A * 0.9, lw: 1.1, nodeR: 2.8, color: C.neuron, edgeColor: '#6f8fd6', pulses: 0.5, pulseColor: C.glu, wobble: 0.3 * plast, nodeGlow: 0.2 });
    const ds = S.on('dasens', 1.2);
    if (ds > 0) { glow(ctx, -110, -40, 220 * (0.8 + 0.2 * Math.sin(t * 3)), C.da, 0.5 * ds * A); glow(ctx, 150, 140, 90, C.da, 0.6 * ds * A); }
    ctx.restore();
    // Stress-Wellen treffen die Person
    const load = S.on('load', 1.0) * (1 - hpaOn * 0.7);
    if (load > 0) for (let i = 0; i < 4; i++) {
      const f = fract(t * 0.35 + i / 4);
      ctx.strokeStyle = rgba(C.stress, load * 0.35 * (1 - f)); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(-60, -120, 700 + (1 - f) * 900, -0.7, 0.9); ctx.stroke();
    }
    // Stressachse
    if (hpaOn > 0) {
      const h1 = S.on('h1', 0.8), h2 = S.on('h2', 0.8), h3 = S.on('h3', 0.8), co = S.on('cort', 1.0);
      glow(ctx, HYPO.x, HYPO.y, 70, C.stress, A * h1 * 0.8); dot(ctx, HYPO.x, HYPO.y, 16, C.stress, A * h1);
      strokePath(ctx, subPath([HYPO, PIT], 0, h2), C.stress, A, 6);
      glow(ctx, PIT.x, PIT.y, 60, C.warn, A * h2 * 0.8); dot(ctx, PIT.x, PIT.y, 14, C.warn, A * h2);
      glowPath(ctx, subPath(ACTH, 0, S.on('h2', 2.0, ease.inOut, 0.3)), C.warn, A * 0.8, 5, 12);
      if (h3 > 0) flow(ctx, ACTH, t, { n: 10, speed: 0.4, color: C.warn, r: 6, alpha: A * h3 });
      // Niere + Nebenniere
      ctx.save(); ctx.fillStyle = rgba('#7a3a4a', 0.8 * A * h3); ctx.beginPath(); ctx.ellipse(KID.x, KID.y, 70, 105, 0.2, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.fillStyle = rgba(C.stress, A * h3); ctx.beginPath(); ctx.ellipse(ADR.x, ADR.y, 60, 26, 0.2, 0, TAU); ctx.fill(); ctx.restore();
      glow(ctx, ADR.x, ADR.y, 120, C.stress, A * h3 * 0.6);
      if (co > 0) { glowPath(ctx, subPath(CORT, 0, co), '#ff8a5b', A * 0.5, 4, 10); flow(ctx, CORT, t, { n: 14, speed: 0.3, color: '#ff8a5b', r: 7, alpha: A * co }); }
    }
    ctx.restore();
    // Beschriftungen HPA (Bildschirmkoordinaten)
    const sc = (p) => ({ x: FX + p.x * fs, y: FY + p.y * fs });
    if (hpaOn > 0) {
      const lab = [['h1', HYPO, 'Hypothalamus', 'CRH', 250], ['h2', PIT, 'Hirnanhangsdrüse', 'ACTH', 360], ['h3', ADR, 'Nebennieren', '', 690], ['cort', { x: 40, y: 480 }, 'Cortisol', 'Stresshormon', 560]];
      lab.forEach(([cue, p, l1, l2, ty]) => {
        const q = S.on(cue, 0.8) * (1 - S.on('acute', 0.8) * 0.0);
        if (q <= 0) return;
        const s = sc(p);
        callout(ctx, s.x, s.y, 1060, ty, l1, { p: q, color: cue === 'cort' ? '#ff8a5b' : C.stress, size: 32 });
        if (cue === 'h3') text(ctx, '(schematische Lage)', 1072, ty + 36, { size: 20, weight: 500, color: C.textDim, font: 'text', align: 'left', alpha: q });
        if (l2) text(ctx, l2, 1072, ty + 36, { size: 22, weight: 600, color: C.textDim, font: 'text', align: 'left', alpha: q });
      });
      // Cortisol-Verlauf: kurz vs. anhaltend
      const ac = S.on('acute', 1.2);
      if (ac > 0) {
        const gx0 = 1360, gx1 = 1800, gy = 520, gh = 150;
        strokePath(ctx, [{ x: gx0, y: gy - gh - 20 }, { x: gx0, y: gy }, { x: gx1, y: gy }], C.textDim, ac, 2);
        const acute = [], chronic = [];
        for (let i = 0; i <= 100; i++) {
          const x = i / 100;
          acute.push({ x: lerp(gx0, gx1, x), y: gy - 20 - gh * 0.8 * Math.exp(-((x - 0.25) ** 2) / 0.004) });
          chronic.push({ x: lerp(gx0, gx1, x), y: gy - 20 - gh * 0.62 * (x < 0.2 ? x / 0.2 : 1) * (1 + 0.08 * Math.sin(x * 40)) });
        }
        glowPath(ctx, subPath(acute, 0, ac), '#ff8a5b', ac, 3, 8);
        text(ctx, 'kurzfristig: hilfreich', gx0 + 10, gy + 30, { size: 22, weight: 600, color: '#ff8a5b', font: 'text', align: 'left', alpha: ac });
        const lo = S.on('long', 1.5);
        if (lo > 0) { glowPath(ctx, subPath(chronic, 0, lo), C.stress, lo, 3, 8); text(ctx, 'lang anhaltend: belastend', gx0 + 10, gy + 62, { size: 22, weight: 600, color: C.stress, font: 'text', align: 'left', alpha: lo }); }
        text(ctx, 'Cortisol', gx0 - 10, gy - gh - 34, { size: 20, weight: 600, color: C.textDim, font: 'text', align: 'left', alpha: ac });
      }
      const pl = S.win('plast', 'nocause', 0.8, 0.8);
      if (pl > 0) badge(ctx, 'kann Stressregulation & Plastizität beeinflussen', 1560, 660, { color: C.text, p: pl, size: 22 });
      const dl = S.win('dasens', 'nocause', 0.8, 0.8);
      if (dl > 0) badge(ctx, 'möglicherweise auch das Dopaminsystem', 1560, 720, { color: C.da, p: dl, size: 22 });
    }
    // Stressoren
    const stA = A * (1 - hpaOn);
    if (stA > 0) {
      const tl = S.win('teen', 'load', 0.8, 0.6);
      if (tl > 0) ['Schule', 'Freundschaften', 'Familie', 'Zukunftsfragen'].forEach((l, i) => badge(ctx, l, 1380, 300 + i * 90, { color: C.neuron, p: S.on('teen', 0.6, ease.out, i * 0.2), alpha: tl, size: 26 }));
      STRESSORS.forEach((s, i) => {
        const p = S.on(s.cue, 0.8, ease.outBack);
        if (p <= 0) return;
        const soc = S.on('social', 2.0, ease.inOut);
        const x = lerp(s.x, 1380, soc * 0.35), y = lerp(s.y, 520, soc * 0.35);
        glow(ctx, x, y, 60, C.stress, 0.2 * p * stA);
        icon(ctx, s.kind, x - 60, y, 56 * p, i >= 4 ? '#ff9d7a' : C.stress, stA, t);
        text(ctx, s.label, x - 20, y, { size: 24, weight: 600, color: i >= 4 ? '#ff9d7a' : C.stress, align: 'left', alpha: stA, reveal: S.on(s.cue, 0.8) });
      });
      const tr = S.win('trauma2', 'city', 0.8, 0.6);
      if (tr > 0) badge(ctx, 'mit erhöhtem Psychoserisiko verbunden', 1380, 830, { color: C.warn, p: tr, size: 22 });
      const so = S.on('social', 1.2);
      if (so > 0) badge(ctx, 'gemeinsamer Nenner: oft sozialer Stress', 1380, 830, { color: C.stress, p: so, size: 24 });
    }
    const nc = S.on('nocause', 1.0);
    if (nc > 0) {
      text(ctx, 'Stress allein verursacht keine Schizophrenie.', 1400, 110, { size: 34, weight: 700, alpha: nc, reveal: nc });
      const sh = S.on('shift', 1.0);
      if (sh > 0) text(ctx, 'Bei Verletzlichkeit kann er das Gleichgewicht verschieben.', 1400, 152, { size: 24, weight: 600, color: C.warn, font: 'text', alpha: sh, reveal: sh });
    }
  },
};
