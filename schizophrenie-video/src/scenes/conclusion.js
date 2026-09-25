// Szenen 23 + 24 – Die große Zusammenfassung und Abschluss
import { W, H, C, TAU, clamp, lerp, ease, tween, rng, glow, spark, dot, text, rgba, heading, statement, badge, strokePath, glowPath, fillPath, catmull, fract, noise2, mixColor, subPath, pointAt, smoothstep, drawBrain, drawFigure, roundRect } from '../animation.js';
import { drawHelix, makeMicroglia, drawMicroglia, miniSynapse, makeNetwork, drawNetwork, icon, person } from './shared.js';

// ================================================================ summary
const MGS = makeMicroglia(31, { n: 7, size: 0.5 });
const LV = [
  { cue: 'L1', label: 'DNA', color: C.gen },
  { cue: 'L2', label: 'Gehirnentwicklung', color: C.neuron },
  { cue: 'L3', label: 'Synapsen', color: '#9fb6ff' },
  { cue: 'L4', label: 'Mikroglia', color: C.mg },
  { cue: 'L5', label: 'Glutamat', color: C.glu },
  { cue: 'L6', label: 'NMDA', color: '#6fb0ff' },
  { cue: 'L7', label: 'GABA', color: C.gaba },
  { cue: 'L8', label: 'Dopamin', color: C.da },
  { cue: 'L9', label: 'Stress', color: C.stress },
  { cue: 'L10', label: 'Mensch', color: C.text, off: 0.9 },
].map((l, i) => { const a = -Math.PI / 2 + (i / 10) * TAU; return { ...l, a, x: 960 + Math.cos(a) * 620, y: 470 + Math.sin(a) * 300 }; });

function levelIcon(ctx, i, x, y, a, t) {
  switch (i) {
    case 0: drawHelix(ctx, x - 44, x + 44, y, { amp: 16, turns: 1.4, phase: t, alpha: a, n: 50, glow: false }); break;
    case 1: ctx.save(); ctx.translate(x, y); ctx.scale(0.09, 0.09); drawBrain(ctx, { alpha: a, gyri: 0.4, fill: 0.4, lw: 16 }); ctx.restore(); break;
    case 2: miniSynapse(ctx, x, y + 4, 26, { alpha: a, t, active: 0.5 + 0.5 * Math.sin(t * 2) }); break;
    case 3: drawMicroglia(ctx, MGS, { x, y, t, alpha: a, reach: 0.8 }); break;
    case 4: for (let k = 0; k < 6; k++) spark(ctx, x + Math.cos(k + t) * 22, y + Math.sin(k * 1.7 + t) * 16, 3.5, C.glu, a); break;
    case 5: for (const dx of [-12, -4, 4, 12]) { ctx.save(); ctx.fillStyle = rgba('#6fb0ff', a); roundRect(ctx, x + dx - 3.5, y - 22, 7, 44, 3.5); ctx.fill(); ctx.restore(); } break;
    case 6: for (let k = 0; k < 6; k++) spark(ctx, x + Math.cos(k * 1.1 - t) * 22, y + Math.sin(k * 1.3 - t) * 16, 3.5, C.gaba, a); break;
    case 7: for (let k = 0; k < 6; k++) spark(ctx, x + Math.cos(k * 0.9 + t * 1.3) * 22, y + Math.sin(k * 2.1 + t) * 16, 3.5, C.da, a); break;
    case 8: icon(ctx, 'stress', x, y, 56, C.stress, a, t); break;
    case 9: person(ctx, x, y + 4, 60, C.text, a, 0.25); break;
    default:
  }
}

export const summary = {
  id: 'summary',
  transition: { type: 'zoomOut', dur: 2.0 },
  sfx: [['whooshOut', 'back', 0, 0.6], ['chime', 'L1', 0, 0.2], ['chime', 'L3', 0, 0.2], ['chime', 'L5', 0, 0.2], ['chime', 'L7', 0, 0.2], ['chime', 'L9', 0, 0.2], ['swell', 'connect', 0, 0.6], ['boom', 'schizo', 0, 0.8],
    ['click', 'n1', 0, 0.4], ['click', 'n2', 0, 0.4], ['click', 'n3', 0, 0.4], ['click', 'n4', 0, 0.4], ['swell', 'final', 0, 0.7]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.4, 1.2);
    const conv = S.on('schizo', 2.2, ease.inOut);
    const ringA = A * (1 - smoothstep(0.6, 1, conv));
    // Ebenen im Ring
    const P = LV.map((l) => {
      const p = Math.max(0.22 * tween(t, S.start - 0.4, 1.4), S.on(l.cue, 0.8, ease.outBack, l.off ?? 0));
      const x = lerp(l.x, 960, conv), y = lerp(l.y, 300, conv);
      return { ...l, p, x, y };
    });
    const cn = S.on('connect', 2.0, ease.inOut);
    if (cn > 0) {
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        if ((i + j) % 2 && j - i > 2) continue;
        const a = P[i], b = P[j];
        const mid = { x: lerp(a.x, b.x, 0.5) * 0.75 + 960 * 0.25, y: lerp(a.y, b.y, 0.5) * 0.75 + 470 * 0.25 };
        const pts = catmull([a, mid, b], 8);
        strokePath(ctx, subPath(pts, 0, cn), mixColor(a.color, b.color, 0.5), 0.42 * ringA, 1.6);
        const q = pointAt(pts, fract(t * 0.25 + i * 0.13 + j * 0.07));
        glow(ctx, q.x, q.y, 12, a.color, 0.6 * ringA * cn);
      }
    }
    P.forEach((l, i) => {
      if (l.p <= 0) return;
      glow(ctx, l.x, l.y, 90 * l.p, l.color, 0.25 * ringA);
      ctx.save(); ctx.fillStyle = rgba('#060b18', 0.8 * ringA); ctx.strokeStyle = rgba(l.color, ringA * 0.9); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(l.x, l.y, 58 * l.p, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(l.x, l.y, 56, 0, TAU); ctx.clip();
      levelIcon(ctx, i, l.x, l.y, ringA * l.p, t);
      ctx.restore();
      text(ctx, l.label, l.x, l.y + (l.y > 470 ? 86 : -84), { size: 24, weight: 700, color: l.color, alpha: ringA, reveal: l.p });
    });
    const bk = S.win('back', 'levels', 0.8, 0.8);
    if (bk > 0) statement(ctx, 'Ein Schritt zurück', 470, bk, { size: 56 });
    const cc = S.win('connect', 'schizo', 0.8, 0.6);
    if (cc > 0) statement(ctx, 'Alles ist miteinander verbunden.', 470, cc, { size: 44 });
    // Schizophrenie – Kernbotschaft
    if (conv > 0) {
      for (let k = 0; k < 60; k++) {
        const f = clamp(conv * 1.4 - (k % 10) * 0.04);
        const l = LV[k % 10];
        const x = lerp(l.x + noise2(k, 1) * 80, 960 + (k - 30) * 14, f), y = lerp(l.y + noise2(k, 2) * 60, 300, f);
        spark(ctx, x, y, 2.5, l.color, A * (1 - smoothstep(0.85, 1, f)) * conv);
      }
      const sa = S.on('schizo', 1.2, ease.out, 1.2);
      text(ctx, 'SCHIZOPHRENIE', 960, 250, { size: 96, weight: 700, spacing: 12, alpha: A, reveal: sa, glow: 0.8 });
      text(ctx, 'eine komplexe neuroentwicklungsbezogene Erkrankung', 960, 330, { size: 34, weight: 600, color: C.glu, alpha: A, reveal: S.on('schizo', 1.4, ease.out, 2.0) });
      const nots = ['Nicht eine Ursache.', 'Nicht ein Gen.', 'Nicht ein Neurotransmitter.', 'Nicht ein einzelner Umweltfaktor.'];
      nots.forEach((n, i) => {
        const p = S.on(`n${i + 1}`, 0.8, ease.out);
        if (p <= 0) return;
        const dim = i < 3 ? S.on(`n${i + 2}`, 0.8) * 0.5 : S.on('final', 0.8) * 0.5;
        text(ctx, n, 960, 430 + i * 58, { size: 40, weight: 600, color: C.textDim, alpha: A * (1 - dim), reveal: p });
      });
      const fi = S.on('final', 1.4, ease.out);
      if (fi > 0) {
        text(ctx, 'DAS ZUSAMMENSPIEL VIELER FAKTOREN', 960, 720, { size: 56, weight: 700, spacing: 3, alpha: A, reveal: fi, glow: 0.7 });
        text(ctx, 'ÜBER DIE ENTWICKLUNG HINWEG.', 960, 792, { size: 56, weight: 700, spacing: 3, color: C.glu, alpha: A, reveal: S.on('final', 1.4, ease.out, 0.8), glow: 0.7 });
      }
    }
  },
};

// ================================================================ conclusion
const FIG = { x: 560, y: 400, s: 0.56 };
const net = makeNetwork(241, { n: 240, brain: true, minD: 34, k: 3 });

export const conclusion = {
  id: 'conclusion',
  transition: { type: 'fade', dur: 2.0 },
  sfx: [['swell', 'life', 0, 0.5], ['chime', 'treat', 0, 0.3], ['chime', 'support', 0, 0.3], ['chime', 'talk', 0, 0.3], ['boom', 'end', 0, 0.7], ['swell', 'end', 1.0, 0.6]],
  draw(ctx, S) {
    const t = S.t;
    const A = tween(t, S.start - 0.5, 1.5);
    const endK = S.on('end', 1.6, ease.inOut);
    // Kamera: vom Gehirn zur Person
    const z = S.on('good', 4.0, ease.inOut);
    const fs = lerp(1.25, FIG.s, z), fx = lerp(1000, FIG.x, z), fy = lerp(720, FIG.y, z);
    const figA = A * (1 - 0.75 * endK);
    ctx.save(); ctx.translate(fx, fy); ctx.scale(fs, fs);
    drawFigure(ctx, { alpha: figA * z, fill: 0.7 });
    ctx.save(); ctx.translate(-40, -120); ctx.scale(0.9, 0.9);
    drawBrain(ctx, { alpha: figA, gyri: 0.5, fill: 0.35 });
    const stab = S.on('life', 3.0);
    drawNetwork(ctx, net, { t, zoom: fs * 0.9, alpha: figA, lw: 1.2, nodeR: 3, color: C.neuron, edgeColor: '#7f9ee0', density: lerp(1, 0.7, stab), strong: stab, pulses: 0.7, pulseColor: C.glu, nodeGlow: 0.3, straighten: stab * 0.5 });
    ctx.restore();
    ctx.restore();
    // Texte rechts
    const tx = 1160;
    const li = S.on('life', 1.2, ease.out) * (1 - endK);
    if (li > 0) {
      text(ctx, 'Das Gehirn entwickelt sich', tx, 170, { size: 44, weight: 700, align: 'left', alpha: li * (1 - S.on('treat', 1) * 0.5), reveal: li });
      text(ctx, 'ein Leben lang.', tx, 226, { size: 44, weight: 700, align: 'left', color: C.glu, alpha: li * (1 - S.on('treat', 1) * 0.5), reveal: S.on('life', 1.2, ease.out, 0.6) });
      const ad = S.on('adapt', 1.0);
      if (ad > 0) text(ctx, 'Es bleibt veränderbar.', tx, 280, { size: 30, weight: 600, align: 'left', color: C.textDim, font: 'text', alpha: ad * (1 - endK) });
    }
    const tr = S.on('treat', 1.0) * (1 - endK) * (1 - S.on('support', 0.8));
    if (tr > 0) {
      text(ctx, 'Schizophrenie ist behandelbar.', tx, 380, { size: 38, weight: 700, align: 'left', color: C.gaba, alpha: tr, reveal: tr });
      [['Psychotherapie', 'pill'], ['Medikamente', 'pill'], ['Unterstützung in Familie & Schule', 'heart']].forEach(([l], i) => {
        const p = S.on('tr2', 0.8, ease.out, i * 0.6);
        if (p > 0) badge(ctx, l, tx, 450 + i * 60, { color: C.gaba, p, size: 24, align: 'left', alpha: tr });
      });
      const t3 = S.on('tr3', 1.0);
      if (t3 > 0) text(ctx, 'Viele können Symptome deutlich verringern und gut leben.', tx, 650, { size: 24, weight: 600, align: 'left', color: C.text, font: 'text', alpha: t3 * tr, reveal: t3 });
    }
    const su = S.on('support', 1.0) * (1 - endK);
    if (su > 0) {
      text(ctx, 'Frühe Unterstützung ist wichtig.', tx, 400, { size: 38, weight: 700, align: 'left', color: C.glu, alpha: su, reveal: su });
      const tk = S.on('talk', 1.0);
      if (tk > 0) {
        icon(ctx, 'talk', tx + 30, 490, 60, C.text, tk * (1 - endK), t);
        text(ctx, 'darüber sprechen', tx + 90, 490, { size: 32, weight: 700, align: 'left', alpha: tk * (1 - endK), reveal: tk });
      }
      ['Vertrauenspersonen', 'Hausarztpraxis', 'Kinder- und Jugendpsychiatrie'].forEach((l, i) => {
        const p = S.on('talk2', 0.8, ease.out, i * 0.7);
        if (p > 0) badge(ctx, l, tx, 580 + i * 60, { color: C.text, p, size: 24, align: 'left', alpha: 1 - endK });
      });
    }
    // Schluss-Karte
    if (endK > 0) {
      text(ctx, 'RISIKO ≠ SCHICKSAL', 960, 380, { size: 110, weight: 700, spacing: 8, alpha: endK, reveal: S.on('end', 1.4, ease.out), glow: 1.0 });
      const hl = S.on('end', 1.5, ease.out, 2.5);
      if (hl > 0) {
        ctx.save(); ctx.strokeStyle = rgba(C.glu, 0.5 * hl); ctx.lineWidth = 1.5; ctx.fillStyle = rgba('#07101f', 0.8 * hl);
        roundRect(ctx, 460, 500, 1000, 200, 18); ctx.fill(); ctx.stroke(); ctx.restore();
        text(ctx, 'Hilfe & Beratung – kostenlos und anonym', 960, 540, { size: 26, weight: 700, color: C.glu, alpha: hl });
        text(ctx, 'Nummer gegen Kummer (Kinder- und Jugendtelefon): 116 111', 960, 588, { size: 24, weight: 600, font: 'text', alpha: hl });
        text(ctx, 'TelefonSeelsorge (rund um die Uhr): 0800 111 0 111 · 0800 111 0 222', 960, 628, { size: 24, weight: 600, font: 'text', alpha: hl });
        text(ctx, 'Im Notfall: 112', 960, 668, { size: 24, weight: 700, color: C.warn, font: 'text', alpha: hl });
      }
      const ft = S.on('end', 1.5, ease.out, 4.5);
      if (ft > 0) {
        text(ctx, 'Wissenschaftliches Erklärmodell – keine individuelle Diagnose.', 960, 770, { size: 24, weight: 600, color: C.textDim, font: 'text', alpha: ft });
        text(ctx, 'Quellen (Auswahl): Trubetskoy et al. 2022 · Sekar et al. 2016 · Howes & Kapur 2009 · Di Forti et al. 2019 · Zubin & Spring 1977 · S3-Leitlinie Schizophrenie (DGPPN 2025)', 960, 815, { size: 17, weight: 500, color: C.textDim, font: 'text', alpha: ft * 0.9 });
        text(ctx, 'Sprecherstimme: Sprachsynthese (SVOX Pico) · Animation: Vektorgrafik', 960, 848, { size: 17, weight: 500, color: C.textDim, font: 'text', alpha: ft * 0.8 });
      }
    }
  },
};
