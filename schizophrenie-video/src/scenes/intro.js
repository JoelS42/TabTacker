// Szene 1 – Prolog: Lichtpunkt → Neuron → Netzwerk → Gehirn → sechs Pfade → Titel
import {
  W, H, TAU, C, clamp, lerp, ease, tween, rng, Camera, camTrack, glow, spark, dot, text, rgba, makeNeuron, drawNeuron,
  drawBrain, pointAt, subPath, glowPath, strokePath, catmull, smoothstep, noise2, fract, statement,
} from '../animation.js';
import { makeNetwork, drawNetwork, edgePoint } from './shared.js';

const P0 = { x: -330, y: -170 };      // erster Punkt: präfrontaler Kortex
const BC = { x: 0, y: -80 };          // Gehirnmitte
const R = rng(11);

const first = makeNeuron(5, { x: P0.x, y: P0.y, size: 0.022, dendrites: 6, axonAngle: 0.25, axonLen: 300, maxDepth: 3, growSpan: 0.4 });
const cluster = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 11) * TAU + R.range(-0.2, 0.2), r = R.range(2.6, 4.6);
  return makeNeuron(40 + i, { x: P0.x + Math.cos(a) * r, y: P0.y + Math.sin(a) * r * 0.8, size: R.range(0.013, 0.019), dendrites: R.int(4, 6), axonLen: R.range(160, 260), maxDepth: 2 });
});
const L0 = makeNetwork(21, { points: [first, ...cluster].map((n) => ({ x: n.x, y: n.y })), k: 3 });
const L1 = makeNetwork(22, { n: 900, circle: { x: P0.x, y: P0.y, r: 120 }, exclude: { x: P0.x, y: P0.y, r: 5.0 }, minD: 3.4, k: 3 });
const L2 = makeNetwork(23, { n: 520, brain: true, minD: 25, k: 3, exclude: { x: P0.x, y: P0.y, r: 70 } });

const PATHS = [
  { label: 'GENETIK', color: C.gen },
  { label: 'ENTWICKLUNG', color: C.myelin },
  { label: 'UMWELT', color: C.stress },
  { label: 'IMMUNSYSTEM', color: C.mg },
  { label: 'SYNAPSEN', color: C.glu },
  { label: 'BOTENSTOFFE', color: C.da },
].map((p, i) => ({ ...p, ang: -Math.PI / 2 + (i / 6) * TAU + 0.15, cue: `p${i}` }));

function pathPts(p, S, t) {
  const div = S.on('alone', 2.5, ease.inOut) * (1 - S.on('merge', 2.0));
  const merge = S.on('merge', 2.6, ease.inOut);
  const Rr = lerp(lerp(520, 600, div), 330, merge);
  const bend = (0.35 + 0.25 * noise2(p.ang * 3, t * 0.25)) * (1 + div * 0.8);
  const d = { x: Math.cos(p.ang), y: Math.sin(p.ang) * 0.74 }, n = { x: -Math.sin(p.ang), y: Math.cos(p.ang) };
  const E = { x: BC.x + d.x * Rr, y: BC.y + d.y * Rr };
  if (merge <= 0) {
    return catmull([
      BC,
      { x: BC.x + d.x * Rr * 0.33 + n.x * Rr * bend * 0.35, y: BC.y + d.y * Rr * 0.33 + n.y * Rr * bend * 0.35 },
      { x: BC.x + d.x * Rr * 0.68 - n.x * Rr * bend * 0.2, y: BC.y + d.y * Rr * 0.68 - n.y * Rr * bend * 0.2 },
      E,
    ], 10);
  }
  // Blütenblatt-Schleife: hinaus und zurück zur Mitte
  const w = lerp(0.0, 0.42, merge);
  const pts = [BC];
  const steps = 24;
  for (let s = 1; s <= steps; s++) {
    const f = s / steps;                       // 0..1 entlang Schleife
    const out = Math.sin(Math.PI * Math.min(1, f * lerp(1, 1, merge)));
    const ang = p.ang + (f - 0.5) * w * 2 * Math.PI * 0.5;
    const rr = lerp(Rr * f, Rr * out, merge);
    const ys = lerp(0.74, 1, merge);
    pts.push({ x: BC.x + Math.cos(ang) * rr + n.x * Rr * bend * 0.3 * Math.sin(Math.PI * f) * (1 - merge), y: BC.y + Math.sin(ang) * rr * ys + n.y * Rr * bend * 0.3 * Math.sin(Math.PI * f) * (1 - merge) });
  }
  return catmull(pts, 3);
}

export default {
  id: 'intro',
  transition: { type: 'fade', dur: 0.1 },
  sfx: [
    ['spark', 0.8, 0, 0.5], ['impulse', 3.1, 0, 0.8], ['grow', 3.3, 0, 0.6], ['click', 'branch', 0, 0.6], ['whoosh', 'network', 0, 0.8],
    ['swell', 'brain', 0, 0.7], ['low', 'question', 0, 0.6], ['chime', 'p0', 0, 0.3], ['chime', 'p2', 0, 0.3], ['chime', 'p4', 0, 0.3],
    ['swell', 'merge', 0, 0.7], ['boom', 'title', 0, 0.8],
  ],
  draw(ctx, S) {
    const t = S.t, s0 = S.start;
    const tNeuron = S.cue('neuron'), tBranch = S.cue('branch'), tNet = S.cue('network'), tBrain = S.cue('brain'), tBrain2 = S.cue('brain2');
    const tTitle = S.cue('title');
    // ---------------- Kamera (log-Zoom, Fokus wandert vom ersten Neuron zur Gehirnmitte)
    const cam = camTrack(t, [
      [s0 + 0, { x: P0.x, y: P0.y, z: 150 }],
      [s0 + 3.2, { x: P0.x, y: P0.y, z: 140 }],
      [tNeuron, { x: P0.x + 0.4, y: P0.y, z: 95 }],
      [tBranch + 0.5, { x: P0.x + 0.4, y: P0.y, z: 60 }],
      [tBrain, { x: P0.x * 0.55, y: lerp(P0.y, BC.y, 0.5), z: 2.4 }],
      [tBrain2 + 0.4, { x: BC.x, y: BC.y, z: 0.8 }],
      [S.cue('question'), { x: BC.x, y: BC.y + 40, z: 0.78 }],
      [S.cue('together') + 0.5, { x: BC.x, y: BC.y, z: 0.74 }],
      [tTitle - 0.4, { x: BC.x, y: BC.y, z: 0.78 }],
      [tTitle + 1.6, { x: BC.x, y: BC.y + 250, z: 0.56 }],
    ], ease.inOut);
    const z = cam.z;
    ctx.save();
    new Camera(cam.x, cam.y, z).apply(ctx);

    // ---------------- Gehirn (erscheint beim Herauszoomen)
    const brainA = smoothstep(3.2, 1.3, z) * (1 - 0.55 * S.on('question', 1.2) * (1 - S.on('together', 1.5))) * (1 - 0.6 * S.on('alone', 2)) * lerp(1, 0.55, S.on('title', 2));
    if (brainA > 0) drawBrain(ctx, { alpha: brainA, draw: tween(t, tBrain - 0.6, 3.6, ease.inOut), gyri: 0.9, fill: 0.5, lw: 2.4 / Math.max(0.6, z) });

    // ---------------- Globales Netzwerk (L2)
    const l2a = smoothstep(9, 3.5, z) * (1 - 0.5 * S.on('question', 1.2) * (1 - S.on('together', 1.5))) * (1 - 0.75 * S.on('alone', 2)) * lerp(1, 0.4, S.on('title', 2));
    if (l2a > 0) {
      drawNetwork(ctx, L2, {
        t, zoom: z, alpha: l2a, lw: 1.1, nodeR: 2.6, color: C.neuron, edgeColor: '#6f8fd6',
        reveal: { x: P0.x, y: P0.y, r: lerp(60, 1150, tween(t, tNet + 1.0, tBrain2 - tNet, ease.in)), soft: 90 },
        pulses: 0.5 * tween(t, tBrain2 - 1, 2), pulseColor: C.glu, nodeGlow: 0.25,
      });
    }
    // ---------------- Lokales Netzwerk (L1)
    const l1a = smoothstep(1.6, 3.4, z) * (1 - smoothstep(70, 110, z));
    if (l1a > 0) {
      drawNetwork(ctx, L1, {
        t, zoom: z, alpha: l1a, lw: 1.3, nodeR: 3.2, color: C.neuron, edgeColor: '#7f9ee0',
        reveal: { x: P0.x, y: P0.y, r: lerp(5, 140, tween(t, tBranch + 0.4, tBrain - tBranch + 0.4, ease.inOut)), soft: 10 }, glyph: true,
        pulses: 0.6, pulseColor: C.glu, nodeGlow: 0.35,
      });
    }
    // ---------------- Detail-Neuronen (L0)
    const l0a = smoothstep(12, 30, z);
    if (l0a > 0) {
      // Signal, das in den Lichtpunkt läuft
      const sigP = tween(t, s0 + 2.0, 1.1, ease.in);
      if (sigP > 0 && sigP < 1) {
        const line = [{ x: P0.x - 9, y: P0.y + 1.2 }, { x: P0.x - 4, y: P0.y - 0.4 }, { x: P0.x, y: P0.y }];
        const sm = catmull(line, 8);
        strokePath(ctx, sm, '#6f8fd6', l0a * 0.35 * (1 - sigP * 0.5), 1.2 / z);
        const p = pointAt(sm, sigP);
        glow(ctx, p.x, p.y, 0.35, C.glu, l0a);
        glow(ctx, p.x, p.y, 0.08, '#ffffff', l0a, 1);
      }
      // Lichtpunkt
      const pt = tween(t, s0 + 0.8, 1.5, ease.out) * (1 - tween(t, s0 + 4.5, 2));
      const flare = Math.exp(-Math.max(0, t - (s0 + 3.1)) * 3) * (t > s0 + 3.1 ? 1 : 0);
      glow(ctx, P0.x, P0.y, (0.25 + flare * 1.2) * (1 + 0.1 * Math.sin(t * 3)), '#ffffff', l0a * (pt * 0.8 + flare));
      glow(ctx, P0.x, P0.y, 0.9 + flare * 2, C.glu, l0a * (pt * 0.35 + flare * 0.6));
      // Erstes Neuron wächst aus dem Punkt
      const g0 = tween(t, s0 + 3.2, tNeuron - (s0 + 3.2) + 0.6, ease.inOut);
      drawNeuron(ctx, first, g0, { t, alpha: l0a, glow: 0.5, color: C.neuron });
      // Impuls entlang des Axons
      if (t > tNeuron) {
        const f = fract((t - tNeuron) * 0.45);
        const p = pointAt(first.axon.pts, f);
        glow(ctx, p.x, p.y, 0.5, C.glu, l0a * 0.9 * Math.sin(Math.PI * f));
      }
      // weitere Neuronen und Verbindungen
      cluster.forEach((n, i) => {
        const g = tween(t, tBranch - 0.3 + i * 0.12, 1.8, ease.out);
        drawNeuron(ctx, n, g, { t, alpha: l0a * 0.85, glow: 0.3, color: C.neuron });
      });
      drawNetwork(ctx, L0, { t, zoom: z, alpha: l0a * 0.7 * tween(t, tBranch + 0.4, 1.2), lw: 1.0, nodeR: 0.1, color: C.neuron, edgeColor: '#9cb6ff', pulses: 1, pulseColor: C.glu, grow: tween(t, tBranch + 0.2, 1.6) });
    }
    // ---------------- Sechs Pfade
    const tTog = S.cue('together');
    if (t > tTog - 0.2) {
      const pa = tween(t, tTog, 1.0);
      PATHS.forEach((p, i) => {
        const tp = S.cue(p.cue);
        const grow = tween(t, tTog + 0.3 + i * 0.15, (tp - tTog) + 0.4, ease.inOut);
        const pts = pathPts(p, S, t);
        const vis = subPath(pts, 0, grow);
        const lw = 3.2 / z;
        glowPath(ctx, vis, p.color, pa * 0.95, lw, 14 / z);
        // Partikel fließen entlang
        if (grow > 0.2) {
          for (let k = 0; k < 7; k++) {
            const f = fract(k / 7 + t * 0.18 + i * 0.13) * grow;
            const q = pointAt(pts, f);
            glow(ctx, q.x, q.y, 9 / z, p.color, pa * 0.9);
          }
        }
        // Endknoten + Beschriftung (vor dem Verschmelzen)
        const merge = S.on('merge', 1.4);
        const lab = tween(t, tp, 0.7, ease.out) * (1 - merge);
        if (lab > 0) {
          const e = pointAt(pts, grow);
          glow(ctx, e.x, e.y, 34 / z, p.color, 0.5 * lab);
          dot(ctx, e.x, e.y, 7 / z, p.color, lab);
          const lx = e.x + Math.cos(p.ang) * 34 / z, ly = e.y + Math.sin(p.ang) * 30 / z;
          ctx.save();
          ctx.translate(lx, ly); ctx.scale(1 / z, 1 / z);
          text(ctx, p.label, 0, 0, { size: 28, weight: 700, color: p.color, alpha: lab, spacing: 3, reveal: lab, align: Math.abs(Math.cos(p.ang)) < 0.3 ? 'center' : Math.cos(p.ang) > 0 ? 'left' : 'right' });
          ctx.restore();
        }
      });
      // Mitte leuchtet beim Verschmelzen
      const mk = S.on('merge', 2.5);
      if (mk > 0) {
        glow(ctx, BC.x, BC.y, (80 + 30 * Math.sin(t * 2)) / z * mk, '#ffffff', 0.35 * mk);
        glow(ctx, BC.x, BC.y, 200 / z * mk, C.glu, 0.25 * mk);
      }
    }
    ctx.restore();

    // ---------------- Texte (Bildschirmraum)
    const q = S.win('question', 'notone', 0.9, 0.7);
    statement(ctx, 'Wie entsteht Schizophrenie?', H / 2 + 10, q * 1.0, { size: 76, alpha: q });
    const nq = S.win('notone', 'together', 0.9, 0.8);
    statement(ctx, 'Nicht durch eine einzige Ursache.', H / 2 + 10, S.on('notone', 1.4, ease.out), { size: 64, alpha: nq, color: C.text });

    const ti = S.on('title', 1.6, ease.out);
    if (ti > 0) {
      text(ctx, 'DIE ENTSTEHUNG VON SCHIZOPHRENIE', W / 2, 690, { size: 70, weight: 700, spacing: 6, reveal: ti, glow: 0.5 });
      const yk = S.on('title', 1.6, ease.out, 0.9);
      const yh = S.on('youth', 1.2);
      text(ctx, 'bei Kindern und Jugendlichen', W / 2, 770, { size: 40, weight: 600, color: C.glu, reveal: yk, glow: 0.3 + yh * 0.9 });
      text(ctx, 'Gehirnentwicklung  ·  Risikofaktoren  ·  neurobiologische Mechanismen', W / 2, 842, { size: 26, weight: 500, color: C.textDim, font: 'text', spacing: 1.5, reveal: S.on('title', 1.8, ease.out, 1.8) });
    }
  },
};
