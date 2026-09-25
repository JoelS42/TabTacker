// Szene 18 – Cannabis: Endocannabinoid-System, THC an CB1, Dosis-Wirkungs-Zusammenhang
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, glowPath, fillPath, catmull, fract, noise2, mixColor, roundRect, blobPts, smoothstep } from '../animation.js';
import { dotGrid } from './shared.js';

const SYNS = [{ x: 420 }, { x: 960 }, { x: 1500 }];
const TOPY = 360, BOTY = 560;
const R = rng(181);
const THC = Array.from({ length: 36 }, (_, i) => ({ x: R.range(0, W), y: R.range(-100, 250), d: R(), target: i % 12, ph: R() * 10 }));

/** vereinfachte Strukturformel (Ringsystem + Seitenkette) */
function thcGlyph(ctx, x, y, s, col, a) {
  if (a <= 0.01) return;
  const hex = (cx, cy) => { const pts = []; for (let k = 0; k <= 6; k++) { const an = Math.PI / 6 + (k / 6) * TAU; pts.push({ x: cx + Math.cos(an) * s, y: cy + Math.sin(an) * s }); } strokePath(ctx, pts, col, a, Math.max(1.2, s * 0.14)); };
  const dx = s * Math.sqrt(3);
  hex(x - dx, y); hex(x, y); hex(x + dx, y - s * 0.0);
  strokePath(ctx, [{ x: x + dx * 1.5, y: y + s * 0.5 }, { x: x + dx * 2, y: y }, { x: x + dx * 2.5, y: y + s * 0.5 }, { x: x + dx * 3, y: y }], col, a, Math.max(1.2, s * 0.14));
  text(ctx, 'OH', x + dx * 0.5, y - s * 1.7, { size: s * 0.8, weight: 700, color: col, alpha: a, font: 'text' });
  text(ctx, 'O', x - dx * 0.0, y + s * 1.25, { size: s * 0.8, weight: 700, color: col, alpha: a, font: 'text' });
}

function cb1(ctx, x, y, a, lit, col) {
  for (let k = 0; k < 7; k++) {
    ctx.save(); ctx.fillStyle = rgba(mixColor('#8a93b8', col, lit), a * 0.9);
    roundRect(ctx, x - 24 + k * 7, y - 14, 5, 28, 2.5); ctx.fill(); ctx.restore();
  }
  if (lit > 0) glow(ctx, x, y, 44, col, a * lit * 0.8);
}

export default {
  id: 'cannabis',
  transition: { type: 'fade', dur: 1.8 },
  sfx: [['low', 'can', 0, 0.4], ['pulse', 'ecs', 0.6, 0.3], ['swell', 'thc', 0, 0.4], ['click', 'cb1', 0.4, 0.4], ['swell', 'flood', 0, 0.5], ['chime', 'assoc', 0, 0.3], ['click', 'early', 0, 0.3], ['click', 'freq', 0, 0.3], ['click', 'pot', 0, 0.3], ['swell', 'study', 0.5, 0.4], ['low', 'debate', 0, 0.3]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.5, 1.2);
    const part1 = A * (1 - S.on('assoc', 1.2));
    heading(ctx, 'Substanzen', 'Cannabis', S.on('can', 1.2, ease.out) * (1 - S.on('assoc', 0.8)), { color: C.thc });
    if (part1 > 0) {
      const thcIn = S.on('thc', 2.0, ease.inOut);
      const bound = S.on('cb1', 1.5, ease.inOut);
      const ecsOn = S.on('ecs', 1.0) * (1 - bound);
      SYNS.forEach((s, i) => {
        const x = s.x;
        // Präsynapse (oben) + Postsynapse (unten)
        fillPath(ctx, catmull(blobPts(x, TOPY - 60, 150, i + 1, t * 0.2, 0.05, 14, 1.3), 4, true), rgba('#23386d', 0.6 * part1));
        strokePath(ctx, catmull(blobPts(x, TOPY - 60, 150, i + 1, t * 0.2, 0.05, 14, 1.3), 4, true), '#9fb6ff', part1 * 0.8, 2.5, true);
        fillPath(ctx, catmull(blobPts(x, BOTY + 70, 150, i + 7, t * 0.2, 0.05, 14, 1.3), 4, true), rgba('#1d2c55', 0.6 * part1));
        strokePath(ctx, catmull(blobPts(x, BOTY + 70, 150, i + 7, t * 0.2, 0.05, 14, 1.3), 4, true), '#9fb6ff', part1 * 0.8, 2.5, true);
        // Botenstoff-Freisetzung (wird durch CB1-Aktivierung gedämpft)
        const ecsPulse = Math.max(0, Math.sin(t * 1.3 + i * 2.1)) ** 6;
        const damp = Math.max(ecsOn * ecsPulse, bound);
        for (let k = 0; k < 10; k++) {
          const f = fract(t * 0.6 + k / 10 + i * 0.3);
          if (k / 10 > 1 - damp * 0.8) continue;
          spark(ctx, x - 60 + k * 13, lerp(TOPY + 30, BOTY - 20, f), 2.6, C.glu, part1 * 0.8 * Math.sin(Math.PI * f));
        }
        // CB1-Rezeptoren an der Präsynapse
        for (let r = 0; r < 4; r++) {
          const rx = x - 105 + r * 70;
          const lit = Math.max(ecsOn * (r === i % 4 || r === (i + 2) % 4 ? ecsPulse : 0), bound * (0.75 + 0.25 * Math.sin(t * 2 + r)));
          cb1(ctx, rx, TOPY + 8, part1 * S.on('ecs', 1.0, ease.out, -3), lit, bound > 0.3 ? C.thc : C.ecb);
        }
        // Endocannabinoide: lokal, kurz, rückwärts
        if (ecsOn > 0) {
          for (let k = 0; k < 5; k++) {
            const f = fract(t * 1.3 / Math.PI * 0.5 + i * 0.33 + k * 0.03);
            const fx = x - 70 + ((i * 2) % 4) * 70 + (k - 2) * 6;
            spark(ctx, fx, lerp(BOTY - 10, TOPY + 20, f), 3, C.ecb, part1 * ecsOn * ecsPulse);
          }
        }
      });
      const el = S.win('ecs', 'thc', 0.8, 0.6);
      if (el > 0) { text(ctx, 'körpereigenes Endocannabinoid-System', 960, 170, { size: 34, weight: 700, color: C.ecb, alpha: el, reveal: el }); }
      const fl = S.win('fine', 'thc', 0.6, 0.6);
      if (fl > 0) badge(ctx, 'Feinsteuerung: gezielt · lokal · kurz', 960, 800, { color: C.ecb, p: fl, size: 26 });
      const cl = S.win('cb1', 'devq', 0.8, 0.8);
      if (cl > 0) callout(ctx, SYNS[1].x + 35, TOPY + 8, 1180, 180, 'CB1-Rezeptoren', { p: cl, color: C.thc, size: 32 });
      // THC-Moleküle
      if (thcIn > 0) {
        for (const m of THC) {
          const s = SYNS[m.target % 3];
          const tx = s.x - 105 + (m.target % 4) * 70, ty = TOPY - 30;
          const x = lerp(m.x, tx + noise2(m.ph, t) * 8, bound * 0.9 + thcIn * 0.1);
          const y = lerp(m.y + noise2(m.ph + 2, t * 0.5) * 30 + 200 * thcIn, ty, bound);
          thcGlyph(ctx, x, y, 6, C.thc, part1 * thcIn * 0.9);
        }
        thcGlyph(ctx, 1560, 150, 22, C.thc, part1 * S.win('thc', 'flood', 0.8, 0.8));
        text(ctx, 'THC', 1560, 225, { size: 30, weight: 700, color: C.thc, alpha: part1 * S.win('thc', 'flood', 0.8, 0.8) });
      }
      const fd = S.win('flood', 'devq', 0.8, 0.8);
      if (fd > 0) badge(ctx, 'THC: überall gleichzeitig · länger anhaltend', 960, 800, { color: C.thc, p: fd, size: 26 });
      const dv = S.win('devq', 'assoc', 0.8, 0.8);
      if (dv > 0) {
        badge(ctx, 'Das System reift in der Jugend noch', 960, 170, { color: C.ecb, p: dv, size: 26 });
        const d2 = S.on('devq2', 1.0);
        if (d2 > 0) badge(ctx, 'Einfluss auf die Reifung von Netzwerken? – wird untersucht', 960, 800, { color: C.warn, p: d2, alpha: dv, size: 24 });
      }
    }
    // ---------------- Risiko-Zusammenhang
    const p2 = S.on('assoc', 1.2);
    if (p2 > 0) {
      heading(ctx, 'Zusammenhang', 'Cannabis und Psychoserisiko', p2, { color: C.thc });
      const chips = [['früher Beginn', 'early'], ['häufiger Konsum', 'freq'], ['hohe THC-Potenz', 'pot']];
      chips.forEach(([l, cue], i) => badge(ctx, l, 330, 380 + i * 90, { color: C.thc, p: S.on(cue, 0.7, ease.out), size: 28, alpha: p2 * (1 - S.on('most', 1) * 0.6) }));
      const st = S.on('study', 1.2);
      const bars = [['kein Konsum', 1.0, '#8fa7e0'], ['täglich', 3.2, C.thc], ['täglich, hochpotent', 4.8, C.warn]];
      const bx = 700, by0 = 760, bw = 150, scale = 95;
      strokePath(ctx, [{ x: bx - 30, y: by0 }, { x: bx + 3 * 260, y: by0 }], C.textDim, p2 * 0.7, 2);
      bars.forEach(([lab, v, col], i) => {
        const k = S.on('study', 1.4, ease.out, 0.3 + i * 0.4);
        const x = bx + i * 260, h = v * scale * k;
        ctx.save(); ctx.fillStyle = rgba(col, 0.85 * p2); roundRect(ctx, x, by0 - h, bw, h, 8); ctx.fill(); ctx.restore();
        text(ctx, lab, x + bw / 2, by0 + 30, { size: 22, weight: 600, color: C.text, font: 'text', alpha: p2 * st });
        if (k > 0.5) text(ctx, i === 0 ? '1 (Bezug)' : `≈ ${v.toFixed(1).replace('.', ',')}×`, x + bw / 2, by0 - h - 26, { size: 30, weight: 700, color: col, alpha: p2 * k });
      });
      if (st > 0) {
        text(ctx, 'Chance einer psychotischen Erkrankung (Odds Ratio)', bx + 360, 200, { size: 26, weight: 600, color: C.text, font: 'text', alpha: p2 * st });
        text(ctx, 'Di Forti et al., Lancet Psychiatry 2019 – europäische Fall-Kontroll-Studie', bx + 360, 850, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: p2 * st });
      }
      const vu = S.win('vuln', 'most', 0.8, 0.6);
      if (vu > 0) badge(ctx, 'besonders relevant bei vorhandener Vulnerabilität', 340, 680, { color: C.gen, p: vu, size: 26 });
      const mo = S.on('most', 1.2);
      if (mo > 0) {
        ctx.save(); ctx.fillStyle = rgba('#03050b', 0.93 * mo); ctx.fillRect(0, 0, W, H); ctx.restore();
        dotGrid(ctx, 960, 470, 20, 10, 38, { alpha: mo, reveal: mo, r: 9, color: C.gaba, hlColor: C.warn, highlight: (i) => (i === 67 || i === 151 ? mo : 0) });
        text(ctx, 'Die meisten, die Cannabis konsumieren, entwickeln keine Psychose.', 960, 740, { size: 32, weight: 700, color: C.gaba, alpha: mo, reveal: mo });
        text(ctx, 'schematisch', 960, 780, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: mo });
        const de = S.on('debate', 1.0);
        if (de > 0) badge(ctx, 'Wie groß der ursächliche Anteil ist, wird weiter erforscht', 960, 850, { color: C.warn, p: de, size: 24 });
      }
    }
  },
};
