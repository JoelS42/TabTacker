// Szene 9 – Synaptisches Pruning (Mikroskop-Ästhetik)
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, glowPath, fillPath, catmull, blobPts, fract, noise2, mixColor, smoothstep, roundRect, taper } from '../animation.js';
import { makeMicroglia, drawMicroglia } from './shared.js';

const R = rng(91);
const DY = (x) => 660 + Math.sin(x * 0.004 + 0.6) * 22;
const SYN = Array.from({ length: 20 }, (_, i) => {
  const x = 200 + i * 80 + R.range(-14, 14);
  return { x, h: R.range(62, 92), ang: R.range(-0.5, 0.5), axAng: R.range(-0.7, 0.7), ph: R() };
});
const EXTRA = Array.from({ length: 9 }, (_, i) => ({ x: 240 + i * 175 + R.range(-20, 20), h: R.range(34, 48), ang: R.range(-0.6, 0.6), axAng: R.range(-0.8, 0.8), ph: R(), extra: true }));
const WEAK = new Set([2, 5, 8, 11, 13, 16, 18]);
const EAT = [{ i: 8, cue: 'engulf', off: 0 }, { i: 13, cue: 'normalp', off: 0.6 }];
const MG = makeMicroglia(9, { n: 9, size: 1.1 });
const BLUR = Array.from({ length: 14 }, () => ({ x: R.range(0, W), y: R.range(0, H), r: R.range(80, 220), c: R() < 0.5 ? '#3d5aa8' : '#5b3d8f' }));

function headPos(s) {
  const base = { x: s.x, y: DY(s.x) - 22 };
  return { x: base.x + Math.sin(s.ang) * s.h, y: base.y - Math.cos(s.ang) * s.h, base };
}

function drawSyn(ctx, s, o) {
  const a = o.alpha;
  if (a <= 0.01) return;
  const { x: hx, y: hy, base } = headPos(s);
  const sc = o.scale;
  const hx2 = lerp(base.x, hx, sc), hy2 = lerp(base.y, hy, sc);
  // Axon + Bouton
  const bx = hx2 + Math.sin(s.ang) * 30 * sc, by = hy2 - Math.cos(s.ang) * 30 * sc - 10 * sc;
  const top = { x: bx + Math.sin(s.axAng) * 520, y: by - 520 };
  strokePath(ctx, catmull([{ x: bx, y: by }, { x: lerp(bx, top.x, 0.4) + 10, y: lerp(by, top.y, 0.4) }, top], 6), '#8fa7e0', a * 0.45, 3 * sc + 0.5);
  const col = mixColor('#9fb6ff', C.glu, o.act * 0.6);
  taper(ctx, catmull([base, { x: lerp(base.x, hx2, 0.5) + Math.sin(o.t + s.ph * 9) * 3, y: lerp(base.y, hy2, 0.5) }, { x: hx2, y: hy2 }], 5), 11 * sc, 8 * sc, o.color ?? col, a * 0.9);
  fillPath(ctx, catmull(blobPts(hx2, hy2, 17 * sc * o.head, s.ph * 10, o.t * 0.3, 0.12, 10, 1.25), 3, true), rgba(o.color ?? col, a));
  fillPath(ctx, catmull(blobPts(bx, by - 8 * sc, 19 * sc, s.ph * 20, o.t * 0.3, 0.12, 10, 1.3), 3, true), rgba(mixColor('#7f94cf', C.glu, o.act * 0.4), a * 0.85));
  if (o.act > 0) glow(ctx, (hx2 + bx) / 2, (hy2 + by) / 2, 60 * sc, C.glu, a * o.act * 0.8);
  if (o.stable > 0) { ctx.strokeStyle = rgba(C.glu, a * o.stable * 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx2, hy2, 28 * sc, 0, TAU); ctx.stroke(); }
  if (o.tag > 0) {
    for (let k = 0; k < 3; k++) {
      const an = -Math.PI / 2 + (k - 1) * 0.9;
      const px = hx2 + Math.cos(an) * 17 * sc, py = hy2 + Math.sin(an) * 17 * sc;
      const fx = px + Math.cos(an) * 16 * o.tag, fy = py + Math.sin(an) * 16 * o.tag;
      strokePath(ctx, [{ x: px, y: py }, { x: fx, y: fy }], C.compl, a * o.tag, 2);
      ctx.fillStyle = rgba(C.compl, a * o.tag);
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 10 * Math.cos(an + 1.2 + Math.sin(o.t * 4 + k) * 0.3), fy + 10 * Math.sin(an + 1.2)); ctx.lineTo(fx + 5 * Math.cos(an), fy + 5 * Math.sin(an)); ctx.fill();
    }
    glow(ctx, hx2, hy2, 40, C.compl, a * o.tag * 0.4);
  }
}

function dendrite(ctx, a, t, sc = 1) {
  const pts = [];
  for (let x = -40; x <= W + 40; x += 20) pts.push({ x, y: DY(x) });
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba('#8fa7e0', 0.22 * a); ctx.lineWidth = 70 * sc;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.strokeStyle = rgba('#a9bdf2', 0.85 * a); ctx.lineWidth = 50 * sc; ctx.stroke();
  ctx.strokeStyle = rgba('#d7e2ff', 0.35 * a); ctx.lineWidth = 16 * sc;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y - 8) : ctx.moveTo(p.x, p.y - 8))); ctx.stroke();
  ctx.restore();
  // Mikrotubuli-Textur
  for (let k = 0; k < 3; k++) strokePath(ctx, pts.map((p) => ({ x: p.x, y: p.y + (k - 1) * 12 + Math.sin(p.x * 0.03 + k) * 2 })), '#6f86c9', a * 0.35, 1.2);
}

// Mini-Dendrit für den Vergleich
function miniDendrite(ctx, x0, y, w, kept, removedGhost, a, t) {
  strokePath(ctx, [{ x: x0, y }, { x: x0 + w, y }], '#a9bdf2', a * 0.85, 16);
  for (let i = 0; i < 20; i++) {
    const x = x0 + 20 + i * (w - 40) / 19;
    const on = kept.includes(i);
    const hh = 40 + (i * 37 % 17);
    if (on) {
      strokePath(ctx, [{ x, y: y - 8 }, { x: x + ((i % 3) - 1) * 6, y: y - hh }], '#a9bdf2', a, 5);
      dot(ctx, x + ((i % 3) - 1) * 6, y - hh, 8, C.glu, a);
    } else if (removedGhost) {
      ctx.save(); ctx.setLineDash([3, 4]);
      strokePath(ctx, [{ x, y: y - 8 }, { x, y: y - hh }], C.textDim, a * 0.35, 1.5);
      ctx.restore();
    }
  }
}

export default {
  id: 'pruning',
  transition: { type: 'zoomIn', dur: 2.0, fromX: 1340, fromY: 480, fx: 960, fy: 560 },
  sfx: [['low', 'clean', 0, 0.5], ['chime', 'term', 0, 0.4], ['impulse', 'activity', 0.3, 0.4], ['impulse', 'activity', 1.3, 0.4], ['click', 'stabilize', 0, 0.4], ['dissolve', 'fade', 0, 0.4],
    ['click', 'tagged', 0, 0.5], ['click', 'tagged', 0.4, 0.5], ['grow', 'mg', 0, 0.5], ['engulf', 'engulf', 1.2, 0.8], ['engulf', 'normalp', 1.8, 0.7], ['whoosh', 'research', 0, 0.4], ['chime', 'spines', 0.5, 0.3], ['low', 'caution', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    const cmp = S.on('research', 1.2);
    const mainA = tween(t, S.start - 0.5, 1.4) * lerp(1, 0.12, cmp);
    // ---------------- Mikroskop-Tiefe
    for (const b of BLUR) glow(ctx, b.x + noise2(b.r, t * 0.05) * 40, b.y, b.r, b.c, 0.08 * mainA);
    if (mainA > 0.01) {
      dendrite(ctx, mainA, t);
      const act = S.on('activity', 1.0), stab = S.on('stabilize', 1.2), fade = S.on('fade', 1.5), tag = S.on('tagged', 0.8, ease.outBack);
      const kidExtra = S.on('kid', 1.2) * (1 - S.on('fade', 2.5));
      EXTRA.forEach((s) => drawSyn(ctx, s, { alpha: mainA * kidExtra * 0.7, scale: 0.7, head: 0.8, act: 0, stable: 0, tag: 0, t, color: '#8fa0c8' }));
      // Mikroglia-Weg
      const e0 = EAT[0], e1 = EAT[1];
      const tE0 = S.cue(e0.cue), tE1 = S.cue(e1.cue) + e1.off;
      const h0 = headPos(SYN[e0.i]), h1 = headPos(SYN[e1.i]);
      const mgIn = S.on('mg', 3.5, ease.inOut);
      const toSecond = tween(t, tE0 + 3.0, 1.6, ease.inOut);
      const mx = lerp(lerp(2050, h0.x + 60, mgIn), h1.x + 60, toSecond), my = lerp(lerp(980, 860, mgIn), 860, toSecond);
      const eatP = (e, te) => tween(t, te + 1.1, 1.6, ease.inOut);
      SYN.forEach((s, i) => {
        const weak = WEAK.has(i);
        const pulse = !weak && act > 0 ? Math.max(0, Math.sin((t * 1.4 + s.ph * 7) * Math.PI)) ** 8 * act : 0;
        let alpha = mainA, scale = 1, head = weak ? 1 - 0.25 * fade : 1 + 0.35 * stab;
        let color;
        if (weak) { color = mixColor('#9fb6ff', '#6d7690', fade); alpha *= 1 - 0.35 * fade; }
        const eIdx = EAT.findIndex((e) => e.i === i);
        if (eIdx >= 0) {
          const te = eIdx === 0 ? tE0 : tE1;
          const ep = eatP(EAT[eIdx], te);
          scale = 1 - ep; alpha *= 1 - smoothstep(0.7, 1, ep);
        }
        drawSyn(ctx, s, { alpha, scale, head, act: pulse, stable: weak ? 0 : stab, tag: weak ? tag : 0, t, color });
      });
      if (mgIn > 0) {
        const tgt = t < tE0 + 3 ? h0 : h1;
        const te = t < tE0 + 3 ? tE0 : tE1;
        const reach = tween(t, te, 1.2, ease.inOut) * (1 - tween(t, te + 2.4, 0.8));
        drawMicroglia(ctx, MG, { x: mx, y: my, t, alpha: mainA * clamp(mgIn * 2), reach: 0.9, target: { x: tgt.x, y: tgt.y, k: reach }, targetProc: 6 });
        const ep = eatP(null, te);
        if (ep > 0 && ep < 1) for (let k = 0; k < 6; k++) spark(ctx, lerp(tgt.x, mx, ep) + Math.sin(k * 2 + t * 3) * 14, lerp(tgt.y, my, ep) + Math.cos(k * 3 + t * 3) * 10, 2.5, C.mg, mainA * (1 - ep));
        const ml = S.win('mg2', 'research', 0.8, 0.6);
        if (ml > 0) callout(ctx, mx + 30, my - 20, mx + 260, my - 190 < 300 ? 320 : my - 190, 'Mikroglia', { p: ml, color: C.mg, size: 36 });
      }
      // Beschriftungen
      const stage = t >= S.cue('activity') ? 'ADOLESZENZ' : 'KINDHEIT';
      const sA = S.win('kid', 'research', 0.8, 0.6);
      if (sA > 0) text(ctx, stage, 960, 245, { size: 34, weight: 700, spacing: 8, color: stage === 'KINDHEIT' ? C.glu : C.mg, alpha: sA });
      const k2 = S.win('kid', 'activity', 0.8, 0.6);
      if (k2 > 0) badge(ctx, 'mehr Verbindungen, als später gebraucht werden', 960, 880, { color: C.glu, p: k2, size: 24 });
      const sb = S.win('stabilize', 'fade', 0.6, 0.5);
      if (sb > 0) badge(ctx, 'genutzt → stabilisiert', 960, 880, { color: C.glu, p: sb, size: 24 });
      const tg = S.win('tagged', 'mg', 0.6, 0.5);
      if (tg > 0) badge(ctx, 'wenig aktiv → markiert', 960, 880, { color: C.compl, p: tg, size: 24 });
      const np = S.win('normalp', 'research', 0.8, 0.6);
      if (np > 0) badge(ctx, 'normaler, wichtiger Teil der Gehirnentwicklung', 960, 880, { color: C.gaba, p: np, size: 24 });
      // Maßstab
      strokePath(ctx, [{ x: 1640, y: 850 }, { x: 1780, y: 850 }], C.textDim, mainA * 0.7, 3);
      text(ctx, '≈ 1 µm (schematisch)', 1710, 876, { size: 18, weight: 500, color: C.textDim, font: 'text', alpha: mainA * 0.8 });
    }
    // ---------------- Überschrift
    const cl = S.win('clean', 'term', 0.8, 0.5);
    if (cl > 0) statement(ctx, 'Das Gehirn räumt auf.', 170, cl, { size: 64 });
    const hd = S.on('term', 1.2, ease.out) * (1 - cmp);
    if (hd > 0) {
      text(ctx, 'Synaptisches Pruning', 960, 140, { size: 64, weight: 700, alpha: hd, reveal: hd, glow: 0.4 });
      const df = S.on('def', 1.2, ease.out);
      text(ctx, 'gezielter Umbau bzw. Entfernung bestimmter Verbindungen', 960, 200, { size: 28, weight: 500, color: C.textDim, font: 'text', alpha: hd * df, reveal: df });
    }
    // ---------------- Vergleich: typisch vs. Hypothese
    const pa = cmp * (1 - S.on('spines', 1.0));
    if (pa > 0) {
      heading(ctx, 'Forschungsfrage', 'Verändertes Pruning bei Schizophrenie?', pa, { color: C.warn });
      const keptA = [0, 1, 3, 4, 6, 7, 9, 10, 12, 14, 15, 17, 19];
      const keptB = [0, 3, 4, 7, 9, 12, 15, 17, 19];
      miniDendrite(ctx, 170, 560, 720, keptA, true, pa, t);
      miniDendrite(ctx, 1030, 560, 720, keptB, true, pa * S.on('hyp', 1.2), t);
      text(ctx, 'typischer Umbau', 530, 390, { size: 34, weight: 700, color: C.glu, alpha: pa });
      text(ctx, 'möglicherweise stärkerer Abbau?', 1390, 390, { size: 34, weight: 700, color: C.warn, alpha: pa * S.on('hyp', 1.0), reveal: S.on('hyp', 1.2) });
      badge(ctx, 'HYPOTHESE', 1390, 690, { color: C.warn, p: S.on('hyp', 0.8, ease.out, 0.8), alpha: pa, size: 24 });
      text(ctx, 'bei manchen Menschen · in bestimmten Regionen', 960, 780, { size: 26, weight: 500, color: C.textDim, font: 'text', alpha: pa * S.on('hyp', 1.0) });
    }
    // ---------------- Post-mortem-Befund
    const sp = S.on('spines', 1.2);
    if (sp > 0) {
      heading(ctx, 'Befund aus Gewebestudien', 'Weniger dendritische Dornen', sp * (1 - S.on('open', 1) * 0), { color: C.glu });
      const bars = [['Vergleichsgruppe', 1.0, C.neuron], ['Schizophrenie (Mittelwert)', 0.77, C.warn]];
      bars.forEach(([lab, v, col], i) => {
        const y = 380 + i * 130;
        const k = S.on('spines', 1.5, ease.out, 0.5 + i * 0.4);
        text(ctx, lab, 560, y, { size: 30, weight: 600, color: col, align: 'right', alpha: sp });
        ctx.save(); ctx.fillStyle = rgba(col, 0.85 * sp); roundRect(ctx, 600, y - 26, 900 * v * k, 52, 10); ctx.fill(); ctx.restore();
      });
      text(ctx, 'präfrontaler Kortex · Durchschnittswerte · z. B. Glantz & Lewis, 2000', 960, 600, { size: 22, weight: 500, color: C.textDim, font: 'text', alpha: sp });
      const s2 = S.on('spines2', 1.0);
      if (s2 > 0) {
        strokePath(ctx, [{ x: 700, y: 760 }, { x: 1220, y: 760 }], '#a9bdf2', sp * s2, 14);
        for (let i = 0; i < 8; i++) { const x = 730 + i * 66; strokePath(ctx, [{ x, y: 754 }, { x: x + 4, y: 712 }], '#a9bdf2', sp * s2, 5); dot(ctx, x + 4, 708, 8, C.glu, sp * s2); }
        callout(ctx, 734 + 66 * 3, 708, 1350, 690, 'Dorn = Kontaktstelle für Synapsen', { p: s2, color: C.glu, size: 28 });
      }
      const ca = S.on('caution', 1.0);
      if (ca > 0) badge(ctx, 'FORSCHUNGSMODELL – keine abschließende Erklärung', 960, 670, { color: C.warn, p: ca, size: 24, alpha: 1 });
      const op = S.on('open', 1.0);
      if (op > 0) ['Ursache?', 'Folge?', 'Teil eines größeren Geschehens?'].forEach((lab, i) => badge(ctx, lab, 520 + i * 440, 860, { color: C.text, p: S.on('open', 0.8, ease.out, i * 0.5), size: 26 }));
    }
  },
};
