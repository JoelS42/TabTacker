// Szenen 3 + 4 – Neuroentwicklungsmodell (Zeitachse) und Kindheit → Adoleszenz → junges Erwachsenenalter
import {
  W, H, C, TAU, clamp, lerp, ease, tween, glow, spark, dot, text, rgba, drawBrain, heading, statement, callout, badge,
  strokePath, fillPath, glowPath, subPath, pointAt, noise2, catmull, smoothstep, fract, roundRect, rng, BRAIN_REGIONS, mixColor,
} from '../animation.js';
import { makeNetwork, drawNetwork, flow, node } from './shared.js';

// ================================================================ neurodev
const AX = { y: 720 };
function ageX(a) {
  if (a < 0) return lerp(170, 470, (a + 0.75) / 0.75);
  if (a < 12) return lerp(470, 960, a / 12);
  if (a < 20) return lerp(960, 1370, (a - 12) / 8);
  return lerp(1370, 1760, clamp((a - 20) / 10));
}
const syn = (a) => (a < 2 ? smoothstep(-0.55, 2, a) : a < 7 ? 1 : lerp(1, 0.6, smoothstep(7, 21, a)));
const myel = (a) => Math.pow(smoothstep(-0.3, 27, a), 0.75);
const AGES = Array.from({ length: 241 }, (_, i) => -0.75 + (i / 240) * 30.75);
const synCurve = AGES.map((a) => ({ x: ageX(a), y: AX.y - 40 - syn(a) * 280 }));
const myCurve = AGES.map((a) => ({ x: ageX(a), y: AX.y - 40 - myel(a) * 250 }));
const R0 = rng(5);
const ROOTS = Array.from({ length: 6 }, (_, i) => {
  const x0 = lerp(1400, 1700, i / 5), y0 = AX.y + 18;
  const pts = [{ x: x0, y: y0 }];
  let x = x0, y = y0;
  for (let k = 0; k < 9; k++) { x -= lerp(120, 150, R0()); y += k === 0 ? 70 : R0.range(-8, 14); y = clamp(y, 820, 885); pts.push({ x, y }); }
  pts.push({ x: lerp(190, 420, R0()), y: lerp(780, 860, R0()) });
  return catmull(pts, 6);
});
const miniDense = makeNetwork(41, { n: 42, rect: { x: 560, y: 165, w: 300, h: 135 }, minD: 18, k: 5 });
const miniPruned = makeNetwork(41, { n: 42, rect: { x: 1020, y: 165, w: 300, h: 135 }, minD: 18, k: 5 });

export const neurodev = {
  id: 'neurodev',
  transition: { type: 'fade', dur: 1.6 },
  sfx: [['chime', 'roots', 0, 0.3], ['click', 'prenatal', 0, 0.4], ['click', 'childhood', 0, 0.4], ['click', 'adol', 0, 0.4], ['swell', 'window', 0, 0.6], ['click', 'wrong', 1.2, 0.5], ['whoosh', 'model', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    const base = tween(t, S.start - 0.4, 1.5) * (1 - 0.72 * S.on('wrong', 1.0));
    heading(ctx, 'Akt I · Entwicklung', 'Neuroentwicklungsmodell', S.on('ndd', 1.2, ease.out) * (1 - S.on('wrong', 1)), { color: C.myelin });
    // Achse
    const axp = tween(t, S.start, 2.0, ease.inOut);
    strokePath(ctx, [{ x: 150, y: AX.y }, { x: lerp(150, 1790, axp), y: AX.y }], C.textDim, base * 0.9, 2.5);
    const segs = [
      { a0: -0.75, a1: 0, label: 'vor der Geburt', cue: 'prenatal', color: C.gen },
      { a0: 0, a1: 12, label: 'Kindheit', cue: 'childhood', color: C.glu },
      { a0: 12, a1: 20, label: 'Jugend', cue: 'adol', color: C.mg },
      { a0: 20, a1: 30, label: 'Erwachsenenalter', cue: null, color: C.neuron },
    ];
    for (const sg of segs) {
      const x0 = ageX(sg.a0), x1 = ageX(sg.a1);
      const hl = sg.cue ? S.win(sg.cue, null, 0.7) * (1 - S.on('window', 1) * 0.6) : 0;
      if (hl > 0) {
        const g = ctx.createLinearGradient(0, AX.y - 360, 0, AX.y);
        g.addColorStop(0, rgba(sg.color, 0)); g.addColorStop(1, rgba(sg.color, 0.16 * hl * base));
        ctx.fillStyle = g; ctx.fillRect(x0, AX.y - 360, x1 - x0, 360);
      }
      strokePath(ctx, [{ x: x0 + 6, y: AX.y }, { x: x1 - 6, y: AX.y }], sg.color, base * (0.35 + 0.65 * hl), 5);
      text(ctx, sg.label, (x0 + x1) / 2, AX.y + 40, { size: 26, weight: 600, color: hl > 0.3 ? sg.color : C.textDim, font: 'text', alpha: base * axp });
    }
    for (const a of [0, 6, 12, 18, 25, 30]) {
      const x = ageX(a);
      strokePath(ctx, [{ x, y: AX.y - 6 }, { x, y: AX.y + 6 }], C.textDim, base * axp, 2);
      text(ctx, a === 0 ? 'Geburt' : `${a} J.`, x, AX.y + 76, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: base * axp * 0.8 });
    }
    // Kurven
    const sp = tween(t, S.cue('prenatal'), S.cue('adol') - S.cue('prenatal') + 2.5, ease.inOut);
    glowPath(ctx, subPath(synCurve, 0, sp), C.glu, base * 0.95, 3, 10);
    glowPath(ctx, subPath(myCurve, 0, sp * 0.98), C.myelin, base * 0.8, 2.5, 8);
    if (sp > 0.25) {
      text(ctx, 'Synapsendichte', ageX(3.2), AX.y - 350, { size: 26, weight: 600, color: C.glu, alpha: base * smoothstep(0.25, 0.4, sp) });
      text(ctx, 'Myelin', ageX(27), AX.y - 330, { size: 26, weight: 600, color: C.myelin, alpha: base * smoothstep(0.85, 1, sp) });
    }
    // Mini-Illustrationen
    const pr = S.win('prenatal', 'wrong', 0.8, 0.8);
    if (pr > 0) {
      for (let i = 0; i < 7; i++) {
        const x = lerp(200, 440, i / 6);
        strokePath(ctx, [{ x, y: 300 }, { x: x + 8, y: 170 }], C.gen, pr * 0.35, 1.5);
        const f = fract(t * 0.18 + i * 0.37);
        spark(ctx, lerp(x, x + 8, f), lerp(300, 170, f), 3.5, C.gen, pr * Math.sin(Math.PI * f));
      }
      text(ctx, 'Nervenzellen wandern', 320, 332, { size: 22, weight: 600, color: C.gen, font: 'text', alpha: pr });
    }
    const ch = S.win('childhood', 'wrong', 0.8, 0.8);
    if (ch > 0) {
      drawNetwork(ctx, miniDense, { t, alpha: ch, lw: 1.1, nodeR: 3, color: C.neuron, edgeColor: C.glu, density: 1, pulses: 0.5 });
      text(ctx, 'viele Verbindungen', 710, 332, { size: 22, weight: 600, color: C.glu, font: 'text', alpha: ch });
    }
    const ad = S.win('adol', 'wrong', 0.8, 0.8);
    if (ad > 0) {
      drawNetwork(ctx, miniPruned, { t, alpha: ad, lw: 1.1, nodeR: 3, color: C.neuron, edgeColor: C.mg, density: lerp(1, 0.45, S.on('adol', 2.5)), strong: S.on('adol', 2.5), pulses: 0.5, pulseColor: C.mg });
      text(ctx, 'Umbau & Verfeinerung', 1170, 332, { size: 22, weight: 600, color: C.mg, font: 'text', alpha: ad });
    }
    // Wurzeln
    const rt = S.on('roots', 3.0, ease.inOut) * (1 - S.on('wrong', 1)) * (1 - 0.6 * S.on('prenatal', 1.5));
    if (rt > 0) {
      ROOTS.forEach((r, i) => glowPath(ctx, subPath(r, 0, clamp(rt * 1.2 - i * 0.04)), C.gen, 0.55 * rt, 1.8, 7));
      text(ctx, 'Wurzeln reichen bis vor die Geburt zurück', 960, 872, { size: 24, weight: 600, color: C.gen, font: 'text', alpha: rt * S.win('roots', 'prenatal', 1, 1, 0.8, 1.5) });
    }
    // Zeitfenster 15–30
    const wi = S.on('window', 1.2) * (1 - S.on('wrong', 1));
    if (wi > 0) {
      const x0 = ageX(15), x1 = ageX(30);
      ctx.fillStyle = rgba(C.warn, 0.12 * wi); ctx.fillRect(x0, AX.y - 400, (x1 - x0) * ease.out(wi), 400);
      strokePath(ctx, [{ x: x0, y: AX.y - 400 }, { x: x0, y: AX.y }], C.warn, wi * 0.8, 2);
      text(ctx, 'häufigster Erkrankungsbeginn', (x0 + x1) / 2, AX.y - 120, { size: 28, weight: 700, color: C.warn, reveal: wi });
      text(ctx, '≈ 15 – 30 Jahre', (x0 + x1) / 2, AX.y - 80, { size: 24, weight: 600, color: C.warn, font: 'text', reveal: S.on('window', 1.2, ease.out, 0.4) });
    }
    // Falsch: Fehler → Krankheit
    const wr = S.win('wrong', 'model', 0.7, 0.6);
    if (wr > 0) {
      node(ctx, 700, 440, 16, C.textDim, 'ein Fehler', S.on('wrong', 0.8), { size: 34, labelPos: 'above' });
      strokePath(ctx, [{ x: 740, y: 440 }, { x: lerp(740, 1170, S.on('wrong', 0.8, ease.inOut, 0.3)), y: 440 }], C.textDim, wr, 3);
      node(ctx, 1220, 440, 16, C.textDim, 'krank', S.on('wrong', 0.8, ease.out, 0.6), { size: 34, labelPos: 'above' });
      const sk = S.on('wrong', 0.6, ease.inOut, 1.5);
      strokePath(ctx, [{ x: 640, y: 480 }, { x: lerp(640, 1290, sk), y: 380 }], C.stress, wr, 6);
      text(ctx, 'zu einfach', 960, 560, { size: 30, weight: 700, color: C.stress, alpha: wr, reveal: sk });
    }
    // Modell: frühe Einflüsse → Entwicklung → mögliche Wege
    const mo = S.on('model', 1.2);
    if (mo > 0) {
      const a = mo;
      node(ctx, 330, 460, 20, C.gen, 'frühe Einflüsse', S.on('model', 0.8, ease.out), { size: 28, labelPos: 'below' });
      const p1 = catmull([{ x: 355, y: 460 }, { x: 600, y: 440 }, { x: 800, y: 460 }], 8);
      glowPath(ctx, subPath(p1, 0, S.on('model', 1.2, ease.inOut, 0.4)), C.gen, a, 3, 8);
      node(ctx, 830, 460, 20, C.glu, 'veränderte Entwicklung', S.on('model', 0.8, ease.out, 1.2), { size: 28, labelPos: 'below' });
      const lt = S.on('later', 2.0, ease.inOut);
      const outs = [
        { y: 300, w: 9, label: 'keine Erkrankung', color: C.neuron },
        { y: 460, w: 5, label: 'leichte Auffälligkeiten', color: C.neuron },
        { y: 620, w: 2.5, label: 'Psychose', color: C.warn },
      ];
      outs.forEach((o, i) => {
        const pts = catmull([{ x: 855, y: 460 }, { x: 1050, y: lerp(460, o.y, 0.3) }, { x: 1250, y: o.y }, { x: 1440, y: o.y }], 10);
        glowPath(ctx, subPath(pts, 0, clamp(lt * 1.3 - i * 0.1)), o.color, a * 0.9, o.w, 10);
        flow(ctx, pts, t, { n: 5, speed: 0.25, color: o.color, r: 2.5, alpha: lt * a, limit: 1 });
        text(ctx, o.label, 1470, o.y, { size: 30, weight: 600, color: o.color, align: 'left', reveal: clamp(lt * 1.3 - 0.3 - i * 0.1) });
      });
      text(ctx, 'weitere Faktoren über viele Jahre', 1140, 720, { size: 26, weight: 600, color: C.textDim, font: 'text', reveal: lt });
      text(ctx, 'Linienstärke = Häufigkeit (schematisch)', 1140, 760, { size: 20, weight: 500, color: C.textDim, font: 'text', alpha: 0.8 * lt });
    }
  },
};

// ================================================================ development
const devNet = makeNetwork(52, { n: 150, rect: { x: 300, y: 250, w: 1260, h: 560 }, minD: 62, k: 6 });
const DAX = { y: 540, x0: 260, x1: 1720 };
const MY = Array.from({ length: 7 }, (_, i) => ({ x0: 420 + i * 185, x1: 420 + i * 185 + 150 }));

function axonLine(y, x0, x1, t, wig = 6) {
  const pts = [];
  for (let i = 0; i <= 60; i++) { const x = lerp(x0, x1, i / 60); pts.push({ x, y: y + Math.sin(i * 0.35 + 1) * wig }); }
  return pts;
}

export const development = {
  id: 'development',
  transition: { type: 'zoomIn', dur: 1.8, fromX: ageX(5), fromY: 300 },
  sfx: [['grow', 'child', 0, 0.5], ['chime', 'peak', 0, 0.3], ['click', 'strong', 0, 0.5], ['dissolve', 'weak', 0, 0.6], ['whoosh', 'axon', 0, 0.6],
    ['wrap', 'myelin', 0, 0.5], ['impulse', 'speed', 0.5, 0.5], ['impulse', 'speed', 1.4, 0.5], ['whooshOut', 'late', 0, 0.5], ['swell', 'plastic', 0, 0.4]],
  draw(ctx, S) {
    const t = S.t;
    // ---------------- Netzwerk-Entwicklung
    const netA = tween(t, S.start - 0.5, 1.2) * (1 - S.on('axon', 1.2));
    if (netA > 0) {
      const stage = S.cue('teen') <= t ? (S.cue('adult') <= t ? 2 : 1) : 0;
      const labels = ['KINDHEIT', 'JUGEND', 'JUNGES ERWACHSENENALTER'];
      const colors = [C.glu, C.mg, C.neuron];
      const stT = [S.start, S.cue('teen'), S.cue('adult')][stage];
      const la = tween(t, stT, 0.8, ease.out);
      text(ctx, labels[stage], 960, 150, { size: 40, weight: 700, spacing: 8, color: colors[stage], alpha: netA, reveal: la, glow: 0.3 });
      const dens = lerp(1, 0.42, S.on('weak', 3.0, ease.inOut));
      const strong = S.on('strong', 2.0);
      const order = S.on('adult', 2.5);
      drawNetwork(ctx, devNet, {
        t, alpha: netA, lw: 1.6, nodeR: 5, color: C.neuron, edgeColor: mixColor('#7f9ee0', C.glu, 0.3), grow: tween(t, S.cue('child') - 0.5, 4.5, ease.out),
        density: dens, strong, pulses: 0.35 + 0.6 * order, pulseColor: C.glu, wobble: 0.1 * (1 - order), nodeGlow: 0.35, pulseSpeed: 1 + order, straighten: order,
      });
      // Synapse hervorheben
      const sy = S.win('syn', 'teen', 0.6, 0.6);
      if (sy > 0) {
        const e = devNet.edges[14];
        const mx = (e.a.x + e.b.x) / 2 * 0.5 + e.cx * 0.5, my = (e.a.y + e.b.y) / 2 * 0.5 + e.cy * 0.5;
        glow(ctx, e.b.x, e.b.y, 40, C.glu, sy * 0.8);
        callout(ctx, e.b.x, e.b.y, e.b.x + 180, e.b.y - 90, 'Synapse = Kontaktstelle', { p: sy, color: C.glu, size: 30 });
      }
      // Dichte-Anzeige
      const bx = 1760, by0 = 800, bh = 460;
      const level = lerp(0, 1, tween(t, S.cue('child'), 4)) * dens;
      strokePath(ctx, [{ x: bx, y: by0 }, { x: bx, y: by0 - bh }], C.textDim, netA * 0.4, 12);
      strokePath(ctx, [{ x: bx, y: by0 }, { x: bx, y: by0 - bh * level }], C.glu, netA, 12);
      text(ctx, 'Synapsen', bx, by0 + 36, { size: 22, weight: 600, color: C.textDim, font: 'text', alpha: netA });
      const pk = S.win('peak', 'teen', 0.6, 0.6);
      if (pk > 0) text(ctx, 'höher als bei Erwachsenen', bx - 30, by0 - bh + 20, { size: 26, weight: 600, color: C.glu, align: 'right', reveal: pk, alpha: pk });
      const st = S.win('strong', 'adult', 0.6, 0.6);
      if (st > 0) badge(ctx, 'genutzt → verstärkt', 520, 880, { color: C.glu, p: st, size: 24 });
      const wk = S.win('weak', 'adult', 0.6, 0.6);
      if (wk > 0) badge(ctx, 'selten genutzt → abgebaut', 1360, 880, { color: C.textDim, p: wk, size: 24 });
      const fw = S.win('fewer', 'axon', 0.6, 0.6);
      if (fw > 0) badge(ctx, 'weniger Verbindungen', 620, 880, { color: C.neuron, p: fw, size: 24 });
      const bt = S.win('better', 'axon', 0.6, 0.6);
      if (bt > 0) badge(ctx, 'besser organisiert', 1300, 880, { color: C.glu, p: bt, size: 24 });
    }
    // ---------------- Axon und Myelin
    const axA = S.on('axon', 1.2) * (1 - S.on('late', 1.2));
    if (axA > 0) {
      const split = S.on('speed', 1.4);
      const yTop = lerp(DAX.y, 400, split), yBot = lerp(DAX.y, 680, split);
      const grow = S.on('axon', 2.5, ease.out);
      // Neuron-Körper
      for (const [yy, a] of [[yBot, 1], [yTop, split]]) {
        if (a <= 0) continue;
        glow(ctx, DAX.x0 - 30, yy, 90, C.neuron, 0.35 * axA * a);
        dot(ctx, DAX.x0 - 30, yy, 30, C.neuron, axA * a);
        glowPath(ctx, subPath(axonLine(yy, DAX.x0, DAX.x1, t), 0, grow), C.neuron, axA * a, 5, 10);
      }
      // Myelinscheiden (nur untere Leitung)
      const mp = S.on('myelin', 3.5, ease.inOut);
      MY.forEach((m, i) => {
        const k = clamp(mp * 1.6 - i * 0.1);
        if (k <= 0) return;
        const cx = (m.x0 + m.x1) / 2, hw = ((m.x1 - m.x0) / 2) * ease.out(k);
        ctx.save();
        ctx.fillStyle = rgba(C.myelin, 0.85 * axA);
        roundRect(ctx, cx - hw, yBot - 17, hw * 2, 34, 17); ctx.fill();
        ctx.strokeStyle = rgba('#c9b894', 0.8 * axA); ctx.lineWidth = 1.4;
        for (let s = -hw + 14; s < hw - 8; s += 13) { ctx.beginPath(); ctx.moveTo(cx + s, yBot - 15); ctx.quadraticCurveTo(cx + s + 6, yBot, cx + s, yBot + 15); ctx.stroke(); }
        ctx.restore();
        glow(ctx, cx, yBot, 70, C.myelin, 0.12 * axA * k);
      });
      if (S.on('myelin2', 1) > 0) callout(ctx, MY[3].x0 + 70, yBot - 18, MY[3].x0 + 260, yBot - 150, 'Myelin: fettreiche Isolierschicht', { p: S.on('myelin2', 1.0) * (1 - split), color: C.myelin, size: 30 });
      text(ctx, 'Axon', DAX.x0 + 60, yBot + 60, { size: 26, weight: 600, color: C.textDim, font: 'text', alpha: axA * (1 - split) * grow });
      // Signal-Vergleich
      if (split > 0) {
        text(ctx, 'ohne Myelin', DAX.x0 + 20, yTop - 60, { size: 28, weight: 700, color: C.textDim, align: 'left', alpha: split * axA });
        text(ctx, 'mit Myelin: schneller, zuverlässiger', DAX.x0 + 20, yBot - 60, { size: 28, weight: 700, color: C.myelin, align: 'left', alpha: split * axA });
        const tt = Math.max(0, t - S.cue('speed') - 0.5);
        const fTop = fract(tt * 0.22);
        spark(ctx, lerp(DAX.x0, DAX.x1, fTop), yTop, 7, C.glu, split * axA);
        const fb = fract(tt * 0.6);
        const idx = Math.floor(fb * (MY.length + 1));
        const nodeX = [DAX.x0, ...MY.map((m) => m.x1 + 17)];
        const jx = nodeX[Math.min(idx, nodeX.length - 1)];
        spark(ctx, jx, yBot, 9, C.glu, split * axA);
        glow(ctx, jx, yBot, 60, C.glu, 0.4 * split * axA);
      }
    }
    // ---------------- Präfrontaler Kortex reift spät
    const br = S.on('late', 1.5);
    if (br > 0) {
      ctx.save();
      ctx.translate(900, 520); ctx.scale(0.78, 0.78);
      drawBrain(ctx, { alpha: br, draw: S.on('late', 2.2), gyri: 0.8, fill: 0.5 });
      const pf = BRAIN_REGIONS.pfc;
      const pulse = 0.8 + 0.2 * Math.sin(t * 2.5);
      glow(ctx, pf.x + 40, pf.y + 20, 260 * pulse, C.warn, 0.35 * br);
      glow(ctx, pf.x + 40, pf.y + 20, 110, '#ffffff', 0.12 * br);
      // Plastizität: sanft pulsierende Verbindungen
      const pl = S.on('plastic', 1.2);
      if (pl > 0) {
        for (let i = 0; i < 26; i++) {
          const a0 = i * 0.9, r0 = 60 + (i % 5) * 45;
          const p = { x: -60 + Math.cos(a0) * r0 * 1.5, y: -80 + Math.sin(a0) * r0 * 0.8 };
          const q = { x: -60 + Math.cos(a0 + 1.3 + Math.sin(t * 0.6 + i) * 0.4) * r0 * 1.4, y: -80 + Math.sin(a0 + 1.3 + Math.sin(t * 0.6 + i) * 0.4) * r0 * 0.75 };
          strokePath(ctx, [p, q], C.glu, pl * 0.35 * (0.5 + 0.5 * Math.sin(t * 1.5 + i)), 2.5);
        }
      }
      ctx.restore();
      const pfS = { x: 900 + (BRAIN_REGIONS.pfc.x + 40) * 0.78, y: 520 + (BRAIN_REGIONS.pfc.y + 20) * 0.78 };
      callout(ctx, pfS.x, pfS.y, 330, 250, 'Präfrontaler Kortex', { p: S.on('late', 1.2, ease.out, 0.5) * (1 - S.on('plastic', 0.8)), color: C.warn, size: 34 });
      const tag = S.win('late', 'plastic', 0.8, 0.8, 1.2);
      if (tag > 0) text(ctx, 'reift bis etwa Mitte 20', 330, 300, { size: 26, weight: 600, color: C.text, font: 'text', align: 'right', alpha: tag, reveal: tag });
      const chips = [['Planung', 'late', 1.6], ['Arbeitsgedächtnis', 'wm', 0], ['Selbststeuerung', 'self', 0]];
      chips.forEach(([lab, cue, off], i) => {
        const p = S.win(cue, 'plastic', 0.6, 0.8, off);
        if (p > 0) badge(ctx, lab, 1500, 380 + i * 90, { color: C.warn, p, size: 26 });
      });
      const pl2 = S.on('plastic', 1.0);
      if (pl2 > 0) statement(ctx, 'hochgradig formbar', 170, pl2, { size: 56, color: C.glu });
      const st = S.on('strength', 0.8);
      if (st > 0) badge(ctx, 'große Stärke', 760, 900, { color: C.gaba, p: st, size: 28 });
      const se = S.on('sens', 0.8);
      if (se > 0) badge(ctx, 'sensible Phase für Einflüsse', 1160, 900, { color: C.warn, p: se, size: 28 });
    }
  },
};
