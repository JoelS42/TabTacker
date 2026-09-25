// Szene 5 – Akt II: Ein Netz aus Einflüssen (keine Checkliste, sondern dynamisches Netzwerk)
import { W, H, C, TAU, clamp, lerp, ease, tween, glow, spark, dot, text, rgba, heading, statement, badge, strokePath, glowPath, noise2, fract, catmull, subPath, pointAt, smoothstep } from '../animation.js';
import { node, dotGrid } from './shared.js';

const CEN = { x: 960, y: 480 };
const F = [
  { label: 'PRÄNATAL', cue: 'prenat', off: 0, color: '#d9a8ff', ang: -2.55 },
  { label: 'PERINATAL', cue: 'prenat', off: 0.8, color: '#e8b8ff', ang: -1.95 },
  { label: 'STRESS', cue: 'stress', off: 0, color: C.stress, ang: -1.25 },
  { label: 'TRAUMA', cue: 'trauma', off: 0, color: '#ff7a6b', ang: -0.6 },
  { label: 'SOZIALE BELASTUNGEN', cue: 'social', off: 0, color: '#ff9d7a', ang: 0.05 },
  { label: 'SUBSTANZEN', cue: 'subst', off: 0, color: C.thc, ang: 0.62 },
  { label: 'CANNABIS', cue: 'subst', off: 0.9, color: C.thc, ang: 1.2 },
  { label: 'IMMUNSYSTEM', cue: 'imm', off: 0, color: C.mg, ang: 1.95 },
  { label: 'ENTWICKLUNG', cue: 'imm', off: 1.0, color: C.myelin, ang: 2.6 },
].map((f) => ({ ...f, x: CEN.x + Math.cos(f.ang) * 610, y: CEN.y + Math.sin(f.ang) * 255 }));
const LINKS = [[2, 3], [3, 4], [2, 4], [6, 8], [7, 0], [1, 8], [5, 6], [0, 1]];
// Personen-Konstellationen (welche Faktoren vorhanden sind)
const CONFIGS = [[0, 2, 6], [1, 3, 4, 7], [2, 5, 8], [0, 4, 6, 7]];

export default {
  id: 'riskmap',
  transition: { type: 'zoomOut', dur: 1.8 },
  sfx: [['low', 'core', 0, 0.5], ['click', 'prenat', 0, 0.3], ['click', 'stress', 0, 0.3], ['click', 'trauma', 0, 0.3], ['click', 'social', 0, 0.3], ['click', 'subst', 0, 0.3], ['click', 'imm', 0, 0.3],
    ['chime', 'double', 0.2, 0.3], ['chime', 'double', 2.0, 0.3], ['swell', 'web', 0, 0.5]],
  draw(ctx, S) {
    const t = S.t;
    heading(ctx, 'Akt II · Einflüsse', 'Ein Netz aus Einflüssen', S.on('which', 1.2, ease.out) * (1 - S.on('double', 0.8)) + S.on('web', 1) * 0, { color: C.gen });
    const recede = S.on('double', 1.2) * (1 - S.on('web', 1.4));
    const netA = 1 - recede * 0.9;
    // Konstellations-Zyklus
    const cyc = S.on('notall', 0.8) * (1 - S.on('double', 0.8));
    const cfgIdx = Math.floor(Math.max(0, t - S.cue('notall')) / 1.6) % CONFIGS.length;
    const cfgK = fract(Math.max(0, t - S.cue('notall')) / 1.6);
    const present = (i) => {
      if (cyc <= 0) return 1;
      const on = CONFIGS[cfgIdx].includes(i) ? 1 : 0;
      const prevOn = CONFIGS[(cfgIdx + CONFIGS.length - 1) % CONFIGS.length].includes(i) ? 1 : 0;
      const v = lerp(prevOn, on, smoothstep(0, 0.25, cfgK));
      return lerp(1, lerp(0.12, 1, v), cyc);
    };
    const webK = S.on('web', 2.0);
    // Verbindungen Zentrum → Faktor
    F.forEach((f, i) => {
      const p = S.on(f.cue, 1.0, ease.out, f.off);
      if (p <= 0) return;
      const pr = present(i) * netA;
      const mid = { x: lerp(CEN.x, f.x, 0.5) + noise2(i, t * 0.3) * 60, y: lerp(CEN.y, f.y, 0.5) + noise2(i + 9, t * 0.3) * 60 };
      const pts = catmull([CEN, mid, f], 10);
      glowPath(ctx, subPath(pts, 0, p), f.color, 0.55 * pr, 1.6, 6);
      for (let k = 0; k < 3; k++) {
        const q = pointAt(pts, fract(t * 0.2 + k / 3 + i * 0.1) * p);
        glow(ctx, q.x, q.y, 10, f.color, 0.7 * pr);
      }
    });
    // Querverbindungen
    const lk = S.on('imm', 1.5, ease.inOut, 1.2) * netA;
    if (lk > 0) {
      LINKS.forEach(([a, b], j) => {
        const A = F[a], B = F[b];
        const pr = Math.min(present(a), present(b));
        const vis = lk * (0.5 + 0.5 * Math.sin(t * 0.7 + j * 1.7)) * (1 - webK) + webK;
        const mid = { x: (A.x + B.x) / 2 + noise2(j, t * 0.25) * 70, y: (A.y + B.y) / 2 + noise2(j + 3, t * 0.25) * 50 };
        strokePath(ctx, catmull([A, mid, B], 8), '#9fb3e6', 0.28 * vis * pr, 1.2);
      });
    }
    // Netz der Wahrscheinlichkeiten: zusätzliche feine Maschen
    if (webK > 0) {
      for (let i = 0; i < F.length; i++) for (let j = i + 2; j < F.length; j += 2) {
        const A = F[i], B = F[j];
        const mid = { x: lerp(A.x, B.x, 0.5) * 0.7 + CEN.x * 0.3, y: lerp(A.y, B.y, 0.5) * 0.7 + CEN.y * 0.3 };
        strokePath(ctx, catmull([A, mid, B], 8), C.gen, 0.14 * webK * (0.6 + 0.4 * Math.sin(t + i + j)), 1);
      }
    }
    // Zentrum
    const cp = Math.max(tween(t, S.start - 0.3, 1.2, ease.out) * 0.8, S.on('core', 1.0, ease.out));
    node(ctx, CEN.x, CEN.y, 54, C.gen, null, cp, { alpha: netA, glow: 0.6, fill: 0.5 });
    if (cp > 0) {
      text(ctx, 'GENETISCHE', CEN.x, CEN.y - 12, { size: 20, weight: 700, color: C.gen, spacing: 2, alpha: netA * cp, font: 'text' });
      text(ctx, 'VULNERABILITÄT', CEN.x, CEN.y + 14, { size: 20, weight: 700, color: C.gen, spacing: 2, alpha: netA * cp, font: 'text' });
      const c2 = S.win('core2', 'prenat', 0.8, 0.8, 0, 1.5);
      if (c2 > 0) text(ctx, 'erblich mitbedingte Verletzlichkeit', CEN.x, CEN.y + 100, { size: 28, weight: 600, color: C.text, alpha: c2 * netA, reveal: c2 });
    }
    // Faktor-Knoten
    F.forEach((f, i) => {
      const p = S.on(f.cue, 0.9, ease.out, f.off);
      if (p <= 0) return;
      const pr = present(i) * netA;
      const below = f.y > CEN.y + 50, above = f.y < CEN.y - 50;
      node(ctx, f.x, f.y, 13, f.color, f.label, p, { alpha: pr, size: 22, labelPos: above ? 'above' : below ? 'below' : f.x > CEN.x ? 'right' : 'left', labelColor: f.color, fill: 0.8 });
      // kleines „+“ – jeder Faktor erhöht das Risiko nur etwas
      const sm = S.win('small', 'double', 0.6, 0.6);
      if (sm > 0) text(ctx, '+', f.x + (f.x > CEN.x ? -30 : 30), f.y - 26, { size: 30, weight: 700, color: f.color, alpha: sm * pr });
    });
    const na = S.win('notall', 'small', 0.8, 0.5);
    if (na > 0) badge(ctx, 'Nicht jeder Faktor ist bei jeder Person vorhanden', W / 2, 840, { color: C.text, p: na, size: 24 });
    const sm2 = S.win('small', 'double', 0.8, 0.6, 0.5);
    if (sm2 > 0) badge(ctx, 'jeder einzelne: meist nur ein kleines Plus an Risiko', W / 2, 840, { color: C.warn, p: sm2, size: 24 });
    // Rechenbeispiel: 1.000 Menschen
    const dd = S.win('double', 'web', 1.0, 1.0);
    if (dd > 0) {
      const lit1 = [41, 188, 350, 507, 622, 781, 930];
      const lit2 = [95, 270, 433, 569, 700, 848, 977];
      dotGrid(ctx, 960, 470, 40, 25, 22, {
        alpha: dd, reveal: S.on('double', 1.4, ease.out), r: 4.6, color: '#4d6aa8', hlColor: C.warn,
        highlight: (i) => (lit1.includes(i) ? tween(t, S.cue('double') + 1.0, 0.6) : lit2.includes(i) ? tween(t, S.cue('double') + 2.6, 0.6) : 0),
      });
      text(ctx, 'Beispiel: 1.000 Menschen', 960, 150, { size: 26, weight: 600, color: C.textDim, font: 'text', spacing: 2, alpha: dd });
      const l1 = tween(t, S.cue('double') + 1.0, 0.8), l2 = tween(t, S.cue('double') + 2.6, 0.8);
      text(ctx, 'Grundrisiko ≈ 7', 700, 800, { size: 36, weight: 700, color: C.warn, alpha: dd * l1, reveal: l1 });
      text(ctx, '→  doppeltes Risiko ≈ 14', 1150, 800, { size: 36, weight: 700, color: C.warn, alpha: dd * l2, reveal: l2 });
      const mo = S.on('most', 1.0);
      if (mo > 0) text(ctx, '986 von 1.000 erkranken trotzdem nicht', 960, 860, { size: 34, weight: 700, color: C.gaba, alpha: dd * mo, reveal: mo, glow: 0.3 });
    }
    const wb = S.on('web2', 1.2, ease.out);
    if (wb > 0) statement(ctx, 'Ein Netz aus Wahrscheinlichkeiten', 150, wb, { size: 56, color: C.text });
    const wr = S.win('web', 'web2', 0.6, 0.6);
    if (wr > 0) statement(ctx, 'Kein Rezept.', 150, wr, { size: 56, color: C.textDim, alpha: wr });
  },
};
