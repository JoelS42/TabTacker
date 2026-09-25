// =====================================================================
//  timeline.js – zentrale Zeitachse
//  Die Zeiten stammen ausschließlich aus dem Voiceover (data/timings.js).
//  Jede Szene besitzt start, end, enter(), update(progress), exit()
//  und bekommt einen Kontext S mit cue-Zugriff (Wort-genaue Beats).
// =====================================================================
import { clamp, ease, tween, rng, smoothstep } from './animation.js';

export const missingCues = new Set();

export class Timeline {
  /**
   * @param timings  Inhalt von data/timings.json
   * @param modules  Szenenobjekte { id, draw(ctx,S), transition?, sfx?, enter?, exit? }
   */
  constructor(timings, modules) {
    this.timings = timings;
    this.duration = timings.duration;
    const byId = new Map(modules.map((m) => [m.id, m]));
    this.scenes = timings.scenes.map((sc, i) => {
      const mod = byId.get(sc.id);
      if (!mod) throw new Error(`Keine Szene für id "${sc.id}" gefunden`);
      return {
        index: i, id: sc.id, title: sc.title, start: sc.start, end: sc.end, mod,
        cues: timings.cues[sc.id] || {},
        sentences: timings.sentences.filter((s) => s.scene === sc.id),
        transition: { type: 'zoomIn', dur: 1.8, fx: 960, fy: 540, ...(mod.transition || {}) },
        active: false,
      };
    });
    // Weltreise-Parameter G(t): Zoom hinein (+1) / hinaus (−1) je Übergang
    this.travel = this.scenes.slice(1).map((sc) => ({
      t: sc.start, dur: sc.transition.dur,
      dir: sc.transition.type === 'zoomOut' ? -1 : sc.transition.type === 'fade' ? 0.35 : 1,
    }));
  }

  sceneIndexAt(t) {
    for (let i = this.scenes.length - 1; i >= 0; i--) if (t >= this.scenes[i].start) return i;
    return 0;
  }

  /** Globale Reisetiefe (für Hintergrund-Parallaxe) */
  travelAt(t) {
    let g = t * 0.012;
    for (const tr of this.travel) g += tr.dir * smoothstep(tr.t - tr.dur * 0.6, tr.t + tr.dur * 0.6, t);
    return g;
  }

  /**
   * Liefert die zu zeichnenden Szenen mit Mischgewicht und Übergangsparametern.
   * Übergänge liegen symmetrisch um die Szenengrenze (in der Sprechpause).
   */
  layersAt(t) {
    const i = this.sceneIndexAt(t);
    const cur = this.scenes[i];
    const out = [];
    const next = this.scenes[i + 1];
    const d0 = cur.transition.dur;
    if (i > 0 && t < cur.start + d0 / 2) {
      const prev = this.scenes[i - 1];
      const k = ease.sine(clamp((t - (cur.start - d0 / 2)) / d0));
      out.push({ scene: prev, weight: 1 - smoothstep(0.3, 1, k), phase: 'out', k, tr: cur.transition });
      out.push({ scene: cur, weight: smoothstep(0, 0.7, k), phase: 'in', k, tr: cur.transition });
      return out;
    }
    if (next && t > next.start - next.transition.dur / 2) {
      const d1 = next.transition.dur;
      const k = ease.sine(clamp((t - (next.start - d1 / 2)) / d1));
      out.push({ scene: cur, weight: 1 - smoothstep(0.3, 1, k), phase: 'out', k, tr: next.transition });
      out.push({ scene: next, weight: smoothstep(0, 0.7, k), phase: 'in', k, tr: next.transition });
      return out;
    }
    out.push({ scene: cur, weight: 1, phase: 'main', k: 1, tr: null });
    return out;
  }

  /** Szenen-Lebenszyklus: enter()/exit() einmalig, update(progress) pro Frame */
  lifecycle(t) {
    for (const sc of this.scenes) {
      const on = t >= sc.start - sc.transition.dur / 2 && t < sc.end + 1.2;
      if (on && !sc.active) { sc.active = true; sc.mod.enter?.(sc); }
      if (!on && sc.active) { sc.active = false; sc.mod.exit?.(sc); }
      if (on) sc.mod.update?.(clamp((t - sc.start) / (sc.end - sc.start)), sc);
    }
  }

  /** Szenen-Kontext für draw() */
  context(sc, t, layer) {
    const S = {
      id: sc.id, title: sc.title, t, start: sc.start, end: sc.end,
      dur: sc.end - sc.start, lt: t - sc.start,
      p: clamp((t - sc.start) / (sc.end - sc.start)),
      phase: layer.phase, k: layer.k,
      /** Übergang hinein: 0 → 1 */
      inT: layer.phase === 'in' ? layer.k : 1,
      /** Übergang hinaus: 0 → 1 */
      outT: layer.phase === 'out' ? layer.k : 0,
      sentences: sc.sentences,
      rng: rng(sc.index * 1013 + 7),
      cue(name) {
        const v = sc.cues[name];
        if (v === undefined) { missingCues.add(`${sc.id}:${name}`); return sc.end + 999; }
        return v;
      },
      /** Sekunden seit cue (+offset) */
      at(name, off = 0) { return t - (S.cue(name) + off); },
      /** 0..1 Animation ab cue */
      on(name, dur = 0.8, e = ease.inOut, off = 0) { return tween(t, S.cue(name) + off, dur, e); },
      /** 1..0 Ausblenden ab cue */
      off(name, dur = 0.6, e = ease.inOut, off = 0) { return 1 - tween(t, S.cue(name) + off, dur, e); },
      /** Sichtbarkeitsfenster: ein bei cue a, aus bei cue b */
      win(a, b, fin = 0.6, fout = 0.6, offA = 0, offB = 0) {
        const ta = typeof a === 'number' ? a : S.cue(a) + offA;
        const tb = typeof b === 'number' ? b : b ? S.cue(b) + offB : Infinity;
        return tween(t, ta, fin) * (1 - tween(t, tb, fout));
      },
      /** Zeit relativ zum Szenenstart */
      local: (x) => sc.start + x,
      /** Szenenende als Zeitpunkt (für Ausblendungen) */
      get endT() { return sc.end; },
    };
    return S;
  }

  /** Alle Soundeffekt-Ereignisse (für Audio-Mix beim Rendern) */
  sfxEvents() {
    const ev = [];
    for (let i = 0; i < this.scenes.length; i++) {
      const sc = this.scenes[i];
      if (i > 0) ev.push({ t: sc.start - sc.transition.dur * 0.45, type: sc.transition.type === 'zoomOut' ? 'whooshOut' : 'whoosh', gain: 0.55 });
      for (const e of sc.mod.sfx || []) {
        const [type, cue, off = 0, gain = 1] = e;
        const base = typeof cue === 'number' ? sc.start + cue : sc.cues[cue];
        if (base === undefined) { missingCues.add(`${sc.id}:${cue} (sfx)`); continue; }
        ev.push({ t: base + off, type, gain });
      }
    }
    return ev.sort((a, b) => a.t - b.t);
  }
}
