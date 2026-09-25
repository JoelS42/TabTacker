// Szene 13 – Der NMDA-Rezeptor und die NMDA-Hypothese
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, callout, strokePath, glowPath, fillPath, catmull, fract, noise2, mixColor, smoothstep, roundRect } from '../animation.js';
import { drawMembrane, icon } from './shared.js';

const MY = 600;           // Membranmitte
const RX = 960;           // Rezeptorachse
const R = rng(131);
const CA = Array.from({ length: 40 }, () => ({ d: R(), dx: R.range(-10, 10), spread: R.range(-260, 260), ph: R() * 10 }));

function subunit(ctx, x, top, bot, w, col, a, clamp01, side) {
  ctx.save();
  ctx.fillStyle = rgba(col, a * 0.92);
  roundRect(ctx, x - w / 2, top + 70, w, bot - top - 70, w * 0.4); ctx.fill();
  // Liganden-Bindedomäne (Muschelform), schließt sich beim Binden
  const cx = x, cy = top + 40;
  const open = 0.55 * (1 - clamp01);
  ctx.beginPath();
  ctx.ellipse(cx - side * 10, cy, w * 0.55, 30, -side * open, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + side * 10, cy + 6, w * 0.45, 26, side * open, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export default {
  id: 'nmda',
  transition: { type: 'zoomIn', dur: 1.8, fromX: 1020, fromY: 540 },
  sfx: [['grow', 'big', 0, 0.5], ['click', 'two', 0.8, 0.5], ['click', 'gly', 0.8, 0.5], ['release', 'mg', 1.4, 0.5], ['release', 'ca', 0, 0.5], ['chime', 'learn', 0, 0.3],
    ['click', 'ket', 1.2, 0.6], ['click', 'enc', 0.8, 0.5], ['low', 'weak', 0, 0.5], ['whooshOut', 'inh', 0, 0.5]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.5, 1.2);
    const zoomOut = S.on('inh', 2.2, ease.inOut);
    heading(ctx, 'Glutamat-Rezeptor', 'Der NMDA-Rezeptor', S.on('big', 1.0, ease.out) * (1 - S.on('hyp', 0.8)), { color: '#6fb0ff' });
    const hy = S.on('hyp', 1.0);
    if (hy > 0) heading(ctx, 'Neurobiologische Hypothese', 'Abgeschwächte NMDA-Signale?', hy, { color: C.warn });
    ctx.save();
    // Herauszoomen: Rezeptor wird zu einem Punkt auf einem Interneuron
    const sc = lerp(1.12, 0.16, zoomOut);
    ctx.translate(RX, MY); ctx.scale(sc, sc); ctx.translate(-RX, -MY);
    const RA = A * (1 - smoothstep(0.6, 1, zoomOut) * 0.2);
    drawMembrane(ctx, -400, W + 400, MY, { alpha: RA, t, gaps: [{ x: RX, w: 250 }], spacing: 16, thick: 40 });
    text(ctx, 'außen', 150, 380, { size: 26, weight: 600, color: C.textDim, font: 'text', alpha: A * (1 - zoomOut) });
    text(ctx, 'innen (Nervenzelle)', 190, 820, { size: 26, weight: 600, color: C.textDim, font: 'text', alpha: A * (1 - zoomOut) });
    // Rezeptor-Untereinheiten
    const asm = S.on('big', 1.6, ease.out);
    const gluB = S.on('two', 1.4, ease.inOut, 0.3), glyB = S.on('gly', 1.4, ease.inOut, 0.3);
    const enc = S.on('enc', 2.0), weak = S.on('weak', 1.5);
    const recDim = 1 - 0.4 * enc * (1 - S.on('hyp', 1.0)) - 0.35 * weak;
    const colA = '#5f86c9', colB = '#7fa6e6';
    subunit(ctx, RX - 110 - (1 - asm) * 300, 420, 760, 58, colA, RA * recDim, glyB, 1);
    subunit(ctx, RX - 48 - (1 - asm) * 200, 430, 770, 52, colB, RA * recDim * 0.9, gluB, -1);
    subunit(ctx, RX + 48 + (1 - asm) * 200, 430, 770, 52, colB, RA * recDim * 0.9, gluB, 1);
    subunit(ctx, RX + 110 + (1 - asm) * 300, 420, 760, 58, colA, RA * recDim, glyB, -1);
    // Liganden
    const gx0 = { x: 1500, y: 200 }, glx0 = { x: 420, y: 200 };
    const gP = S.on('two', 1.4, ease.inOut), yP = S.on('gly', 1.4, ease.inOut);
    if (gP > 0) { const x = lerp(gx0.x, RX + 50, gP), y = lerp(gx0.y, 462, gP); spark(ctx, x, y, 9, C.glu, RA); if (gP < 1) glow(ctx, x, y, 40, C.glu, RA * 0.5); }
    if (yP > 0) { const x = lerp(glx0.x, RX - 112, yP), y = lerp(glx0.y, 458, yP); spark(ctx, x, y, 8, '#f2f6ff', RA); }
    const gl = S.win('two', 'mg', 0.8, 0.8);
    if (gl > 0) callout(ctx, RX + 70, 450, 1380, 330, 'Glutamat', { p: gl, color: C.glu, size: 34, alpha: 1 - zoomOut });
    const yl = S.win('gly', 'mg', 0.8, 0.8);
    if (yl > 0) callout(ctx, RX - 130, 450, 520, 330, 'Glycin oder D-Serin', { p: yl, color: '#f2f6ff', size: 34, alpha: 1 - zoomOut });
    // Magnesium-Block
    const mgOut = S.on('mg', 1.6, ease.inOut, 1.2);
    const mx = RX, my = lerp(MY, 150, mgOut) + (mgOut > 0 ? 0 : Math.sin(t * 3) * 3);
    const mgA = RA * (1 - smoothstep(0.7, 1, mgOut)) * S.on('big', 1.0);
    dot(ctx, mx, my, 17, '#cfd6e4', mgA);
    text(ctx, 'Mg²⁺', mx, my + 1, { size: 15, weight: 700, color: '#1a2233', font: 'text', alpha: mgA });
    const ml = S.win('mg', 'ca', 0.8, 0.8);
    if (ml > 0) {
      for (let k = 0; k < 8; k++) text(ctx, '+', 700 + k * 75, 700 + Math.sin(t * 3 + k) * 6, { size: 34, weight: 700, color: C.warn, alpha: ml * S.on('mg', 0.8) * (1 - zoomOut) });
      callout(ctx, RX + 20, 620, 1330, 700, 'Magnesium gibt den Kanal frei', { p: ml, color: '#cfd6e4', size: 30, alpha: 1 - zoomOut });
      text(ctx, '… weil die Zelle bereits erregt ist', 1342, 745, { size: 24, weight: 500, color: C.warn, font: 'text', align: 'left', alpha: ml * (1 - zoomOut) });
    }
    // Calcium-Einstrom
    const ca = S.on('ca', 1.0);
    const ket = S.on('ket', 1.4, ease.inOut, 0.8);
    const flowK = ca * (1 - ket) * (1 - 0.65 * weak) + ca * ket * (1 - S.on('enc', 1.0)) * 0 + 0;
    if (ca > 0) {
      for (const c of CA) {
        const f = fract(t * 0.45 + c.d);
        const y = lerp(300, 900, f);
        let x = RX + c.dx;
        if (y > 700) x += c.spread * smoothstep(700, 900, y);
        const a = flowK * RA * Math.sin(Math.PI * f) * (weak > 0 ? (c.d < 1 - 0.65 * weak ? 1 : 0) : 1);
        spark(ctx, x, y, 3.2, C.ca, a);
      }
      const cl = S.win('ca', 'ket', 0.8, 0.8);
      if (cl > 0) callout(ctx, RX + 10, 800, 1300, 760, 'Calcium strömt ein', { p: cl, color: C.ca, size: 30, alpha: 1 - zoomOut });
    }
    // Lernen & Gedächtnis
    const le = S.win('learn', 'ket', 0.8, 0.8);
    if (le > 0) {
      glow(ctx, RX, 900, 380, C.ca, 0.18 * le * RA);
      ['Lernen', 'Gedächtnis', 'stabile Synapsen'].forEach((l, i) => badge(ctx, l, 560 + i * 400, 840, { color: C.ca, p: S.on('learn', 0.6, ease.out, i * 0.4), alpha: le * (1 - zoomOut), size: 26 }));
    }
    // Ketamin blockiert
    if (ket > 0) {
      const kx = lerp(1450, RX, ket), ky = lerp(250, MY - 40, ket);
      const kb = 1 - S.on('enc', 1.0);
      ctx.save(); ctx.translate(kx, ky); ctx.rotate(t * 0.5 * (1 - ket));
      for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU; dot(ctx, Math.cos(an) * 16, Math.sin(an) * 16, 7, '#c58ab5', RA * kb); }
      dot(ctx, 0, 0, 8, '#c58ab5', RA * kb);
      ctx.restore();
      const kl = S.win('ket', 'enc', 0.8, 0.8);
      if (kl > 0) callout(ctx, kx + 30, ky, 1350, 300, 'Ketamin blockiert den Kanal', { p: kl, color: '#e3a6d2', size: 30, alpha: 1 - zoomOut });
      const ps = S.win('psy', 'enc', 0.8, 0.8);
      if (ps > 0) badge(ctx, 'bei Gesunden: vorübergehend psychoseähnliche Zustände', 960, 230, { color: '#e3a6d2', p: ps, size: 26 });
    }
    // Antikörper (Autoimmunerkrankung)
    if (enc > 0) {
      const ea = 1 - S.on('hyp', 1.0);
      [[RX - 120, 350], [RX + 120, 350], [RX, 320]].forEach(([x, y], i) => {
        const k = S.on('enc', 1.2, ease.out, i * 0.3);
        icon(ctx, 'antibody', lerp(x + (i - 1) * 300, x, k), lerp(y - 200, y, k), 70, C.mg, RA * ea * k, t);
      });
      const el = S.win('enc2', 'hyp', 0.8, 0.8);
      if (el > 0) badge(ctx, 'Autoimmunerkrankung gegen NMDA-Rezeptoren: häufig psychotische Symptome', 960, 230, { color: C.mg, p: el, size: 24 });
    }
    // Abgeschwächtes Signal
    const wl = S.win('weak', 'inh', 0.8, 0.8);
    if (wl > 0) {
      const bx = 1540, by = 820;
      text(ctx, 'NMDA-Signal', bx, by - 190, { size: 26, weight: 600, color: C.text, font: 'text', alpha: wl });
      for (const [i, v, col] of [[0, 1, '#6fb0ff'], [1, 0.45, C.warn]]) {
        const h = 150 * (i === 1 ? lerp(1, v, S.on('weak', 1.5)) : v);
        ctx.save(); ctx.fillStyle = rgba(col, 0.85 * wl); roundRect(ctx, bx - 120 + i * 140, by - h, 80, h, 8); ctx.fill(); ctx.restore();
      }
      text(ctx, 'typisch', bx - 80, by + 28, { size: 22, weight: 500, color: C.textDim, font: 'text', alpha: wl });
      text(ctx, 'abgeschwächt?', bx + 60, by + 28, { size: 22, weight: 600, color: C.warn, font: 'text', alpha: wl });
    }
    ctx.restore();
    // Interneuron (nach dem Herauszoomen)
    if (zoomOut > 0) {
      const ia = zoomOut;
      const pts = catmull([{ x: 420, y: 700 }, { x: 700, y: 640 }, { x: 960, y: 600 }, { x: 1200, y: 560 }, { x: 1500, y: 520 }], 10);
      glowPath(ctx, pts, C.gaba, ia * 0.9, 12, 16);
      dot(ctx, 420, 700, 46, C.gaba, ia);
      glow(ctx, 420, 700, 160, C.gaba, 0.35 * ia);
      for (let k = 0; k < 6; k++) { const x = 560 + k * 170; const p = { x, y: 690 - (x - 420) * 0.12 }; dot(ctx, p.x, p.y - 14, 7, '#6fb0ff', ia * (1 - 0.5 * weak)); }
      text(ctx, 'hemmende Nervenzelle (Interneuron)', 420, 800, { size: 32, weight: 700, color: C.gaba, alpha: ia, reveal: ia });
      text(ctx, 'NMDA-Rezeptoren', 1240, 470, { size: 28, weight: 600, color: '#6fb0ff', alpha: ia, reveal: ia });
    }
    const cv = S.on('caveat', 1.0);
    if (cv > 0) {
      badge(ctx, 'HYPOTHESE – nicht: „NMDA-Mangel verursacht Schizophrenie“', 960, 250, { color: C.warn, p: cv, size: 26 });
      const pc = S.on('piece', 1.2);
      if (pc > 0) text(ctx, 'ein Baustein, der erklären könnte, warum Netzwerke aus dem Takt geraten', 960, 330, { size: 30, weight: 600, color: C.text, reveal: pc });
    }
  },
};
