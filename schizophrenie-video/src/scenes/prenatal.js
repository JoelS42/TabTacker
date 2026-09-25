// Szene 7 – Pränatale und perinatale Entwicklung
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, strokePath, glowPath, catmull, subPath, pointAt, fract, noise2, mixColor, smoothstep, ring } from '../animation.js';
import { icon, node, dotGrid } from './shared.js';

const BAND = { x0: 250, x1: 1670, top: 330, bot: 760 };
const R = rng(71);
const FIB = Array.from({ length: 20 }, (_, i) => {
  const x = lerp(BAND.x0 + 30, BAND.x1 - 30, i / 19);
  return catmull([{ x, y: BAND.bot + 8 }, { x: x + R.range(-12, 12), y: 560 }, { x: x + R.range(-20, 20), y: BAND.top - 10 }], 8);
});
const MIG = Array.from({ length: 48 }, (_, i) => ({ fib: i % 20, d: R(), ty: lerp(BAND.top + 190, BAND.top + 20, clamp((i / 48) + R.range(-0.12, 0.12))), dx: R.range(-22, 22), ph: R() * 10 }));
const FACT = [
  { cue: 'infect', label: 'Infektionen', kind: 'virus', color: '#ff9fb2' },
  { cue: 'immune', label: 'Immunaktivierung', kind: 'antibody', color: C.mg },
  { cue: 'nutrition', label: 'Mangelernährung', kind: 'nutrition', color: '#e8c47a' },
  { cue: 'mstress', label: 'starker Stress', kind: 'stress', color: C.stress },
  { cue: 'smoke', label: 'Rauchen', kind: 'smoke', color: '#b9bfd6' },
  { cue: 'hypoxia', label: 'Sauerstoffmangel', kind: 'o2', color: '#8fd3ff' },
  { cue: 'preterm', label: 'Frühgeburt', kind: 'clock', color: '#e8b8ff' },
].map((f, i) => ({ ...f, x: lerp(300, 1620, i / 6), y: 175 }));
const TARGET = { x: 960, y: 560 };
const SCHIZO = { x: 1500, y: 640 };

export default {
  id: 'prenatal',
  transition: { type: 'zoomIn', dur: 1.8, fromX: 960, fromY: 470 },
  sfx: [['low', 'womb', 0, 0.5], ['grow', 'migrate', 0, 0.4], ['click', 'synform', 0, 0.3], ['click', 'infect', 0, 0.3], ['click', 'immune', 0, 0.3], ['click', 'nutrition', 0, 0.3],
    ['click', 'mstress', 0, 0.3], ['click', 'smoke', 0, 0.3], ['click', 'hypoxia', 0, 0.3], ['click', 'preterm', 0, 0.3], ['whoosh', 'target', 0, 0.4], ['click', 'notdirect', 0.8, 0.5], ['swell', 'target2', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    heading(ctx, 'Einflüsse · 2', 'Vor und während der Geburt', tween(t, S.start, 1.2) * (1 - S.on('infect', 0.8)), { color: '#ff9fb2' });
    const bandA = tween(t, S.start - 0.3, 1.4) * lerp(1, 0.22, S.on('target', 1.2)) * (1 - S.on('partial', 1.0));
    // ---------------- Sich entwickelnder Kortex
    if (bandA > 0) {
      // Wellen durch Einflüsse
      const hits = FACT.map((f) => Math.max(0, t - S.cue(f.cue)));
      const disturb = (x, y) => {
        let d = 0;
        FACT.forEach((f, i) => { const tt = hits[i]; if (tt > 0 && tt < 3) { const r = tt * 420; const dd = Math.hypot(x - f.x, y - f.y); d += Math.exp(-((dd - r) ** 2) / 3000) * (1 - tt / 3) * 10; } });
        return d;
      };
      ctx.save();
      const g = ctx.createLinearGradient(0, BAND.top, 0, BAND.bot);
      g.addColorStop(0, rgba('#2a1d4d', 0.35 * bandA)); g.addColorStop(1, rgba('#12183a', 0.5 * bandA));
      ctx.fillStyle = g; ctx.fillRect(BAND.x0, BAND.top - 20, BAND.x1 - BAND.x0, BAND.bot - BAND.top + 40);
      ctx.restore();
      FIB.forEach((f) => {
        const pts = f.map((p) => ({ x: p.x + disturb(p.x, p.y), y: p.y }));
        strokePath(ctx, subPath(pts, 0, tween(t, S.start, 2.0)), '#7d86e0', bandA * 0.4, 1.6);
      });
      // Vorläuferzellen (teilen sich)
      for (let i = 0; i < 20; i++) {
        const x = lerp(BAND.x0 + 30, BAND.x1 - 30, i / 19), y = BAND.bot + 10;
        const ph = fract(t * 0.22 + i * 0.37);
        const split = smoothstep(0.55, 0.9, ph);
        const st = 1 + smoothstep(0.3, 0.55, ph) * 0.35 * (1 - split);
        for (const s of split > 0 ? [-1, 1] : [0]) {
          const cx = x + s * split * 13;
          ctx.save(); ctx.translate(cx, y); ctx.scale(st, 1 / st);
          dot(ctx, 0, 0, 11 * (split > 0 ? 0.8 : 1), '#b79cff', bandA * 0.75);
          ctx.restore();
        }
      }
      text(ctx, 'Vorläuferzellen', BAND.x0 + 10, BAND.bot + 50, { size: 20, weight: 600, color: '#b79cff', font: 'text', align: 'left', alpha: bandA * S.win('neurogen', 'infect', 0.8, 0.8) });
      text(ctx, 'Leitstrukturen (Radialglia)', BAND.x1 - 10, BAND.bot + 50, { size: 20, weight: 600, color: '#7d86e0', font: 'text', align: 'right', alpha: bandA * S.win('migrate', 'infect', 0.8, 0.8) });
      // wandernde Nervenzellen
      const mig0 = S.cue('migrate');
      MIG.forEach((m, i) => {
        const born = tween(t, S.cue('neurogen') + m.d * 2, 0.6);
        if (born <= 0) return;
        const f = tween(t, mig0 - 0.5 + m.d * 3.2, 3.2, ease.inOut);
        const fib = FIB[m.fib];
        const p = pointAt(fib, 1 - lerp(0, 1 - (m.ty - BAND.top + 10) / (BAND.bot - BAND.top + 20), f));
        const x = p.x + m.dx * f + disturb(p.x, p.y), y = lerp(BAND.bot - 20, m.ty, f);
        const moving = f > 0 && f < 1;
        if (moving) strokePath(ctx, [{ x, y }, { x: x + 2, y: y - 26 }], C.neuron, bandA * 0.8, 2.2);
        // Fortsätze nach Ankunft
        const pr = tween(t, S.cue('processes') + m.d * 1.2, 1.4, ease.out) * (f >= 1 ? 1 : 0);
        if (pr > 0) {
          for (let k = 0; k < 4; k++) {
            const an = m.ph + k * 1.6, L = 20 * pr;
            strokePath(ctx, [{ x, y }, { x: x + Math.cos(an) * L, y: y + Math.sin(an) * L * 0.8 }], C.neuron, bandA * 0.6, 1.5);
          }
        }
        ctx.save(); ctx.translate(x, y); ctx.scale(1, moving ? 1.35 : 1);
        dot(ctx, 0, 0, 7 * born, C.neuron, bandA * 0.95);
        ctx.restore();
        glow(ctx, x, y, 20, C.neuron, 0.2 * bandA);
      });
      // erste Verbindungen
      const sf = S.on('synform', 1.5);
      if (sf > 0) {
        for (let i = 0; i < MIG.length - 1; i += 1) {
          const a = MIG[i], b = MIG[(i + 7) % MIG.length];
          const pa = pointAt(FIB[a.fib], 1 - (1 - (a.ty - BAND.top + 10) / (BAND.bot - BAND.top + 20)));
          const pb = pointAt(FIB[b.fib], 1 - (1 - (b.ty - BAND.top + 10) / (BAND.bot - BAND.top + 20)));
          const A = { x: pa.x + a.dx, y: a.ty }, B = { x: pb.x + b.dx, y: b.ty };
          if (Math.abs(A.x - B.x) > 260) continue;
          strokePath(ctx, subPath([A, B], 0, clamp(sf * 1.4 - (i % 5) * 0.08)), C.glu, bandA * 0.35, 1.2);
          const q = { x: lerp(A.x, B.x, 0.5), y: lerp(A.y, B.y, 0.5) };
          glow(ctx, q.x, q.y, 10, C.glu, 0.6 * bandA * sf * (0.5 + 0.5 * Math.sin(t * 3 + i)));
        }
      }
      const fi = S.win('fine', 'infect', 0.8, 0.8);
      if (fi > 0) text(ctx, 'ein fein abgestimmter Prozess', 960, 250, { size: 36, weight: 700, alpha: fi, reveal: fi });
    }
    // ---------------- Einflussfaktoren
    const fa = S.on('infect', 0.6) * (1 - S.on('partial', 1.0));
    if (fa > 0) {
      text(ctx, 'untersuchte Einflüsse', 960, 80, { size: 22, weight: 600, color: C.textDim, font: 'text', spacing: 3, alpha: fa });
      const bi = S.on('birth', 0.8);
      if (bi > 0) {
        strokePath(ctx, [{ x: FACT[5].x - 90, y: 262 }, { x: FACT[6].x + 90, y: 262 }], '#8fd3ff', 0.5 * bi * fa, 2);
        text(ctx, 'rund um die Geburt', (FACT[5].x + FACT[6].x) / 2, 290, { size: 22, weight: 600, color: '#8fd3ff', font: 'text', alpha: bi * fa });
      }
      const ta = S.on('target', 1.2), t2 = S.on('target2', 1.8, ease.inOut), nd = S.on('notdirect', 0.8);
      FACT.forEach((f, i) => {
        const p = S.on(f.cue, 0.7, ease.outBack);
        if (p <= 0) return;
        glow(ctx, f.x, f.y, 70, f.color, 0.25 * p * fa);
        icon(ctx, f.kind, f.x, f.y, 62 * p, f.color, fa, t);
        text(ctx, f.label, f.x, f.y + 58, { size: 22, weight: 600, color: f.color, font: 'text', alpha: fa, reveal: S.on(f.cue, 0.8) });
        if (ta > 0) {
          const end = { x: lerp(SCHIZO.x, TARGET.x, t2), y: lerp(SCHIZO.y, TARGET.y, t2) };
          const pts = catmull([{ x: f.x, y: f.y + 80 }, { x: lerp(f.x, end.x, 0.5), y: lerp(f.y + 80, end.y, 0.4) + 40 }, end], 10);
          const col = mixColor('#9aa9c7', f.color, t2);
          ctx.save();
          if (t2 < 0.5) ctx.setLineDash([8, 8]);
          strokePath(ctx, subPath(pts, 0, ta), col, fa * lerp(0.45, 0.7, t2) * (1 - nd * 0.5 * (1 - t2)), 1.8);
          ctx.restore();
          if (t2 > 0.3) glow(ctx, pointAt(pts, fract(t * 0.3 + i * 0.14)).x, pointAt(pts, fract(t * 0.3 + i * 0.14)).y, 10, f.color, fa * t2 * 0.8);
        }
      });
      if (ta > 0) {
        const sa = ta * (1 - t2 * 0.35);
        node(ctx, SCHIZO.x, SCHIZO.y, 18, C.textDim, 'Schizophrenie', ta, { alpha: sa * fa, labelPos: 'below', size: 28, labelColor: C.textDim });
        if (nd > 0) {
          strokePath(ctx, [{ x: SCHIZO.x - 110, y: SCHIZO.y + 60 }, { x: lerp(SCHIZO.x - 110, SCHIZO.x + 110, nd), y: SCHIZO.y + 20 }], C.stress, fa * nd, 4);
          text(ctx, 'nicht direkt', SCHIZO.x, SCHIZO.y + 90, { size: 26, weight: 700, color: C.stress, alpha: fa * nd, reveal: nd });
        }
        if (t2 > 0) {
          node(ctx, TARGET.x, TARGET.y, 26, C.glu, null, t2, { alpha: fa, glow: 0.6, fill: 0.6 });
          text(ctx, 'mögliche Veränderungen der', TARGET.x, TARGET.y + 62, { size: 30, weight: 700, color: C.glu, alpha: fa, reveal: t2 });
          text(ctx, 'neurobiologischen Entwicklung', TARGET.x, TARGET.y + 100, { size: 30, weight: 700, color: C.glu, alpha: fa, reveal: S.on('target2', 1.8, ease.out, 0.4) });
        }
      }
    }
    // ---------------- Nur ein Teil des Risikos
    const pa = S.on('partial', 1.2);
    if (pa > 0) {
      const cx = 620, cy = 500, r = 190;
      const n = 36;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i / n) * TAU + 0.02, a1 = a0 + TAU / n - 0.04;
        const lit = i < 5;
        const k = clamp(pa * 1.6 - i / n * 0.6);
        ctx.strokeStyle = rgba(lit ? '#ff9fb2' : '#4d6aa8', (lit ? 0.95 : 0.45) * k);
        ctx.lineWidth = 34;
        ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
      }
      text(ctx, 'Gesamtrisiko', cx, cy - 10, { size: 30, weight: 700, alpha: pa });
      text(ctx, '(viele Faktoren)', cx, cy + 28, { size: 22, weight: 500, color: C.textDim, font: 'text', alpha: pa });
      text(ctx, 'vor / während der Geburt: nur ein Teil', cx, cy + r + 70, { size: 28, weight: 700, color: '#ff9fb2', alpha: pa, reveal: pa });
      text(ctx, 'schematisch', cx, cy + r + 106, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: pa * 0.8 });
      const mo = S.on('most', 1.2);
      if (mo > 0) {
        dotGrid(ctx, 1330, 470, 10, 10, 40, { alpha: mo, reveal: mo, r: 11, color: '#6f8fd6', hlColor: C.warn, highlight: (i) => (i === 57 ? mo : 0) });
        text(ctx, 'die allermeisten Kinder', 1330, 720, { size: 32, weight: 700, color: C.gaba, alpha: mo, reveal: mo });
        text(ctx, 'entwickeln keine Schizophrenie', 1330, 762, { size: 32, weight: 700, color: C.gaba, alpha: mo, reveal: S.on('most', 1.2, ease.out, 0.4) });
      }
    }
  },
};
