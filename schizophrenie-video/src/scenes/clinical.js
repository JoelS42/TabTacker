// Szenen 21 + 22 – Frühe Zeichen (Prodrom) und Symptombereiche
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, strokePath, glowPath, fillPath, catmull, fract, noise2, mixColor, subPath, pointAt, smoothstep } from '../animation.js';
import { person, node, makeNetwork, drawNetwork } from './shared.js';

// ================================================================ prodrome
const PH = [
  { cue: 't1', label: 'normale Entwicklung', x: 280, color: C.neuron },
  { cue: 't2', label: 'subtile Veränderungen', x: 760, color: '#b9c3e0' },
  { cue: 't3', label: 'mögliche Vorphase (Prodrom)', x: 1230, color: C.warn },
  { cue: 't4', label: 'erste psychotische Episode', x: 1650, color: C.stress },
];
const TY = 330;
const SIGNS = [
  { cue: 'w1', label: 'sozialer Rückzug', x: 560, y: 520, pub: true },
  { cue: 'w2', label: 'deutlicher Leistungsabfall', x: 960, y: 520, pub: false },
  { cue: 'w3', label: 'Schlafprobleme', x: 1360, y: 520, pub: true },
  { cue: 'w4', label: 'Misstrauen', x: 760, y: 620, pub: false },
  { cue: 'w5', label: 'ungewöhnliche Wahrnehmungen', x: 1160, y: 620, pub: false },
];

export const prodrome = {
  id: 'prodrome',
  transition: { type: 'fade', dur: 1.6 },
  sfx: [['grow', 'tl', 0, 0.4], ['click', 't1', 0, 0.3], ['click', 't2', 0, 0.3], ['click', 't3', 0, 0.3], ['click', 't4', 0, 0.4], ['click', 'w1', 0, 0.3], ['click', 'w2', 0, 0.3], ['click', 'w3', 0, 0.3], ['click', 'w4', 0, 0.3], ['click', 'w5', 0, 0.3],
    ['low', 'unspec', 0, 0.4], ['chime', 'chr', 0.5, 0.3], ['chime', 'help', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.4, 1.2);
    heading(ctx, 'Klinik', 'Frühe Zeichen', S.on('tl', 1.2, ease.out), { color: C.warn });
    const tlA = A * (1 - 0.7 * S.on('chr', 1.0));
    const lp = tween(t, S.start - 0.4, S.cue('t4') - S.start + 0.8, ease.inOut);
    // Zeitachse mit Farbverlauf
    const g = ctx.createLinearGradient(PH[0].x, 0, PH[3].x, 0);
    g.addColorStop(0, rgba(C.neuron, tlA)); g.addColorStop(0.45, rgba('#b9c3e0', tlA)); g.addColorStop(0.75, rgba(C.warn, tlA)); g.addColorStop(1, rgba(C.stress, tlA));
    ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(PH[0].x, TY); ctx.lineTo(lerp(PH[0].x, PH[3].x, lp), TY); ctx.stroke(); ctx.restore();
    PH.forEach((ph, i) => {
      const p = S.on(ph.cue, 0.8, ease.outBack);
      if (p <= 0) return;
      glow(ctx, ph.x, TY, 60, ph.color, 0.35 * p * tlA);
      dot(ctx, ph.x, TY, 13 * p, ph.color, tlA);
      text(ctx, ph.label, ph.x, TY - 48, { size: 26, weight: 700, color: ph.color, alpha: tlA, reveal: S.on(ph.cue, 1.0) });
      if (i < 3) text(ctx, '↓ nicht zwangsläufig', (ph.x + PH[i + 1].x) / 2, TY + 34, { size: 18, weight: 500, color: C.textDim, font: 'text', alpha: tlA * S.on('t4', 1.0) * 0.9 });
    });
    const nf = S.win('tl', 't1', 0.8, 0.8, 0.3);
    if (nf > 0) statement(ctx, 'meist nicht über Nacht', 200, nf, { size: 44, color: C.textDim });
    // Warnzeichen
    const sg = S.on('signs', 1.0) * (1 - S.on('chr', 1.0));
    if (sg > 0) {
      text(ctx, 'mögliche Warnzeichen', 960, 440, { size: 26, weight: 600, color: C.textDim, font: 'text', spacing: 2, alpha: sg });
      const un = S.on('unspec', 1.0), pu = S.on('pub', 1.0);
      SIGNS.forEach((s) => {
        const p = S.on(s.cue, 0.8, ease.out);
        if (p <= 0) return;
        const col = pu > 0 && s.pub ? mixColor(C.warn, C.neuron, pu) : C.warn;
        badge(ctx, s.label, s.x, s.y, { color: col, p, alpha: sg, size: 26 });
        if (un > 0) text(ctx, 'unspezifisch', s.x, s.y + 38, { size: 18, weight: 600, color: C.textDim, font: 'text', alpha: sg * un });
      });
      if (pu > 0) badge(ctx, 'vieles davon kommt auch in der normalen Pubertät häufig vor', 960, 740, { color: C.neuron, p: pu, alpha: sg, size: 24 });
      const nm = S.on('notmean', 1.0);
      if (nm > 0) text(ctx, 'Nicht jede Veränderung bedeutet Schizophrenie.', 960, 820, { size: 34, weight: 700, alpha: sg, reveal: nm });
    }
    // Klinisch erhöhtes Risiko: ~1 von 4 in 3 Jahren
    const cr = S.on('chr', 1.2);
    if (cr > 0) {
      text(ctx, 'Jugendliche mit klinisch erhöhtem Psychoserisiko', 960, 470, { size: 30, weight: 700, alpha: cr, reveal: cr });
      for (let i = 0; i < 4; i++) {
        const x = 720 + i * 160, y = 620;
        const warm = i === 3 ? S.on('chr', 1.0, ease.out, 2.0) : 0;
        const cool = i < 3 ? S.on('maj', 1.0, ease.out, i * 0.15) : 0;
        person(ctx, x, y, 110 * ease.outBack(clamp(cr * 1.3 - i * 0.1)), warm > 0 ? mixColor('#7f9ee0', C.warn, warm) : mixColor('#7f9ee0', C.gaba, cool * 0.7), cr, 0.3 + warm * 0.4);
      }
      text(ctx, 'in Studien: etwa 1 von 4 innerhalb von 3 Jahren', 960, 760, { size: 30, weight: 700, color: C.warn, alpha: cr, reveal: S.on('chr', 1.2, ease.out, 2.0) });
      const mj = S.on('maj', 1.0);
      if (mj > 0) text(ctx, '3 von 4 nicht', 960, 806, { size: 30, weight: 700, color: C.gaba, alpha: cr, reveal: mj });
      text(ctx, 'Salazar de Pablo et al., JAMA Psychiatry 2021', 960, 845, { size: 18, weight: 500, color: C.textDim, font: 'text', alpha: cr * 0.9 });
      const hp = S.on('help', 1.0);
      if (hp > 0) badge(ctx, 'Veränderungen ernst nehmen · frühe Hilfe kann den Verlauf verbessern', 960, 405, { color: C.gaba, p: hp, size: 24 });
    }
  },
};

// ================================================================ symptoms
const CL = [
  { cue: 'pos', title: 'POSITIVSYMPTOME', sub: 'zusätzliche Erlebnisse', color: C.pos, x: 400, items: [['pos1', 'Wahn'], ['pos2', 'Halluzinationen, z. B. Stimmenhören'], ['pos3', 'desorganisiertes Denken']] },
  { cue: 'neg', title: 'NEGATIVSYMPTOME', sub: 'etwas geht verloren', color: C.neg, x: 960, items: [['neg1', 'sozialer Rückzug'], ['neg2', 'Antriebsminderung'], ['neg3', 'verminderter Gefühlsausdruck']] },
  { cue: 'cog', title: 'KOGNITIVE BEEINTRÄCHTIGUNGEN', sub: 'Denkleistungen', color: C.cog, x: 1520, items: [['cog1', 'Aufmerksamkeit'], ['cog2', 'Arbeitsgedächtnis'], ['cog3', 'Verarbeitungsgeschwindigkeit']] },
];
const R = rng(221);
const PTS = Array.from({ length: 90 }, (_, i) => ({ x: 960 + R.gauss() * 170, y: 360 + R.gauss() * 90, c: i % 3, ph: R() * 10 }));

export const symptoms = {
  id: 'symptoms',
  transition: { type: 'fade', dur: 1.6 },
  sfx: [['dissolve', 'split', 0.4, 0.5], ['chime', 'pos', 0, 0.3], ['chime', 'neg', 0, 0.3], ['chime', 'cog', 0, 0.3], ['whoosh', 'before', 0, 0.3]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.4, 1.2);
    heading(ctx, 'Klinik', 'Drei Symptombereiche', S.on('split', 1.2, ease.out), { color: C.pos });
    const sp = S.on('split', 2.4, ease.inOut, 0.6);
    // Netzwerk teilt sich in drei Bereiche
    const pos = PTS.map((p) => {
      const cl = CL[p.c];
      const tx = cl.x + (p.x - 960) * 0.45, ty = 300 + (p.y - 360) * 0.6;
      return { x: lerp(p.x, tx, sp) + noise2(p.ph, t * 0.3) * 6, y: lerp(p.y, ty, sp) + noise2(p.ph + 4, t * 0.3) * 6, c: p.c };
    });
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < Math.min(pos.length, i + 6); j++) {
        const a = pos[i], b = pos[j];
        const same = a.c === b.c;
        const al = A * (same ? 0.3 : 0.3 * (1 - sp));
        if (al > 0.01 && Math.hypot(a.x - b.x, a.y - b.y) < 220) strokePath(ctx, [a, b], same ? mixColor(C.neuron, CL[a.c].color, sp) : C.neuron, al, 1.2);
      }
    }
    pos.forEach((p) => { const col = mixColor(C.neuron, CL[p.c].color, sp); dot(ctx, p.x, p.y, 4, col, A); glow(ctx, p.x, p.y, 14, col, 0.3 * A); });
    CL.forEach((cl) => {
      const p = S.on(cl.cue, 1.0, ease.out);
      if (p <= 0) return;
      text(ctx, cl.title, cl.x, 470, { size: cl.title.length > 20 ? 26 : 30, weight: 700, color: cl.color, spacing: 2, alpha: A, reveal: p, glow: 0.3 });
      text(ctx, cl.sub, cl.x, 510, { size: 22, weight: 500, color: C.textDim, font: 'text', alpha: A * p });
      cl.items.forEach(([cue, lab], i) => {
        const q = S.on(cue, 0.8, ease.out);
        if (q <= 0) return;
        const y = 580 + i * 70;
        strokePath(ctx, subPath([{ x: cl.x, y: 380 }, { x: cl.x, y: y - 18 }], 0, q), cl.color, 0.25 * A, 1.5);
        dot(ctx, cl.x - 200, y, 6, cl.color, A * q);
        text(ctx, lab, cl.x - 184, y, { size: 26, weight: 600, color: C.text, align: 'left', alpha: A, reveal: q });
      });
    });
    const bf = S.on('before', 1.2);
    if (bf > 0) {
      const y = 820;
      strokePath(ctx, [{ x: 1120, y }, { x: lerp(1120, 1840, bf), y }], C.textDim, A * 0.6, 2);
      glowPath(ctx, [{ x: 1180, y }, { x: lerp(1180, 1640, bf), y }], C.cog, A * 0.9, 4, 8);
      dot(ctx, 1660, y, 10, C.stress, A * S.on('before', 0.6, ease.out, 1.0));
      text(ctx, 'kognitive Veränderungen: oft Jahre vorher', 1400, y - 30, { size: 22, weight: 600, color: C.cog, font: 'text', alpha: A, reveal: bf });
      text(ctx, 'erste Psychose', 1680, y + 30, { size: 20, weight: 600, color: C.stress, font: 'text', alpha: A * bf });
      const lk = S.on('link', 1.0);
      if (lk > 0) badge(ctx, 'ein weiterer Hinweis auf die Rolle der Entwicklung', 540, y, { color: C.text, p: lk, size: 24 });
    }
  },
};
