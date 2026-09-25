// Szene 8 – Akt III: Adoleszenz – der große Umbau
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, strokePath, glowPath, fillPath, catmull, fract, noise2, drawBrain, mixColor, smoothstep, roundRect, samplesInBrain, pointInPoly, brainOutline } from '../animation.js';

// 3D-Punktwolke für den Flug durch das Netzwerk
const R = rng(81);
const P3 = Array.from({ length: 420 }, () => ({ x: R.range(-1500, 1500), y: R.range(-900, 900), z: R.range(0, 3200), ph: R() }));
const E3 = [];
P3.forEach((a, i) => {
  const near = P3.map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + ((a.z - b.z) * 0.6) ** 2 })).filter((o) => o.j !== i).sort((u, v) => u.d - v.d).slice(0, 2);
  for (const n of near) if (i < n.j) E3.push([i, n.j, R(), R()]);
});
// Umbau: alte und neue Positionen (2D) im Gehirnumriss
const NB = 260;
const OLD = samplesInBrain(NB, 83, 20);
const NEW = Array.from({ length: NB }, (_, i) => {
  const lane = i % 9, k = Math.floor(i / 9) / (NB / 9);
  const y = lerp(-300, 150, lane / 8) + Math.sin(k * 6 + lane) * 18;
  const p = { x: lerp(-400, 420, k), y };
  return pointInPoly(p, brainOutline) ? p : { x: p.x * 0.82, y: p.y * 0.8 - 20 };
});

function project(p, camZ) {
  let z = p.z - camZ;
  z = ((z % 3200) + 3200) % 3200;
  const f = 700 / (z + 60);
  return { x: W / 2 + p.x * f, y: H / 2 + p.y * f, s: f, z };
}

export default {
  id: 'adolescence',
  transition: { type: 'zoomIn', dur: 1.8, fromX: 960, fromY: 500 },
  sfx: [['whoosh', 'jump', 0, 0.8], ['boom', 'adol', 0, 0.7], ['click', 'sort', 0, 0.3], ['wrap', 'myelin', 0, 0.3], ['swell', 'big', 0, 0.6], ['boom', 'boom', -0.05, 1.0], ['dissolve', 'boom', 0.1, 0.8], ['chime', 'normal', 0, 0.3], ['whoosh', 'q', 1.5, 0.5]],
  draw(ctx, S) {
    const t = S.t;
    // ---------------- Flug durch das Netzwerk
    const flyA = tween(t, S.start - 0.8, 1.2) * (1 - S.on('big', 1.2));
    if (flyA > 0) {
      const speed = lerp(900, 160, S.on('rebuild', 3));
      const camZ = (t - S.start) * speed + Math.max(0, t - S.start) * 0 + 20 * Math.sin(t);
      const PP = P3.map((p) => project(p, camZ));
      const rewire = S.on('sort', 2.5);
      const my = S.on('myelin', 2.0), eff = S.on('eff', 2.0);
      ctx.lineCap = 'round';
      for (const [i, j, r1, r2] of E3) {
        const a = PP[i], b = PP[(r1 < 0.5 * rewire ? (j + 17) % P3.length : j)];
        if (Math.abs(a.z - b.z) > 900) continue;
        const depth = clamp(1 - Math.min(a.z, b.z) / 3200);
        const near = smoothstep(0, 180, Math.min(a.z, b.z));
        const al = flyA * depth * depth * near;
        if (al < 0.01) continue;
        if (a.s > 1.6 || b.s > 1.6) continue;
        const w = Math.max(0.5, Math.min(5, (a.s + b.s) * 1.3));
        ctx.strokeStyle = rgba('#7f9ee0', al * 0.55);
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (my > 0 && r2 < 0.45) { ctx.strokeStyle = rgba(C.myelin, al * my * 0.6); ctx.lineWidth = w * 3; ctx.setLineDash([w * 8, w * 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
        if (eff > 0 && r2 < 0.6) { const f = fract(t * 0.8 + r1); glow(ctx, lerp(a.x, b.x, f), lerp(a.y, b.y, f), 6 + w * 3, C.glu, al * eff); }
      }
      for (const p of PP) {
        const depth = clamp(1 - p.z / 3200), near = smoothstep(0, 180, p.z);
        const al = flyA * depth * near;
        if (al < 0.01) continue;
        dot(ctx, p.x, p.y, Math.max(0.8, p.s * 5), C.neuron, al);
        if (p.s > 0.6) glow(ctx, p.x, p.y, p.s * 30, C.neuron, al * 0.3);
      }
      // Alterszähler
      const age = Math.min(17, 11 + Math.floor(Math.max(0, t - S.cue('jump')) * 1.6));
      const ja = S.win('jump', 'puberty', 0.5, 0.8);
      if (ja > 0) text(ctx, `${age} Jahre`, W - 140, 110, { size: 40, weight: 700, color: C.mg, align: 'right', alpha: ja });
      const ad = S.win('adol', 'rebuild', 1.0, 1.0);
      if (ad > 0) text(ctx, 'ADOLESZENZ', W / 2, H / 2 - 20, { size: 110, weight: 700, spacing: 22, color: C.text, alpha: ad, reveal: S.on('adol', 1.2, ease.out), glow: 0.8 });
      const pu = S.win('puberty', 'rebuild', 0.8, 0.8);
      if (pu > 0) text(ctx, 'Pubertät: Körper und Gehirn verändern sich', W / 2, H / 2 + 70, { size: 34, weight: 600, color: C.mg, alpha: pu, reveal: pu });
      const chips = [['Synapsen werden neu sortiert', 'sort', C.glu], ['Myelin nimmt zu', 'myelin', C.myelin], ['Netzwerke werden effizienter', 'eff', C.neuron]];
      chips.forEach(([lab, cue, col], i) => { const p = S.win(cue, 'big', 0.6, 0.6); if (p > 0) badge(ctx, lab, 480 + i * 480, 820, { color: col, p, size: 26 }); });
      const rb = S.win('rebuild', 'sort', 0.8, 0.6);
      if (rb > 0) statement(ctx, 'eine der größten Umbauphasen', 170, rb, { size: 52, color: C.mg });
    }
    // ---------------- Nicht größer – umgebaut
    const bA = S.on('big', 1.2) * (1 - S.on('grey', 1.2));
    if (bA > 0) {
      const grow = S.on('big', 2.0, ease.inOut) * (1 - S.on('boom', 0.5));
      const sc = 0.62 * (1 + grow * 0.08);
      ctx.save(); ctx.translate(960, 500); ctx.scale(sc, sc);
      drawBrain(ctx, { alpha: bA * 0.9, gyri: 0.35, fill: 0.35 });
      if (grow > 0) { ctx.save(); ctx.setLineDash([12, 10]); ctx.scale(1 + grow * 0.1, 1 + grow * 0.1); drawBrain(ctx, { alpha: bA * 0.4 * grow, gyri: 0, fill: 0, cerebellum: false }); ctx.restore(); }
      // Knoten: alt → Explosion → neu
      const bm = S.on('boom', 2.2, ease.inOut);
      const burst = Math.sin(Math.PI * bm);
      const flash = Math.exp(-Math.max(0, t - S.cue('boom')) * 2.5) * (t > S.cue('boom') ? 1 : 0);
      for (let i = 0; i < NB; i++) {
        const a = OLD[i], b = NEW[i];
        const ang = (i * 2.399) % TAU;
        const x = lerp(a.x, b.x, bm) + Math.cos(ang) * burst * 220 * (0.5 + (i % 7) / 7);
        const y = lerp(a.y, b.y, bm) + Math.sin(ang) * burst * 160 * (0.5 + (i % 5) / 5);
        const col = mixColor(C.neuron, C.glu, bm);
        spark(ctx, x, y, 4, col, bA * (0.8 + flash * 0.5));
        if (bm > 0.85 && i % 9 !== 8) { const n = NEW[i + 1]; if (n) strokePath(ctx, [{ x, y }, { x: n.x, y: n.y }], C.glu, bA * (bm - 0.85) * 4 * 0.35, 2); }
        if (bm < 0.1 && i % 3 === 0) { const n = OLD[(i * 7 + 3) % NB]; strokePath(ctx, [a, n], '#7f9ee0', bA * 0.18 * (1 - bm * 10), 1.4); }
      }
      glow(ctx, 0, -60, 700 * flash, '#ffffff', 0.5 * flash);
      ctx.restore();
      statement(ctx, 'Das Gehirn wird nicht einfach größer.', 150, S.on('big', 1.2, ease.out), { size: 50, alpha: 1 - S.on('boom', 0.4) });
      const bo = S.on('boom', 0.5, ease.out);
      if (bo > 0) statement(ctx, 'Es wird umgebaut.', 880, bo, { size: 84, glow: 0.8 });
    }
    // ---------------- Graue und weiße Substanz
    const gA = S.on('grey', 1.2) * (1 - S.on('q', 1.5) * 0.7);
    if (gA > 0) {
      const k = tween(t, S.cue('grey') + 0.8, 6.5, ease.inOut);
      const cx = 960, cy = 480, rx = 420, ry = 300;
      const thick = lerp(78, 58, k);
      const wm = lerp(0.55, 1, k);
      // Hirnrinde (graue Substanz) – gewellter Ring
      const outer = [], inner = [];
      for (let i = 0; i <= 160; i++) {
        const a = (i / 160) * TAU;
        const wav = Math.sin(a * 14) * 16 + Math.sin(a * 23 + 1) * 8;
        const r1 = 1 + wav / rx;
        outer.push({ x: cx + Math.cos(a) * rx * r1, y: cy + Math.sin(a) * ry * r1 });
        inner.push({ x: cx + Math.cos(a) * (rx - thick) * r1, y: cy + Math.sin(a) * (ry - thick * 0.8) * r1 });
      }
      ctx.save();
      ctx.beginPath();
      outer.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      inner.slice().reverse().forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = rgba('#7b88b8', 0.55 * gA); ctx.fill('evenodd');
      ctx.restore();
      strokePath(ctx, outer, '#aab6e0', gA * 0.8, 2, true);
      // weiße Substanz – geschwungene Faserbündel (Corona radiata)
      ctx.save();
      const wg = ctx.createRadialGradient(cx, cy, 20, cx, cy, (rx - thick) * wm);
      wg.addColorStop(0, rgba(C.myelin, 0.28 * gA)); wg.addColorStop(1, rgba(C.myelin, 0.04 * gA));
      ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(cx, cy, (rx - thick - 6) * wm, (ry - thick * 0.8 - 6) * wm, 0, 0, TAU); ctx.fill();
      ctx.restore();
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * TAU + Math.sin(i * 1.7) * 0.05;
        const L = (rx - thick - 12) * wm;
        const bend = Math.sin(i * 2.3) * 0.35;
        const p0 = { x: cx + Math.cos(a + bend) * 70, y: cy + Math.sin(a + bend) * 48 };
        const pm = { x: cx + Math.cos(a + bend * 0.4) * L * 0.55, y: cy + Math.sin(a + bend * 0.4) * L * 0.55 * (ry / rx) };
        const p1 = { x: cx + Math.cos(a) * L, y: cy + Math.sin(a) * L * (ry / rx) };
        strokePath(ctx, catmull([p0, pm, p1], 6), C.myelin, gA * 0.32 * wm, 2);
      }
      glow(ctx, cx, cy, 200 * wm, C.myelin, 0.1 * gA);
      const age = Math.round(lerp(12, 20, k));
      text(ctx, `${age} Jahre`, cx, cy, { size: 40, weight: 700, color: C.text, alpha: gA });
      text(ctx, 'graue Substanz (Hirnrinde): dünner', 330, 250, { size: 30, weight: 700, color: '#aab6e0', align: 'left', alpha: gA, reveal: S.on('grey', 1.2, ease.out, 0.4) });
      const wh = S.on('white', 1.2);
      if (wh > 0) text(ctx, 'weiße Substanz (Leitungsbahnen): mehr', 1590, 820, { size: 30, weight: 700, color: C.myelin, align: 'right', alpha: gA, reveal: wh });
      text(ctx, 'schematischer Schnitt', cx, cy + ry + 70, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: gA * 0.8 });
      const nm = S.win('normal', 'q', 0.8, 0.8);
      if (nm > 0) badge(ctx, 'ein ganz normaler Reifungsprozess', 960, 160, { color: C.gaba, p: nm, size: 26 });
    }
    const q = S.on('q', 1.0, ease.out);
    if (q > 0) {
      statement(ctx, 'Was passiert an den Synapsen?', 160, q, { size: 56 });
      glow(ctx, 960 + 380, 480, 60 + 40 * Math.sin(t * 4), C.glu, 0.6 * q);
    }
  },
};
