// =====================================================================
//  shared.js – wiederverwendbare biologische Systeme
//  Netzwerk, Mikroglia, DNA, Chromosom, Membran, Rezeptoren, Moleküle,
//  Personen-Piktogramme, Knoten, Partikelströme, Linien-Icons
// =====================================================================
import {
  W, H, TAU, C, clamp, lerp, ease, rng, noise2, fract, rgba, glow, spark, dot, ring, catmull, pointAt, subPath,
  strokePath, fillPath, glowPath, taper, blobPts, text, pointInPoly, brainOutline, samplesInBrain, smoothstep, mixColor, roundRect,
} from '../animation.js';

// ------------------------------------------------------------ Netzwerk
/**
 * Netzwerk aus Knoten und gebogenen Kanten.
 * o.points: vorgegebene Punkte | o.n + o.rect / o.circle / o.brain
 */
export function makeNetwork(seed, o = {}) {
  const R = rng(seed);
  let pts = o.points;
  if (!pts) {
    pts = [];
    let tries = 0;
    const minD = o.minD ?? 30;
    while (pts.length < o.n && tries < o.n * 80) {
      tries++;
      let p;
      if (o.brain) p = { x: R.range(-490, 500), y: R.range(-395, 230) };
      else if (o.circle) { const a = R() * TAU, r = Math.sqrt(R()) * o.circle.r; p = { x: o.circle.x + Math.cos(a) * r, y: o.circle.y + Math.sin(a) * r }; }
      else p = { x: o.rect.x + R() * o.rect.w, y: o.rect.y + R() * o.rect.h };
      if (o.brain && !pointInPoly(p, brainOutline)) continue;
      if (o.exclude && Math.hypot(p.x - o.exclude.x, p.y - o.exclude.y) < o.exclude.r) continue;
      let ok = true;
      for (const q of pts) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < minD * minD) { ok = false; break; }
      if (ok) pts.push(p);
    }
  }
  const nodes = pts.map((p, i) => ({ x: p.x, y: p.y, i, ph: R() * 10, r: R.range(0.7, 1.3), role: R() < (o.inhib ?? 0) ? 'inh' : 'exc' }));
  const edges = [];
  const k = o.k ?? 3;
  const seen = new Set();
  for (const a of nodes) {
    const near = nodes.filter((b) => b !== a).map((b) => ({ b, d: (b.x - a.x) ** 2 + (b.y - a.y) ** 2 })).sort((u, v) => u.d - v.d).slice(0, k);
    for (const { b } of near) {
      const key = a.i < b.i ? `${a.i}-${b.i}` : `${b.i}-${a.i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
      const bend = R.range(-0.25, 0.25) * L;
      edges.push({ a, b, cx: mx - (dy / L) * bend, cy: my + (dx / L) * bend, rank: R(), ph: R(), sp: R.range(0.25, 0.6), L });
    }
  }
  // Stärke: stabile Verbindungen = niedriger Rang
  return { nodes, edges, seed };
}

function qpt(e, f) {
  const u = 1 - f;
  return { x: u * u * e.a.x + 2 * u * f * e.cx + f * f * e.b.x, y: u * u * e.a.y + 2 * u * f * e.cy + f * f * e.b.y };
}
export { qpt as edgePoint };

/**
 * o: t, alpha, zoom (für konstante Pixelbreiten), color, edgeColor, nodeR (px), lw (px),
 *    density (0..1 sichtbare Kanten nach Rang), strong (0..1 Verstärkung starker Kanten),
 *    pulses (0..1), pulseColor, grow (0..1 Kanten-Wachstum), reveal:{x,y,r} (Knoten erscheinen radial),
 *    myelin (0..1), nodeAlpha, wobble
 */
export function drawNetwork(ctx, net, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const z = o.zoom ?? 1, t = o.t ?? 0;
  const col = o.color ?? C.neuron, ecol = o.edgeColor ?? col;
  const lw = (o.lw ?? 1.2) / z, nr = (o.nodeR ?? 3) / z;
  const dens = o.density ?? 1, strong = o.strong ?? 0, grow = o.grow ?? 1;
  const rv = o.reveal;
  const vis = (n) => (rv ? clamp((rv.r - Math.hypot(n.x - rv.x, n.y - rv.y)) / (rv.soft ?? 60)) : 1);
  const wob = o.wobble ?? 0;
  ctx.lineCap = 'round';
  for (const e of net.edges) {
    const va = Math.min(vis(e.a), vis(e.b));
    if (va <= 0) continue;
    const dk = clamp((dens - e.rank) / 0.06 + 0.5);
    if (dk <= 0) continue;
    const isStrong = e.rank < 0.35;
    const w = lw * (1 + (isStrong ? strong * 1.6 : -strong * 0.3));
    const ea = a * va * dk * (isStrong ? 0.55 + strong * 0.4 : 0.42 - strong * 0.12);
    let cx = e.cx, cy = e.cy;
    if (o.straighten) { cx = lerp(cx, (e.a.x + e.b.x) / 2, o.straighten * 0.85); cy = lerp(cy, (e.a.y + e.b.y) / 2, o.straighten * 0.85); }
    if (wob) { cx += noise2(e.ph * 10, t * 0.3) * wob * e.L; cy += noise2(e.ph * 10 + 5, t * 0.3) * wob * e.L; }
    ctx.strokeStyle = rgba(ecol, ea);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(e.a.x, e.a.y);
    if (grow >= 1) ctx.quadraticCurveTo(cx, cy, e.b.x, e.b.y);
    else {
      const g = clamp(grow * 1.4 - e.ph * 0.4);
      for (let s = 1; s <= 8; s++) { const p = qpt({ ...e, cx, cy }, (s / 8) * g); ctx.lineTo(p.x, p.y); }
    }
    ctx.stroke();
    if (o.myelin && isStrong) {
      ctx.strokeStyle = rgba(C.myelin, ea * o.myelin * 0.9);
      ctx.lineWidth = w * 3.2;
      ctx.setLineDash([e.L * 0.12, e.L * 0.03]);
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.quadraticCurveTo(cx, cy, e.b.x, e.b.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (o.pulses && dk > 0.5) {
      const f = fract(t * e.sp * (o.pulseSpeed ?? 1) + e.ph);
      if (f < 0.9 && (e.ph * 7) % 1 < o.pulses) {
        const p = qpt({ ...e, cx, cy }, f / 0.9);
        glow(ctx, p.x, p.y, 7 / z, o.pulseColor ?? C.glu, ea * 1.4);
      }
    }
  }
  const na = a * (o.nodeAlpha ?? 1);
  for (const n of net.nodes) {
    const va = vis(n);
    if (va <= 0) continue;
    const pr = nr * n.r * (0.9 + 0.1 * Math.sin(t * 2 + n.ph));
    const c = n.role === 'inh' && o.inhColor ? o.inhColor : col;
    dot(ctx, n.x, n.y, pr, c, na * va * 0.95);
    if (o.glyph) {
      ctx.strokeStyle = rgba(c, na * va * 0.5); ctx.lineWidth = lw * 0.8;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const an = n.ph * 3 + k * 1.7, L = pr * (2.2 + (k % 2));
        ctx.moveTo(n.x, n.y); ctx.lineTo(n.x + Math.cos(an) * L, n.y + Math.sin(an) * L);
      }
      ctx.stroke();
    }
    if (o.nodeGlow) glow(ctx, n.x, n.y, pr * 5, c, na * va * o.nodeGlow);
  }
}

// ------------------------------------------------------------ Mikroglia
export function makeMicroglia(seed, o = {}) {
  const R = rng(seed);
  const procs = [];
  const n = o.n ?? 9;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + R.range(-0.3, 0.3);
    const len = R.range(80, 150) * (o.size ?? 1);
    const kids = [];
    for (let k = 0; k < R.int(1, 3); k++) kids.push({ f: R.range(0.35, 0.85), da: R.range(-0.9, 0.9), len: len * R.range(0.3, 0.55), ph: R() * 10 });
    procs.push({ ang, len, kids, ph: R() * 10, sp: R.range(0.3, 0.7) });
  }
  return { procs, seed, size: o.size ?? 1 };
}

/**
 * o: x, y, t, alpha, reach (0..1 Fortsätze ausgefahren), target {x,y,k} (ein Fortsatz greift),
 *    engulf (0..1: Umschließen), color
 */
export function drawMicroglia(ctx, M, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const x = o.x ?? 0, y = o.y ?? 0, t = o.t ?? 0, reach = o.reach ?? 1, col = o.color ?? C.mg, s = M.size * (o.scale ?? 1);
  const body = catmull(blobPts(x, y, 30 * s, M.seed, t * 0.6, 0.22, 14), 4, true);
  // Fortsätze
  const tipPts = [];
  M.procs.forEach((p, i) => {
    let ang = p.ang + noise2(p.ph, t * 0.25) * 0.5;
    let len = p.len * s * reach * (0.75 + 0.25 * noise2(p.ph + 3, t * p.sp));
    let tx = x + Math.cos(ang) * len, ty = y + Math.sin(ang) * len;
    if (o.target && i === (o.targetProc ?? 0)) {
      const k = clamp(o.target.k ?? 0);
      tx = lerp(tx, o.target.x, ease.inOut(k)); ty = lerp(ty, o.target.y, ease.inOut(k));
      ang = Math.atan2(ty - y, tx - x); len = Math.hypot(tx - x, ty - y);
    }
    const mid = { x: x + Math.cos(ang + 0.15 * Math.sin(t + p.ph)) * len * 0.5, y: y + Math.sin(ang + 0.15 * Math.sin(t + p.ph)) * len * 0.5 };
    const pts = catmull([{ x: x + Math.cos(ang) * 20 * s, y: y + Math.sin(ang) * 20 * s }, mid, { x: tx, y: ty }], 6);
    taper(ctx, pts, 11 * s, 2.2 * s, col, a * 0.85);
    tipPts.push({ x: tx, y: ty });
    for (const kd of p.kids) {
      const bp = pointAt(pts, kd.f);
      const ka = ang + kd.da + noise2(kd.ph, t * 0.3) * 0.4;
      const kl = kd.len * s * reach * (0.7 + 0.3 * noise2(kd.ph + 2, t * 0.4));
      const kp = catmull([bp, { x: bp.x + Math.cos(ka) * kl * 0.55, y: bp.y + Math.sin(ka) * kl * 0.55 + Math.sin(t + kd.ph) * 3 }, { x: bp.x + Math.cos(ka) * kl, y: bp.y + Math.sin(ka) * kl }], 5);
      taper(ctx, kp, 4.5 * s, 1.2 * s, col, a * 0.75);
      dot(ctx, kp[kp.length - 1].x, kp[kp.length - 1].y, 2.2 * s, col, a * 0.9);
    }
  });
  ctx.save();
  const g = ctx.createRadialGradient(x - 8 * s, y - 10 * s, 2, x, y, 42 * s);
  g.addColorStop(0, rgba('#fff3e0', a));
  g.addColorStop(0.35, rgba(col, a * 0.95));
  g.addColorStop(1, rgba(mixColor(col, '#7a2e00', 0.4), a * 0.9));
  fillPath(ctx, body, g);
  ctx.restore();
  // Zellkern
  fillPath(ctx, catmull(blobPts(x + 4 * s, y + 2 * s, 12 * s, M.seed + 3, t * 0.5, 0.2, 10), 4, true), rgba('#7a3300', a * 0.45));
  glow(ctx, x, y, 90 * s, col, a * 0.22);
  return tipPts;
}

// ------------------------------------------------------------ DNA-Doppelhelix
/**
 * Horizontale Helix von x0 bis x1 um y. phase animiert die Rotation.
 * o: amp, turns, color, alpha, rungs (bool), dissolve (0..1), particles (bool), highlight(fn i→0..1)
 */
export function drawHelix(ctx, x0, x1, y, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const amp = o.amp ?? 60, turns = o.turns ?? 4, ph = o.phase ?? 0, col = o.color ?? C.gen, col2 = o.color2 ?? '#7fb2ff';
  const N = o.n ?? 160;
  const s1 = [], s2 = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, x = lerp(x0, x1, f), th = f * turns * TAU + ph;
    s1.push({ x, y: y + Math.sin(th) * amp, z: Math.cos(th) });
    s2.push({ x, y: y + Math.sin(th + Math.PI) * amp, z: Math.cos(th + Math.PI) });
  }
  const draw = o.draw ?? 1;
  const nDraw = Math.floor(N * draw);
  // Sprossen (Basenpaare)
  if (o.rungs !== false) {
    for (let i = 2; i < nDraw; i += 4) {
      const p = s1[i], q = s2[i];
      const hl = o.highlight ? o.highlight(i / N) : 0;
      const depth = 0.3 + 0.35 * (p.z + 1) * 0.5;
      ctx.strokeStyle = rgba(hl > 0 ? mixColor(col2, C.warn, hl) : col2, a * depth * (0.5 + hl));
      ctx.lineWidth = 2 + hl * 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  }
  const strand = (s, c) => {
    for (let i = 1; i < nDraw; i++) {
      const p = s[i - 1], q = s[i];
      const depth = 0.35 + 0.65 * (q.z + 1) * 0.5;
      ctx.strokeStyle = rgba(c, a * depth);
      ctx.lineWidth = 2 + 3.5 * depth;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  };
  ctx.lineCap = 'round';
  strand(s2, col);
  strand(s1, col);
  if (o.glow !== false) for (let i = 0; i < nDraw; i += 6) { const p = s1[i]; if (p.z > 0.3) glow(ctx, p.x, p.y, 16, col, a * 0.12); }
  return { s1, s2 };
}

/** Punktwolke einer Helix (für Partikel-Morphing) */
export function helixTargets(n, x0, x1, y, amp, turns, ph) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = (i >> 1) / (n / 2), th = f * turns * TAU + ph + (i & 1 ? Math.PI : 0);
    out.push({ x: lerp(x0, x1, f), y: y + Math.sin(th) * amp, z: Math.cos(th) });
  }
  return out;
}

// ------------------------------------------------------------ Chromosom
/** Stilisiertes Chromosom (senkrecht), bands: [{f0,f1,shade}] ; gap: {f0,f1,k} für Deletion */
export function drawChromosome(ctx, x, y, h, w, o = {}) {
  const a = o.alpha ?? 1, col = o.color ?? C.gen;
  if (a <= 0.003) return;
  const cen = o.centromere ?? 0.28;
  const arm = (y0, y1) => {
    ctx.beginPath();
    roundRect(ctx, x - w / 2, y0, w, y1 - y0, w / 2);
  };
  ctx.save();
  // Arme als Pfad mit Einschnürung
  const top = y - h / 2, bottom = y + h / 2, cy = lerp(top, bottom, cen);
  const drawArm = (y0, y1) => {
    arm(y0, y1);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, rgba(col, a * 0.35)); g.addColorStop(0.5, rgba(col, a * 0.75)); g.addColorStop(1, rgba(col, a * 0.35));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = rgba(col, a * 0.9); ctx.lineWidth = 2; ctx.stroke();
  };
  drawArm(top, cy - 6);
  drawArm(cy + 6, bottom);
  // Bänder
  for (const b of o.bands || []) {
    const yy0 = lerp(top, bottom, b.f0), yy1 = lerp(top, bottom, b.f1);
    ctx.fillStyle = rgba('#1a0b3a', a * (b.shade ?? 0.5));
    ctx.fillRect(x - w / 2 + 2, yy0, w - 4, yy1 - yy0);
  }
  if (o.gap) {
    const g0 = lerp(top, bottom, o.gap.f0), g1 = lerp(top, bottom, o.gap.f1);
    const k = o.gap.k ?? 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${k})`;
    ctx.fillRect(x - w / 2 - 4, g0, w + 8, g1 - g0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = rgba(C.warn, a * k); ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
    ctx.strokeRect(x - w / 2 - 6, g0, w + 12, g1 - g0); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ------------------------------------------------------------ Membran (Lipid-Doppelschicht)
export function drawMembrane(ctx, x0, x1, y, o = {}) {
  const a = o.alpha ?? 1, col = o.color ?? '#9fb6e8', t = o.t ?? 0, sp = o.spacing ?? 14, thick = o.thick ?? 34;
  if (a <= 0.003) return;
  const gaps = o.gaps || [];
  for (let x = x0; x <= x1; x += sp) {
    if (gaps.some((g) => Math.abs(x - g.x) < g.w / 2)) continue;
    const wy = Math.sin(x * 0.02 + t) * (o.wave ?? 2);
    for (const side of [-1, 1]) {
      const hy = y + wy + side * thick / 2;
      dot(ctx, x, hy, sp * 0.36, col, a * 0.8);
      ctx.strokeStyle = rgba(col, a * 0.35); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x - 2, hy - side * 4); ctx.lineTo(x - 2, y + wy - side * 2); ctx.moveTo(x + 2, hy - side * 4); ctx.lineTo(x + 2, y + wy - side * 2); ctx.stroke();
    }
  }
}

// ------------------------------------------------------------ Moleküle
export function molecule(ctx, x, y, r, color, a = 1, kind = 'dot') {
  if (a <= 0.003) return;
  if (kind === 'dot') { spark(ctx, x, y, r, color, a); return; }
  if (kind === 'pair') { spark(ctx, x - r * 0.7, y, r * 0.8, color, a); spark(ctx, x + r * 0.7, y, r * 0.8, color, a); }
}

/** Partikel entlang eines Pfades (stationär, zeitbasiert) */
export function flow(ctx, pts, t, o = {}) {
  const n = o.n ?? 12, sp = o.speed ?? 0.25, col = o.color ?? C.glu, r = o.r ?? 3, a = o.alpha ?? 1;
  if (a <= 0.003) return;
  for (let i = 0; i < n; i++) {
    const f = fract(i / n + t * sp + (o.phase ?? 0));
    const lim = o.limit ?? 1;
    if (f > lim) continue;
    const p = pointAt(pts, f);
    const edge = Math.sin(Math.PI * clamp(f / lim));
    spark(ctx, p.x, p.y, r, col, a * (0.35 + 0.65 * edge));
  }
}

// ------------------------------------------------------------ Knoten mit Beschriftung
export function node(ctx, x, y, r, color, label, p = 1, o = {}) {
  if (p <= 0) return;
  const k = ease.outBack(clamp(p));
  const a = (o.alpha ?? 1) * clamp(p * 1.5);
  glow(ctx, x, y, r * 3.2 * k, color, a * (o.glow ?? 0.35));
  ctx.save();
  ctx.fillStyle = rgba('#060b18', a * 0.85);
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r * k), 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(color, a); ctx.lineWidth = o.lw ?? 2.5;
  ctx.stroke();
  ctx.restore();
  if (o.fill) { dot(ctx, x, y, r * k * 0.45, color, a * o.fill); }
  if (label) {
    const pos = o.labelPos ?? 'below';
    const ly = pos === 'below' ? y + r + 30 : pos === 'above' ? y - r - 26 : y;
    const lx = pos === 'right' ? x + r + 18 : pos === 'left' ? x - r - 18 : x;
    const al = pos === 'right' ? 'left' : pos === 'left' ? 'right' : 'center';
    text(ctx, label, lx, ly, { size: o.size ?? 24, weight: 600, color: o.labelColor ?? C.text, alpha: a, align: al, reveal: clamp(p * 1.3 - 0.2), font: 'text', spacing: o.spacing ?? 1.5 });
  }
}

// ------------------------------------------------------------ Personen-Piktogramm (abstrakt)
export function person(ctx, x, y, s, color, a = 1, fill = 0.25) {
  if (a <= 0.003) return;
  ctx.save();
  ctx.fillStyle = rgba(color, a * fill);
  ctx.strokeStyle = rgba(color, a * 0.9);
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath(); ctx.arc(x, y - s * 0.62, s * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y + s * 0.5);
  ctx.bezierCurveTo(x - s * 0.34, y - s * 0.2, x - s * 0.18, y - s * 0.34, x, y - s * 0.34);
  ctx.bezierCurveTo(x + s * 0.18, y - s * 0.34, x + s * 0.34, y - s * 0.2, x + s * 0.3, y + s * 0.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------ Punkte-Raster (z. B. 1000 Menschen)
export function dotGrid(ctx, cx, cy, cols, rows, gap, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const r = o.r ?? gap * 0.28;
  const x0 = cx - ((cols - 1) * gap) / 2, y0 = cy - ((rows - 1) * gap) / 2;
  const reveal = o.reveal ?? 1;
  const n = cols * rows;
  for (let i = 0; i < n; i++) {
    const cxi = i % cols, cyi = Math.floor(i / cols);
    const k = clamp(reveal * 1.3 - (cxi + cyi) / (cols + rows) * 0.3 * 1.3);
    if (k <= 0) continue;
    const hl = o.highlight ? o.highlight(i) : 0;
    const x = x0 + cxi * gap, y = y0 + cyi * gap;
    if (hl > 0) { spark(ctx, x, y, r * (1 + hl * 0.6), o.hlColor ?? C.warn, a * k * hl); }
    dot(ctx, x, y, r, hl > 0.5 ? (o.hlColor ?? C.warn) : (o.color ?? C.neuronDim), a * k * (hl > 0.5 ? 1 : 0.55));
  }
}

// ------------------------------------------------------------ Linien-Icons (minimalistisch)
export function icon(ctx, kind, x, y, s, color, a = 1, t = 0) {
  if (a <= 0.003) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = rgba(color, a); ctx.fillStyle = rgba(color, a * 0.18);
  ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const S = s / 2;
  const circ = (cx, cy, r, f = true) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); if (f) ctx.fill(); ctx.stroke(); };
  switch (kind) {
    case 'virus': {
      circ(0, 0, S * 0.5);
      for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU + t * 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(an) * S * 0.5, Math.sin(an) * S * 0.5); ctx.lineTo(Math.cos(an) * S * 0.82, Math.sin(an) * S * 0.82); ctx.stroke(); circ(Math.cos(an) * S * 0.88, Math.sin(an) * S * 0.88, S * 0.07); }
      break;
    }
    case 'antibody': {
      ctx.beginPath(); ctx.moveTo(0, S * 0.8); ctx.lineTo(0, 0); ctx.lineTo(-S * 0.55, -S * 0.6); ctx.moveTo(0, 0); ctx.lineTo(S * 0.55, -S * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-S * 0.2, S * 0.1); ctx.lineTo(-S * 0.7, -S * 0.45); ctx.moveTo(S * 0.2, S * 0.1); ctx.lineTo(S * 0.7, -S * 0.45); ctx.stroke();
      break;
    }
    case 'nutrition': {
      ctx.beginPath(); ctx.moveTo(0, S * 0.85); ctx.lineTo(0, -S * 0.85); ctx.stroke();
      for (let i = 0; i < 4; i++) { const yy = -S * 0.6 + i * S * 0.35; ctx.beginPath(); ctx.ellipse(-S * 0.22, yy, S * 0.22, S * 0.12, -0.6, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(S * 0.22, yy, S * 0.22, S * 0.12, 0.6, 0, TAU); ctx.fill(); ctx.stroke(); }
      break;
    }
    case 'stress': {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const xx = -S * 0.9 + (i / 24) * S * 1.8; const yy = Math.sin(i * 1.3 + t * 6) * S * 0.45 * (i % 2 ? 1 : -0.6); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
      break;
    }
    case 'smoke': {
      for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const yy = S * 0.8 - (i / 20) * S * 1.7; const xx = (k - 1) * S * 0.35 + Math.sin(i * 0.5 + t * 2 + k) * S * 0.15; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
      break;
    }
    case 'o2': {
      circ(-S * 0.3, 0, S * 0.42, false);
      text(ctx, 'O₂', -S * 0.3, 2, { size: S * 0.5, weight: 700, color, alpha: a, font: 'text' });
      ctx.beginPath(); ctx.moveTo(S * 0.55, -S * 0.5); ctx.lineTo(S * 0.55, S * 0.5); ctx.lineTo(S * 0.35, S * 0.25); ctx.moveTo(S * 0.55, S * 0.5); ctx.lineTo(S * 0.75, S * 0.25); ctx.stroke();
      break;
    }
    case 'clock': {
      circ(0, 0, S * 0.75);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -S * 0.5); ctx.moveTo(0, 0); ctx.lineTo(S * 0.35, S * 0.15); ctx.stroke();
      break;
    }
    case 'moon': {
      ctx.beginPath(); ctx.arc(0, 0, S * 0.7, 0.9, TAU - 0.9 + 0.001, false); ctx.arc(S * 0.35, -S * 0.1, S * 0.5, TAU - 1.3, 1.3, true); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'group': {
      for (const [dx, sc] of [[-0.55, 0.8], [0.55, 0.8], [0, 1]]) { ctx.beginPath(); ctx.arc(dx * S, -S * 0.35 * sc, S * 0.2 * sc, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(dx * S, S * 0.5, S * 0.42 * sc, Math.PI, TAU); ctx.fill(); ctx.stroke(); }
      break;
    }
    case 'exclude': {
      for (const dx of [-0.5, 0.1]) { ctx.beginPath(); ctx.arc(dx * S, -S * 0.3, S * 0.18, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(dx * S, S * 0.45, S * 0.36, Math.PI, TAU); ctx.stroke(); }
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(S * 0.75, 0, S * 0.25, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      break;
    }
    case 'city': {
      const bs = [[-0.9, 0.9], [-0.55, 1.4], [-0.15, 1.1], [0.25, 1.7], [0.6, 1.2]];
      for (const [bx, bh] of bs) { ctx.beginPath(); ctx.rect(bx * S, S * 0.8 - bh * S * 0.9, S * 0.32, bh * S * 0.9); ctx.fill(); ctx.stroke(); }
      break;
    }
    case 'bolt': {
      ctx.beginPath(); ctx.moveTo(S * 0.15, -S * 0.9); ctx.lineTo(-S * 0.35, S * 0.1); ctx.lineTo(S * 0.05, S * 0.1); ctx.lineTo(-S * 0.15, S * 0.9); ctx.lineTo(S * 0.4, -S * 0.15); ctx.lineTo(0, -S * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'cortisol': {
      for (let i = 0; i < 4; i++) { const an = i * 1.6; ctx.beginPath(); for (let k = 0; k <= 6; k++) { const aa = (k / 6) * TAU; const xx = Math.cos(aa) * S * 0.28 + Math.cos(an) * S * 0.45 * (i ? 1 : 0); const yy = Math.sin(aa) * S * 0.28 + Math.sin(an) * S * 0.45 * (i ? 1 : 0); k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
      break;
    }
    case 'dna': {
      for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const yy = -S + (i / 20) * 2 * S; const xx = Math.sin(i * 0.5 + k * Math.PI + t) * S * 0.45; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
      break;
    }
    case 'birth': {
      circ(0, -S * 0.25, S * 0.35);
      ctx.beginPath(); ctx.arc(0, S * 0.25, S * 0.62, Math.PI * 1.1, Math.PI * 1.9 + Math.PI, false); ctx.stroke();
      break;
    }
    case 'pill': {
      ctx.save(); ctx.rotate(-0.6); roundRect(ctx, -S * 0.8, -S * 0.3, S * 1.6, S * 0.6, S * 0.3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -S * 0.3); ctx.lineTo(0, S * 0.3); ctx.stroke(); ctx.restore();
      break;
    }
    case 'talk': {
      roundRect(ctx, -S * 0.9, -S * 0.65, S * 1.3, S * 0.85, S * 0.2); ctx.fill(); ctx.stroke();
      roundRect(ctx, -S * 0.2, -S * 0.1, S * 1.1, S * 0.75, S * 0.2); ctx.fill(); ctx.stroke();
      break;
    }
    case 'heart': {
      ctx.beginPath(); ctx.moveTo(0, S * 0.7); ctx.bezierCurveTo(-S * 1.1, -S * 0.1, -S * 0.5, -S * 0.9, 0, -S * 0.35); ctx.bezierCurveTo(S * 0.5, -S * 0.9, S * 1.1, -S * 0.1, 0, S * 0.7); ctx.fill(); ctx.stroke();
      break;
    }
    case 'ear': {
      ctx.beginPath(); ctx.arc(0, -S * 0.1, S * 0.45, Math.PI * 0.9, Math.PI * 2.3); ctx.quadraticCurveTo(S * 0.1, S * 0.5, -S * 0.1, S * 0.75); ctx.stroke();
      for (let i = 1; i <= 3; i++) { const rr = S * (0.55 + i * 0.28); const al = 1 - fract(t * 0.8 + i * 0.33); ctx.strokeStyle = rgba(color, a * al); ctx.beginPath(); ctx.arc(-S * 0.3, 0, rr, -0.6, 0.6); ctx.stroke(); }
      break;
    }
    default:
      circ(0, 0, S * 0.5);
  }
  ctx.restore();
}

// ------------------------------------------------------------ Synapsen-Endknöpfchen (Seitenansicht)
/** Kleines Synapsen-Paar für Mikroskop-Szenen (Bouton oben, Dorn unten). */
export function miniSynapse(ctx, x, y, s, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.003) return;
  const act = o.active ?? 0, col = o.color ?? C.neuron, t = o.t ?? 0;
  // Dorn (postsynaptisch) – wächst aus dem Dendriten (unten)
  const neck = [{ x, y: y + s * 1.6 }, { x: x + Math.sin(t + x) * s * 0.08, y: y + s * 0.9 }, { x, y: y + s * 0.42 }];
  taper(ctx, catmull(neck, 4), s * 0.32, s * 0.24, col, a * 0.8);
  const head = catmull(blobPts(x, y + s * 0.28, s * 0.42 * (o.headScale ?? 1), x * 0.1, t * 0.3, 0.1, 10, 1.3), 3, true);
  fillPath(ctx, head, rgba(mixColor(col, C.glu, act * 0.5), a * 0.9));
  // Bouton (präsynaptisch)
  const bout = catmull(blobPts(x, y - s * 0.52, s * 0.5, x * 0.2 + 1, t * 0.3, 0.1, 10, 1.25), 3, true);
  fillPath(ctx, bout, rgba(mixColor('#8fa7e0', C.glu, act * 0.4), a * 0.75));
  strokePath(ctx, [{ x, y: y - s * 1.0 }, { x: x + s * 0.1, y: y - s * 2.2 }], '#8fa7e0', a * 0.6, s * 0.14);
  if (act > 0) glow(ctx, x, y - s * 0.08, s * 2.4, C.glu, a * act * 0.5);
}
