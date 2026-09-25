// Szene 16 – Netzwerk-Synthese: alle Systeme als zusammenhängendes Netzwerk
import { W, H, C, TAU, clamp, lerp, ease, tween, glow, spark, dot, text, rgba, heading, statement, badge, strokePath, glowPath, catmull, fract, subPath, pointAt, noise2 } from '../animation.js';
import { flow } from './shared.js';

const NODES = [
  { label: 'GENETIK', color: C.gen, cue: 's1', x: 250, y: 300 },
  { label: 'ENTWICKLUNG', color: C.myelin, cue: 's2', x: 610, y: 250 },
  { label: 'PRUNING', color: '#9fb6ff', cue: 's3', x: 960, y: 300 },
  { label: 'MIKROGLIA', color: C.mg, cue: 's4', x: 1310, y: 250 },
  { label: 'GLUTAMAT', color: C.glu, cue: 's5', x: 1670, y: 330 },
  { label: 'NMDA', color: '#6fb0ff', cue: 's5', off: 0.7, x: 1560, y: 620 },
  { label: 'GABA', color: C.gaba, cue: 's6', x: 1180, y: 680 },
  { label: 'DOPAMIN', color: C.da, cue: 's7', x: 780, y: 640 },
  { label: 'NETZWERKAKTIVITÄT', color: C.text, cue: 's8', x: 380, y: 680 },
];
const CROSS = [[0, 3], [0, 4], [1, 8], [2, 6], [3, 7], [4, 7], [6, 8], [0, 6], [5, 7]];
const ALT = [[0, 1, 2, 3, 8], [0, 4, 5, 6, 8], [1, 2, 7, 8]];

export default {
  id: 'synthesis',
  transition: { type: 'fade', dur: 1.8 },
  sfx: [['swell', 'all', 0, 0.5], ['click', 's1', 0, 0.3], ['click', 's2', 0, 0.3], ['click', 's3', 0, 0.3], ['click', 's4', 0, 0.3], ['click', 's5', 0, 0.3], ['click', 's6', 0, 0.3], ['click', 's7', 0, 0.3], ['click', 's8', 0, 0.3], ['boom', 'system', 0, 0.6]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.4, 1.2);
    heading(ctx, 'Zusammenhang', 'Ein zusammenhängendes System', S.on('all', 1.2, ease.out), { color: C.text });
    const sys = S.on('system', 1.5);
    const alt = S.on('indiv', 1.0);
    const altIdx = Math.floor(Math.max(0, t - S.cue('indiv')) / 1.5) % ALT.length;
    const inAlt = (i) => (alt > 0 ? (ALT[altIdx].includes(i) ? 1 : 0.2) : 1);
    const beat = sys * Math.max(0, Math.sin(t * 2.6)) ** 6;
    // Hauptkette
    for (let i = 0; i < NODES.length - 1; i++) {
      const a = NODES[i], b = NODES[i + 1];
      const k = S.on(b.cue, 1.2, ease.inOut, (b.off ?? 0) - 0.6);
      if (k <= 0) continue;
      const pts = catmull([a, { x: (a.x + b.x) / 2 + noise2(i, t * 0.2) * 30, y: (a.y + b.y) / 2 - 40 + noise2(i + 3, t * 0.2) * 20 }, b], 10);
      const al = A * Math.min(inAlt(i), inAlt(i + 1));
      glowPath(ctx, subPath(pts, 0, k), a.color, 0.7 * al, 2.5, 10);
      if (k >= 1) flow(ctx, pts, t, { n: 5, speed: 0.35 + sys * 0.3, color: a.color, r: 3, alpha: al });
    }
    // Querverbindungen: alles hängt zusammen
    if (sys > 0) {
      CROSS.forEach(([i, j], n) => {
        const a = NODES[i], b = NODES[j];
        const pts = catmull([a, { x: (a.x + b.x) / 2 + noise2(n, t * 0.3) * 60, y: (a.y + b.y) / 2 + noise2(n + 5, t * 0.3) * 60 }, b], 10);
        strokePath(ctx, subPath(pts, 0, sys), '#9fb3e6', 0.3 * sys * A * Math.min(inAlt(i), inAlt(j)), 1.4);
        flow(ctx, pts, t, { n: 3, speed: 0.25, color: '#cfd8f5', r: 2, alpha: 0.6 * sys * A * Math.min(inAlt(i), inAlt(j)) });
      });
    }
    NODES.forEach((n, i) => {
      const p = S.on(n.cue, 0.8, ease.outBack, n.off ?? 0);
      if (p <= 0) return;
      const al = A * inAlt(i);
      const r = 30 * p * (1 + beat * 0.15);
      glow(ctx, n.x, n.y, 110 * p * (1 + beat * 0.4), n.color, (0.3 + beat * 0.4) * al);
      ctx.save(); ctx.fillStyle = rgba('#060b18', 0.85 * al); ctx.strokeStyle = rgba(n.color, al); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      dot(ctx, n.x, n.y, r * 0.4, n.color, al);
      text(ctx, n.label, n.x, n.y + (n.y < 450 ? -56 : 60), { size: 26, weight: 700, color: n.color, spacing: 3, alpha: al, reveal: p });
    });
    const sy = S.on('system', 1.2, ease.out);
    if (sy > 0) statement(ctx, 'ein zusammenhängendes System', 470, sy * (1 - S.on('simpl', 0.6)), { size: 46, alpha: 1 - S.on('simpl', 0.6) });
    const si = S.on('simpl', 1.0);
    if (si > 0) badge(ctx, 'vereinfachtes Modell aus mehreren Hypothesen', 960, 470, { color: C.warn, p: si, size: 26 });
    if (alt > 0) badge(ctx, 'bei verschiedenen Menschen: unterschiedliche Teile', 960, 860, { color: C.text, p: alt, size: 26 });
  },
};
