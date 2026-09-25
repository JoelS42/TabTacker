#!/usr/bin/env python3
"""
Musik + Sounddesign + Mischung – vollständig prozedural, lizenzfrei, deterministisch.

Eingaben : audio/narration.wav, data/timings.json, data/sfx_events.json
Ausgaben : audio/music.wav, audio/sfx.wav (geduckte Stems, 16 bit mit TPDF-Dither),
           audio/mix.wav (24 bit), audio/narration.mp3, music.mp3, sfx.mp3 (Browser-Vorschau)

Musik
  • Harmonie folgt der Dramaturgie: jeder Akt hat eine eigene Tonart und Klangfarbe
      Prolog d-Moll → I F-Dur (lydisch) → II a-Moll → III e-Moll → IV G/D-Dur (Szenenfarben)
      → V c-Moll → VI g-Moll/B-Dur → VII D-Dur (aufgehellte Rückkehr zum Anfangston).
    Akkordwechsel liegen auf Sprecher-Cues (Überblendung um den Cue zentriert), große Momente
    (Titel, „Es wird umgebaut“, System, Lebenswege, Zusammenfassung, Ende) bekommen Riser + Ankunft.
  • Stimmführung automatisch (minimale Bewegung, gemeinsame Töne bleiben liegen → kein Neuanschlag).
  • Klang: bandbegrenzte Wavetable-Oszillatoren (Teiltöne < 16 kHz → kein Aliasing), Equal-Power-
    Hüllkurven mit weichem Einsatz → keine Knackser; leichte Verstimmung + Drift für Breite und Leben.
  • Schichten: Pad, Bass, Arpeggio (Instrument/Muster je Szene), Puls (nur Adoleszenz/Aufbauten/Stress),
    Luft, Schimmer, Riser + Vor-Schwell + Bloom, Leitmotiv (Prolog, Titel, Zusammenfassung, Ende).
  • Raum: frequenzabhängiger Faltungshall (tiefe Frequenzen nicht im Hall → nicht matschig).
Sounddesign
  • eine Klangfamilie (gläserne Pings, weiche tiefe Impulse, gefilterte Luft), tonal an den laufenden
    Akkord gebunden, pro Typ lautheitsnormiert (K-Gewichtung) und dezent.
Mischung
  • Sprache bleibt dominant: Ducking mit Hold + Look-ahead (kein Pumpen innerhalb von Sätzen),
    Musik ≈ 19 dB unter der Stimme, Effekte leiser; Hochpass < 30 Hz, Präsenz-Kerbe für die Stimme,
    weicher Peak-Limiter (−1 dBFS) nur auf dem Gesamtmix.
"""
import itertools
import json
import os
import subprocess
import time

import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import butter, istft, oaconvolve, sosfilt, stft

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
F32 = np.float32
CR = 200                      # Steuerrate (Hz) für Hüllkurven/Gain-Kurven
HOP = SR // CR
TAU = 2 * np.pi
T_START = time.time()


def path(*p):
    return os.path.join(ROOT, *p)


def log(msg):
    print(f'[{time.time() - T_START:6.1f}s] {msg}', flush=True)


def hz(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)


def db2a(d):
    return 10 ** (np.asarray(d, dtype=float) / 20)


# ------------------------------------------------------------------ Filter
def sos_lp(f, order=2):
    return butter(order, f, 'low', fs=SR, output='sos')


def sos_hp(f, order=2):
    return butter(order, f, 'high', fs=SR, output='sos')


def sos_bp(f1, f2, order=2):
    return butter(order, [f1, f2], 'band', fs=SR, output='sos')


def filt(sos, x):
    return sosfilt(sos, x, axis=0).astype(F32)


def sos_peak(f0, gain_db, q):
    """RBJ-Peaking-EQ als SOS."""
    A = 10 ** (gain_db / 40)
    w = TAU * f0 / SR
    al = np.sin(w) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w), 1 - al / A])
    return np.concatenate([b / a[0], a / a[0]])[None, :]


def sos_lowshelf(f0, gain_db, s=0.8):
    A = 10 ** (gain_db / 40)
    w = TAU * f0 / SR
    al = np.sin(w) / 2 * np.sqrt((A + 1 / A) * (1 / s - 1) + 2)
    c = np.cos(w)
    b = np.array([A * ((A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al)])
    a = np.array([(A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al])
    return np.concatenate([b / a[0], a / a[0]])[None, :]


# K-Gewichtung (ITU-R BS.1770, 48 kHz) für Lautheitsmessung der Effekte
K_SOS = np.array([[1.53512485958697, -2.69169618940638, 1.19839281085285, 1.0, -1.69065929318241, 0.73248077421585],
                  [1.0, -2.0, 1.0, 1.0, -1.99004745483398, 0.99007225036621]])


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def fade_in(n):
    """Equal-Power-Einblendung mit waagrechtem Start und Ende (kein Knick, kein Klick)."""
    if n <= 0:
        return np.ones(0, F32)
    return np.sin(0.5 * np.pi * smoothstep(np.linspace(0, 1, n))).astype(F32)


def fade_out(n):
    return fade_in(n)[::-1].copy()


def edge(x, a=0.002, r=0.03):
    """Setzt Anfang und Ende eines Klangs weich auf exakt 0."""
    na, nr = min(len(x), int(a * SR)), min(len(x), int(r * SR))
    if na > 1:
        x[:na] *= (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na)))[(slice(None),) + (None,) * (x.ndim - 1)]
    if nr > 1:
        x[-nr:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nr)))[(slice(None),) + (None,) * (x.ndim - 1)]
    return x


def pan_gains(p):
    """Equal-Power-Panorama, p = 0 (links) … 1 (rechts)."""
    p = float(np.clip(p, 0, 1))
    return np.cos(0.5 * np.pi * p), np.sin(0.5 * np.pi * p)


def add_at(out, t, sig, gl=1.0, gr=None):
    """Mischt mono (gl/gr) oder stereo Signal ab Zeit t in out (clipt am Ende)."""
    a = int(round(t * SR))
    if a >= len(out) or len(sig) == 0:
        return
    s0 = 0
    if a < 0:
        s0, a = -a, 0
    b = min(len(out), a + len(sig) - s0)
    seg = sig[s0:s0 + b - a]
    if seg.ndim == 1:
        out[a:b, 0] += seg * gl
        out[a:b, 1] += seg * (gl if gr is None else gr)
    else:
        out[a:b] += seg * gl


# ================================================================== Zeitachse
TIMINGS = json.load(open(path('data', 'timings.json'), encoding='utf-8'))
SCENES = TIMINGS['scenes']
SC = {s['id']: s for s in SCENES}
CUES = TIMINGS['cues']
DUR = float(TIMINGS['duration'])


def tcue(scene, spec):
    """'^' Szenenstart, '$' Szenenende, 'cue', 'cue+0.5', 'cue-1', '@3.2' (Sekunden ab Szenenstart)."""
    spec = spec.strip()
    off = 0.0
    for sign in ('+', '-'):
        if sign in spec[1:]:
            i = spec.index(sign, 1)
            off = float(spec[i:])
            spec = spec[:i]
            break
    if spec == '^':
        base = SC[scene]['start']
    elif spec == '$':
        base = SC[scene]['end']
    elif spec.startswith('@'):
        base = SC[scene]['start'] + float(spec[1:])
    else:
        assert spec in CUES[scene], f'unbekannter Cue {scene}.{spec}'
        base = CUES[scene][spec]
    return float(base) + off


ACTS = [('P', ['intro']), ('I', ['whatis', 'neurodev', 'development']), ('II', ['riskmap', 'genetics', 'prenatal']),
        ('III', ['adolescence', 'pruning']), ('IV', ['microglia', 'complement', 'glutamate', 'nmda', 'gaba', 'dopamine', 'synthesis']),
        ('V', ['stress', 'cannabis']), ('VI', ['model', 'lives', 'prodrome', 'symptoms']), ('VII', ['summary', 'conclusion'])]
ACT_OF = {s: a for a, ss in ACTS for s in ss}


def scene_at(t):
    for s in SCENES:
        if t < s['end']:
            return s['id']
    return SCENES[-1]['id']


# ================================================================== Harmonie
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
# Oberstimmen je Akkordqualität (Intervalle über dem Grundton; der Bass spielt den Grundton)
QUAL = {
    'm9': (3, 7, 10, 14), 'm11': (3, 10, 14, 17), 'm7': (3, 7, 10, 12), 'madd9': (3, 7, 12, 14),
    'maj9': (4, 7, 11, 14), 'maj7#11': (4, 11, 14, 18), '69': (4, 9, 14, 7), 'add9': (4, 7, 12, 14),
    '7sus4': (5, 7, 10, 14), '7sus': (5, 7, 10, 12), '6sus4': (5, 7, 9, 14), 'sus4': (5, 7, 12, 14),
}

# Akkordfahrplan: (Cue, Akkord).  '!' = Ankunft (exakt auf dem Cue, kurzer Einsatz + Bloom).
CHART = {
    'intro': [('^', 'Dm9'), ('network', 'Bbmaj9'), ('brain2', 'Gm9'), ('question', 'Bbmaj7#11'), ('notone', 'Gm11'),
              ('together', 'Dm9'), ('p3', 'Bbmaj9'), ('alone', 'Gm9'), ('merge', 'C7sus4'), ('!title', 'Fmaj9'), ('youth', 'Bbmaj9')],
    'whatis': [('what', 'Dm9'), ('perc', 'Bbmaj9'), ('voices', 'Gm9'), ('myth', 'Am7'), ('prev', 'Bbmaj7#11'), ('onset', 'Fadd9/A'),
               ('early', 'Gm9'), ('child', 'Am7'), ('why', 'Bbmaj7#11'), ('dev', 'Fmaj9')],
    'neurodev': [('ndd', 'Dm9'), ('roots', 'Bbmaj9'), ('prenatal', 'Fadd9'), ('childhood', 'Gm9'), ('adol', 'Am7'),
                 ('window', 'Bbmaj7#11'), ('wrong', 'Gm9'), ('model', 'C7sus4'), ('later', 'Fmaj9')],
    'development': [('child', 'Fmaj9'), ('syn', 'Bbmaj9'), ('teen', 'Gm9'), ('adult', 'C69'), ('better', 'Fmaj9/A'), ('axon', 'Dm9'),
                    ('myelin', 'Bbmaj9'), ('speed', 'C69'), ('late', 'Am7'), ('self', 'Dm9'), ('plastic', 'Bbmaj7#11'),
                    ('strength', 'Fmaj9'), ('sens', 'Gm9')],
    'riskmap': [('which', 'Am9'), ('core', 'Fmaj7#11'), ('prenat', 'Dm9'), ('social', 'Em7'), ('imm', 'Cmaj9'), ('notall', 'Am9'),
                ('small', 'Fmaj9'), ('double', 'G69'), ('most', 'Cmaj9'), ('web', 'Fmaj7#11'), ('web2', 'Am9')],
    'genetics': [('dna', 'Am9'), ('twins', 'Fmaj9'), ('but', 'Dm9'), ('same', 'Em7'), ('notfate', 'Cmaj9'), ('poly', 'Am9'),
                 ('many', 'Fmaj7#11'), ('gwas', 'G69'), ('loci', 'Em7'), ('common', 'Cmaj9'), ('sum', 'Dm9'), ('rare', 'Am9'),
                 ('del', 'Fmaj7#11'), ('quarter', 'Dm9'), ('three', 'Cmaj9'), ('prob', 'Fmaj9'), ('nofix', 'G69')],
    'prenatal': [('womb', 'Fmaj7#11'), ('neurogen', 'Am9'), ('migrate', 'Cmaj9'), ('fine', 'G69'), ('infect', 'Dm9'),
                 ('nutrition', 'Fmaj9'), ('birth', 'Em7'), ('preterm', 'Am9'), ('target', 'Dm9'), ('target2', 'Fmaj9'),
                 ('partial', 'Cmaj9'), ('most', 'G69')],
    'adolescence': [('jump', 'Em9'), ('adol', 'Cmaj9'), ('puberty', 'G69'), ('rebuild', 'Dadd9/F#'), ('sort', 'Em9'),
                    ('myelin', 'Cmaj9'), ('eff', 'Am9'), ('big', 'D6sus4'), ('!boom', 'Cmaj7#11'), ('white', 'G69'),
                    ('normal', 'Em9'), ('q', 'Cmaj7#11')],
    'pruning': [('zoom', 'Em9'), ('clean', 'Am9'), ('def', 'Cmaj9'), ('kid', 'G69'), ('activity', 'Dadd9/F#'), ('stabilize', 'Em9'),
                ('fade', 'Cmaj7#11'), ('mg', 'Am9'), ('engulf', 'Bm7'), ('normalp', 'Cmaj9'), ('research', 'Em9'), ('hyp', 'Am9'),
                ('spines', 'Cmaj7#11'), ('spines2', 'G69'), ('caution', 'Am9'), ('open', 'B7sus')],
    'microglia': [('immune', 'Em9'), ('survey', 'Cmaj9'), ('debris', 'Am9'), ('how', 'Bm7'), ('compl', 'Gmaj9'), ('c1q', 'Em9'),
                  ('flag', 'Cmaj7#11'), ('receptor', 'D69'), ('eat', 'Em9')],
    'complement': [('circle', 'Am9'), ('mhc', 'Cmaj9'), ('c4', 'Em9'), ('variants', 'G69'), ('study', 'Am9'), ('more', 'Bm7'),
                   ('chain', 'Cmaj9'), ('ch3', 'D69'), ('ch5', 'Em9'), ('mice', 'Cmaj9'), ('villain', 'Am9'), ('vital', 'G69'),
                   ('open', 'Cmaj7#11')],
    'glutamate': [('into', 'Gmaj7#11'), ('vesicles', 'Em9'), ('glu', 'Dmaj9'), ('ap', 'A7sus4'), ('fuse', 'Bm9'),
                  ('release', 'Gmaj7#11'), ('cleft', 'Dadd9/F#'), ('bind', 'Em9'), ('nmda', 'A7sus4'), ('astro', 'Gmaj9'),
                  ('convert', 'Bm9'), ('back', 'Em9'), ('reconv', 'A7sus4'), ('cycle', 'Dmaj9'), ('balance', 'Gmaj7#11')],
    'nmda': [('big', 'Bm9'), ('gate', 'Gmaj9'), ('mg', 'Em9'), ('ca', 'Dmaj9'), ('learn', 'Gmaj7#11'), ('ket', 'Bm9'), ('psy', 'Em9'),
             ('enc', 'Gmaj9'), ('hyp', 'Bm9'), ('weak', 'Em9'), ('inh', 'A7sus4'), ('caveat', 'Dmaj9'), ('piece', 'Gmaj7#11')],
    'gaba': [('inter', 'Em9'), ('gaba', 'Cmaj9'), ('clock', 'G69'), ('sync', 'D69'), ('gamma', 'Em9'), ('wm', 'Cmaj9'), ('link', 'Am9'),
             ('n1', 'Bm7'), ('n3', 'Cmaj7#11'), ('pm', 'Am9'), ('gred', 'Em9'), ('ei', 'G69'), ('ei2', 'D69')],
    'dopamine': [('out', 'Dmaj9'), ('da', 'Bm9'), ('mid', 'Gmaj9'), ('paths', 'A7sus4'), ('str', 'Dadd9/F#'), ('sal', 'Gmaj7#11'),
                 ('sal2', 'Em9'), ('rel', 'Bm9'), ('pet', 'Gmaj9'), ('idea', 'Em9'), ('ab', 'F#m7'), ('ab2', 'Gmaj7#11'),
                 ('meds', 'Dmaj9'), ('notiso', 'Bm9'), ('hippo', 'Em9'), ('triad', 'Gmaj9'), ('triad2', 'A7sus4')],
    'synthesis': [('all', 'Em9'), ('s3', 'Cmaj9'), ('s5', 'Am9'), ('s7', 'D6sus4'), ('!system', 'Gmaj9'), ('simpl', 'Cmaj9'),
                  ('indiv', 'G7sus')],
    'stress': [('leave', 'Cm9'), ('teen', 'Abmaj9'), ('load', 'Fm9'), ('trauma', 'Cm9'), ('city', 'Ebmaj9'), ('social', 'Abmaj7#11'),
               ('axis', 'Fm9'), ('cort', 'G7sus'), ('acute', 'Cm9'), ('long', 'Abmaj9'), ('plast', 'Fm9'), ('dasens', 'Ebmaj9'),
               ('nocause', 'Abmaj9'), ('shift', 'G7sus')],
    'cannabis': [('can', 'Cm9'), ('ecs', 'Abmaj9'), ('fine', 'Ebmaj9'), ('thc', 'Fm9'), ('flood', 'Abmaj7#11'), ('devq', 'Cm9'),
                 ('devq2', 'Bbadd9'), ('assoc', 'Fm9'), ('study', 'Ebmaj9'), ('vuln', 'Abmaj9'), ('most', 'Ebmaj9'), ('debate', 'Bbmaj9')],
    'model': [('fit', 'Gm9'), ('vsm', 'Ebmaj9'), ('left', 'Bbmaj9'), ('right', 'Fadd9/A'), ('stable', 'Ebmaj9'), ('tip', 'Cm9'),
              ('tip+1.6', 'D7sus'), ('protect', 'Bbmaj9'), ('p3', 'Ebmaj9'), ('notone', 'Gm9'), ('combo', 'Ebmaj7#11')],
    'lives': [('three', 'Bbmaj9'), ('A', 'Ebmaj9'), ('A3', 'Bbmaj9'), ('B', 'Gm9'), ('B3', 'Cm9'), ('C', 'Gm9'), ('C3', 'Ebmaj7#11'),
              ('C4', 'F7sus'), ('!big', 'Bbmaj9'), ('big2', 'Ebmaj9')],
    'prodrome': [('tl', 'Gm9'), ('t1', 'Ebmaj9'), ('t3', 'Cm9'), ('t4', 'D7sus'), ('signs', 'Gm9'), ('w3', 'Ebmaj9'), ('unspec', 'Bbmaj9'),
                 ('pub', 'Fadd9'), ('notmean', 'Ebmaj9'), ('chr', 'Gm9'), ('maj', 'Bbmaj9'), ('help', 'Ebmaj9')],
    'symptoms': [('split', 'Gm9'), ('pos', 'Ebmaj9'), ('neg', 'Cm9'), ('cog', 'Bbmaj9'), ('before', 'Ebmaj7#11'), ('link', 'F7sus')],
    'summary': [('back', 'Gm9'), ('levels', 'Ebmaj9'), ('L5', 'Cm9'), ('connect', 'Bbmaj9'), ('schizo', 'Gm9'), ('n1', 'Ebmaj7#11'),
                ('n3', 'F69'), ('n4', 'A7sus4'), ('!final', 'Dmaj9')],
    'conclusion': [('life', 'Gmaj9/D'), ('adapt', 'Bm9'), ('treat', 'Gmaj9'), ('tr3', 'Dadd9/F#'), ('support', 'Em9'), ('talk', 'Gmaj9'),
                   ('talk2', 'A7sus4'), ('!end', 'D69')],
}

# Klangfarbe/Register je Akt (+ Szenen-Abweichungen): Pad-Timbre, Stimmlage, Helligkeit, Bass
ACT_STYLE = {
    'P': dict(timbre=(('warm', .45), ('choir', .55)), lo=55, hi=77, bright=.30, bass=.8),
    'I': dict(timbre=(('warm', .7), ('choir', .3)), lo=56, hi=76, bright=.45, bass=1.0),
    'II': dict(timbre=(('hollow', .6), ('warm', .4)), lo=55, hi=76, bright=.42, bass=.9),
    'III': dict(timbre=(('warm', .8), ('hollow', .2)), lo=54, hi=76, bright=.52, bass=1.0),
    'IV': dict(timbre=(('warm', .5), ('choir', .5)), lo=53, hi=76, bright=.40, bass=.95),
    'V': dict(timbre=(('soft', .55), ('choir', .45)), lo=52, hi=74, bright=.24, bass=.9),
    'VI': dict(timbre=(('warm', .6), ('hollow', .4)), lo=55, hi=76, bright=.40, bass=.95),
    'VII': dict(timbre=(('warm', .6), ('choir', .4)), lo=55, hi=77, bright=.50, bass=1.0),
}
SCENE_STYLE = {
    'glutamate': dict(timbre=(('warm', .55), ('hollow', .45)), lo=57, hi=78, bright=.58),
    'nmda': dict(bright=.46),
    'gaba': dict(timbre=(('hollow', .5), ('warm', .5)), lo=55, hi=76, bright=.5),
    'dopamine': dict(timbre=(('warm', .75), ('choir', .25)), lo=55, hi=76, bright=.5),
    'synthesis': dict(lo=54, hi=77, bright=.5),
    'cannabis': dict(timbre=(('choir', .6), ('soft', .4)), bright=.3),
    'symptoms': dict(bright=.34),
    'conclusion': dict(timbre=(('warm', .65), ('choir', .35)), lo=55, hi=76, bright=.46),
}


def style(scene):
    st = dict(ACT_STYLE[ACT_OF[scene]])
    st.update(SCENE_STYLE.get(scene, {}))
    return st


# Grundenergie je Szene (steuert Arpeggio-Dichte, Helligkeit, Pad-Pegel – die Musik bleibt ruhig)
INTENSITY = {
    'intro': .32, 'whatis': .30, 'neurodev': .36, 'development': .46, 'riskmap': .40, 'genetics': .43, 'prenatal': .38,
    'adolescence': .62, 'pruning': .50, 'microglia': .42, 'complement': .46, 'glutamate': .52, 'nmda': .50, 'gaba': .55,
    'dopamine': .54, 'synthesis': .56, 'stress': .38, 'cannabis': .40, 'model': .45, 'lives': .44, 'prodrome': .36,
    'symptoms': .38, 'summary': .52, 'conclusion': .48,
}
# Aufbauten vor großen Momenten: (Szene, Start-Cue, Ankunfts-Cue, Stärke)
BUILDS = [('intro', 'alone', 'title', 1.0), ('adolescence', 'big', 'boom', .9), ('synthesis', 's5', 'system', .75),
          ('lives', 'C4', 'big', .45), ('summary', 'n1', 'final', 1.0), ('conclusion', 'talk2', 'end', .55)]


def parse_chord(sym):
    r = sym[0]
    i = 1
    pc = PC[r]
    if i < len(sym) and sym[i] in 'b#':
        pc += -1 if sym[i] == 'b' else 1
        i += 1
    rest = sym[i:]
    bass = None
    if '/' in rest:
        rest, b = rest.split('/')
        bass = PC[b[0]] + (0 if len(b) == 1 else (-1 if b[1] == 'b' else 1))
    minor = rest.startswith('m') and not rest.startswith('maj')
    q = rest
    if q not in QUAL:
        raise ValueError(f'Akkord {sym}: Qualität {q!r} unbekannt')
    return pc % 12, q, (pc if bass is None else bass) % 12, minor


def voice_upper(root, q, prev, lo, hi):
    """Wählt Oktavlagen der Oberstimmen mit minimaler Bewegung, ohne Halbtonreibung, zentriertem Register."""
    ivs = QUAL[q]
    cands = []
    for iv in ivs:
        pc = (root + iv) % 12
        cands.append([m for m in range(lo, hi + 1) if m % 12 == pc])
    best, best_cost = None, 1e9
    center = (lo + hi) / 2
    for combo in itertools.product(*cands):
        if len(set(combo)) < len(combo):
            continue
        v = sorted(combo)
        cost = 0.0
        if prev is not None:
            cost += sum(abs(a - b) for a, b in zip(v, prev))
        cost += 0.45 * abs(np.mean(v) - center)
        for a, b in zip(v[:-1], v[1:]):
            d = b - a
            if d == 1:
                cost += 20
            elif d == 2 and a < 60:
                cost += 2.5
            elif d > 9:
                cost += (d - 9) * 0.8
        span = v[-1] - v[0]
        if span < 9:
            cost += (9 - span) * 0.7
        if v[0] < 52 and v[1] - v[0] < 5:
            cost += 3
        if cost < best_cost:
            best, best_cost = v, cost
    return best


MIN_CHORD = 3.4       # s, kürzester Akkordabstand (außer vor/auf Ankünften)


def build_chords():
    raw = []
    for s in SCENES:
        for spec, sym in CHART[s['id']]:
            arr = spec.startswith('!')
            raw.append(dict(cue=tcue(s['id'], spec.lstrip('!')), sym=sym, arrival=arr, scene=s['id']))
    raw.sort(key=lambda c: c['cue'])
    # ruhiger harmonischer Rhythmus: Wechsel, die zu dicht aufeinander folgen, entfallen
    # (Ankünfte und der Akkord direkt davor – der Aufbau – bleiben immer erhalten)
    keep = []
    for i, c in enumerate(raw):
        pre_arrival = i + 1 < len(raw) and raw[i + 1]['arrival']
        if not keep or c['arrival'] or pre_arrival or c['cue'] - keep[-1]['cue'] >= MIN_CHORD:
            if keep and (c['arrival'] or pre_arrival) and c['cue'] - keep[-1]['cue'] < 1.6 and not keep[-1]['arrival'] and len(keep) > 1:
                keep.pop()
            keep.append(c)
    raw = keep
    # Überblendzeit je Wechsel: halb so lang wie das kürzere Nachbarsegment, 0.7 … 2.6 s
    for i, c in enumerate(raw):
        prev_len = c['cue'] - raw[i - 1]['cue'] if i else 8.0
        next_len = (raw[i + 1]['cue'] if i + 1 < len(raw) else DUR) - c['cue']
        x = float(np.clip(0.5 * min(prev_len, next_len), 0.7, 2.6))
        if c['arrival']:
            c['att'], c['t'] = 0.22, c['cue'] - 0.12
        else:
            c['att'], c['t'] = x, c['cue'] - 0.5 * x
        if i == 0:
            c['t'], c['att'] = 0.0, 6.0
    prev_u, prev_b = None, None
    for c in raw:
        root, q, bpc, minor = parse_chord(c['sym'])
        st = style(c['scene'])
        u = voice_upper(root, q, prev_u, st['lo'], st['hi'])
        cand = [m for m in range(33, 47) if m % 12 == bpc]
        ref = prev_b if prev_b is not None else 40
        b = min(cand, key=lambda m: abs(m - ref) + (1.5 if m < 35 else 0) + (1.0 if m > 44 else 0))
        # Tenor: offene Quinte über dem Grundton (Wärme), ohne Halbtonreibung mit den Oberstimmen
        tn = [m for m in range(45, 58) if m % 12 == (root + 7) % 12]
        tenor = tn[0] if tn else None
        if tenor is not None and any(abs(tenor - x) <= 1 for x in u):
            tenor = None
        c.update(root=root, q=q, minor=minor, upper=u, bass=b, tenor=tenor,
                 pcs=sorted({(root + iv) % 12 for iv in QUAL[q]} | {root, bpc}))
        prev_u, prev_b = u, b
    # Wiederholungen desselben Akkords zusammenfassen
    out = []
    for c in raw:
        if out and out[-1]['sym'] == c['sym'] and not c['arrival']:
            continue
        out.append(c)
    for i, c in enumerate(out):
        c['end'] = out[i + 1]['t'] if i + 1 < len(out) else DUR + 4
        c['rel'] = out[i + 1]['att'] if i + 1 < len(out) else 8.0
        if i + 1 < len(out) and out[i + 1]['arrival']:
            c['rel'] = 0.7
    return out


CHORDS = build_chords()
_CH_T = np.array([c['cue'] for c in CHORDS])


def chord_at(t):
    """Akkord, der zum Zeitpunkt t klingt (Wechsel ab dem Cue)."""
    i = int(np.searchsorted(_CH_T, t + 0.05, side='right') - 1)
    return CHORDS[max(0, i)]


def chord_tones(ch, lo, hi):
    return [m for m in range(lo, hi + 1) if m % 12 in ch['pcs']]


# ================================================================== Energie-/Steuerkurven
def ctrl_time():
    return np.arange(int(DUR * CR) + 2) / CR


def energy_curve():
    tc = ctrl_time()
    e = np.zeros_like(tc)
    for s in SCENES:
        e[(tc >= s['start']) & (tc < s['end'] + 1)] = INTENSITY[s['id']]
    k = np.hanning(int(6 * CR))
    e = np.convolve(np.pad(e, len(k), mode='edge'), k / k.sum(), mode='same')[len(k):-len(k)]
    for scene, a, b, strength in BUILDS:
        ta, tb = tcue(scene, a), tcue(scene, b)
        x = (tc - ta) / max(0.5, tb - ta)
        ramp = smoothstep(x) ** 1.6 * (tc < tb)
        after = (tc >= tb) * np.exp(-np.maximum(0, tc - tb - 2.0) / 6.0)
        e += strength * 0.28 * (ramp + after)
    return np.clip(e, 0, 1)


def up(c, n):
    """Steuerkurve (CR) → Audiorate (linear interpoliert), float32."""
    x = np.arange(n, dtype=np.float64) / HOP
    return np.interp(x, np.arange(len(c)), c).astype(F32)


# ================================================================== Oszillatoren / Instrumente
TAB_N = 4096
_TABS = {}
_PH = np.random.default_rng(3).uniform(0, TAU, 64)


def spectrum(timbre, f0, bright):
    fc = 650 * 2 ** (3.6 * bright)                     # 650 Hz … 7.9 kHz
    K = int(min(48, 15000 / f0))
    k = np.arange(1, K + 1)
    fk = k * f0
    amps = np.zeros(K)
    for name, w in timbre:
        if name == 'warm':
            a = 1.0 / k
        elif name == 'hollow':
            a = np.where(k % 2 == 1, 1.0 / k, 0.22 / k)
        elif name == 'choir':
            a = (1.0 / k ** 0.8) * (0.3 + np.exp(-((fk - 650) / 240) ** 2) + 0.65 * np.exp(-((fk - 1100) / 320) ** 2) + 0.2 * np.exp(-((fk - 2700) / 450) ** 2))
        elif name == 'soft':
            a = np.exp(-(k - 1) * 1.1)
        elif name == 'sine':
            a = (k == 1) * 1.0 + (k == 2) * 0.22 + (k == 3) * 0.06
        else:
            raise ValueError(name)
        amps += w * a / np.sqrt(np.sum(a ** 2))
    amps /= np.sqrt(1 + (fk / fc) ** 4)
    return amps


def table(timbre, m, bright):
    key = (timbre, int(m), round(bright, 2))
    tab = _TABS.get(key)
    if tab is None:
        amps = spectrum(timbre, hz(m), bright)
        ph = np.arange(TAB_N) / TAB_N * TAU
        w = np.zeros(TAB_N)
        for k, a in enumerate(amps, 1):
            if a > 1e-5:
                w += a * np.sin(k * ph + _PH[k - 1])
        w /= np.sqrt(np.mean(w ** 2)) + 1e-12
        tab = np.append(w, w[0]).astype(F32)
        _TABS[key] = tab
    return tab


def osc(tab, fr, warp, ph0):
    cyc = warp * fr + ph0
    cyc -= np.floor(cyc)
    idx = cyc * TAB_N
    i0 = idx.astype(np.int32)
    fr_ = (idx - i0).astype(F32)
    y0 = tab[i0]
    return y0 + fr_ * (tab[i0 + 1] - y0)


def pad_note(out, m, t0, env, timbre, bright, gain, rng, width=0.85, det=6.5):
    """Phasenkontinuierliche Pad-Stimme: Mitte + zwei gegenläufig verstimmte Seiten, langsame Drift."""
    n = len(env)
    a = int(round(t0 * SR))
    if a >= len(out) or n <= 0:
        return
    n = min(n, len(out) - a)
    env = env[:n]
    t = np.arange(n) / SR
    fd = rng.uniform(0.06, 0.14)
    ph = rng.uniform(0, TAU)
    dc = rng.uniform(1.0, 2.2)
    depth = 2 ** (dc / 1200) - 1
    warp = t - depth / (TAU * fd) * (np.cos(TAU * fd * t + ph) - np.cos(ph))
    f = float(hz(m))
    tab = table(timbre, m, bright)
    c = osc(tab, f, warp, rng.random())
    g = env * F32(gain)
    if width <= 0:
        out[a:a + n] += (c * g)[:, None]
        return
    lft = osc(tab, f * 2 ** (-det / 1200), warp, rng.random())
    rgt = osc(tab, f * 2 ** (det / 1200), warp, rng.random())
    out[a:a + n, 0] += (c + width * lft) * g
    out[a:a + n, 1] += (c + width * rgt) * g


def ar_env(n_att, n_sus, n_rel):
    return np.concatenate([fade_in(n_att), np.ones(max(0, n_sus), F32), fade_out(n_rel)])


def pad_amp(m):
    return float((hz(m) / 260.0) ** -0.22)


_NOTES = {}


def inst_note(inst, m, vb=1):
    """Einzelton eines Arpeggio-/Motiv-Instruments (gecacht). Alle Teiltöne < 15 kHz, weicher Ein- und Ausklang."""
    key = (inst, int(m), vb)
    if key in _NOTES:
        return _NOTES[key]
    f = float(hz(m))
    br = (0.55, 0.78, 1.0)[vb]
    rng = np.random.default_rng(int(m) * 31 + vb * 7 + len(inst))
    if inst == 'felt':                      # Filz-Klavier: leicht gespreizte Teiltöne, obere klingen schneller ab
        dur = float(np.clip(2.8 * (262 / f) ** 0.35, 1.3, 3.8))
        t = np.arange(int(dur * SR)) / SR
        y = np.zeros_like(t)
        tau1 = 1.05 * (262 / f) ** 0.3
        for k in range(1, 9):
            fk = k * f * np.sqrt(1 + 0.00035 * k * k)
            if fk > 12000:
                break
            y += (br ** (k - 1)) / k ** 1.5 * np.sin(TAU * fk * t + rng.uniform(0, TAU)) * np.exp(-t / (tau1 / (1 + 0.6 * (k - 1))))
        att = 0.006
    elif inst == 'glass':                   # Celesta/Glas: Grundton + weiche, schnell verklingende Obertöne
        dur = 2.4
        t = np.arange(int(dur * SR)) / SR
        y = np.zeros_like(t)
        for r, a, tau in ((1, 1.0, 1.3), (2.0, .16, .5), (3.0, .06, .3), (4.2, .10 * br, .13), (6.8, .03 * br, .05)):
            if r * f < 14000:
                y += a * np.sin(TAU * r * f * t + rng.uniform(0, TAU)) * np.exp(-t / tau)
        att = 0.003
    elif inst == 'pluck':                   # gedämpfter Zupfton (Adoleszenz-Ostinato)
        dur = 1.1
        t = np.arange(int(dur * SR)) / SR
        y = np.zeros_like(t)
        for k in range(1, 11):
            if k * f > 12000:
                break
            y += (br ** (k - 1)) / k * np.sin(TAU * k * f * t + rng.uniform(0, TAU)) * np.exp(-t / (0.5 / (1 + 0.9 * (k - 1))))
        att = 0.004
    elif inst == 'marimba':                 # Holz (Mikroglia/Komplement: organisch)
        dur = 1.4
        t = np.arange(int(dur * SR)) / SR
        y = np.sin(TAU * f * t) * np.exp(-t / 0.55) + 0.05 * np.sin(TAU * 2 * f * t) * np.exp(-t / 0.3)
        for r, a, tau in ((3.93, .22 * br, .07), (9.2, .05 * br, .025)):
            if r * f < 14000:
                y += a * np.sin(TAU * r * f * t + rng.uniform(0, TAU)) * np.exp(-t / tau)
        att = 0.002
    elif inst == 'epiano':                  # FM-E-Piano (Dopamin: warm, golden)
        dur = 2.6
        t = np.arange(int(dur * SR)) / SR
        idx = 0.95 * br * np.exp(-t / 0.35) + 0.12
        y = np.sin(TAU * f * t + idx * np.sin(TAU * f * t)) * np.exp(-t / 1.5)
        y += 0.12 * np.sin(TAU * 2 * f * t) * np.exp(-t / 0.4)
        att = 0.003
    elif inst == 'bell':                    # weiche FM-Glocke (Prolog, Cannabis-Schleier)
        dur = 4.0
        t = np.arange(int(dur * SR)) / SR
        idx = 1.1 * br * np.exp(-t / 0.9)
        y = np.sin(TAU * f * t + idx * np.sin(TAU * 3.5 * f * t)) * np.exp(-t / 1.7)
        att = 0.004
    else:
        raise ValueError(inst)
    na = int(att * SR)
    y[:na] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na))
    y = edge(y.astype(F32), a=0.0, r=0.08)
    y /= np.sqrt(np.mean(y[: int(0.3 * SR)] ** 2)) + 1e-9
    _NOTES[key] = y
    return y


# ================================================================== Musik-Schichten
PAD_G = 0.12          # Pegel je Pad-Stimme (Referenz für alle anderen Schichten)
def layer_pad(n, E):
    """Hauptpad (4 Oberstimmen + Tenor-Quinte) mit gebundenen gemeinsamen Tönen."""
    out = np.zeros((n, 2), F32)
    rng = np.random.default_rng(101)
    active = {}
    notes = []
    for c in CHORDS:
        cur = set(c['upper']) | ({c['tenor']} if c['tenor'] else set())
        for m in list(active):
            if m not in cur:
                s, att, sc = active.pop(m)
                notes.append((m, s, c['t'], att, c['att'] if not c['arrival'] else 0.6, sc))
        for m in cur:
            if m not in active:
                active[m] = (c['t'], c['att'], c['scene'])
    for m, (s, att, sc) in active.items():
        notes.append((m, s, DUR - 7.5, att, 7.0, sc))
    for m, s, e, att, rel, sc in notes:
        st = style(sc)
        na, nr = int(att * SR), int(rel * SR)
        ns = int((e - s) * SR) - na
        env = ar_env(na, ns, nr) if ns >= 0 else fade_in(na)[: int((e - s) * SR)]
        if ns < 0:
            env = np.concatenate([env, fade_out(nr) * (env[-1] if len(env) else 0)])
        gain = pad_amp(m) * (0.7 if m < st['lo'] else 1.0)          # Tenor-Quinte etwas zurück
        pad_note(out, m, s, env, st['timbre'], st['bright'], gain * PAD_G, rng)
    return out, notes


def layer_bass(n):
    out = np.zeros((n, 2), F32)
    rng = np.random.default_rng(202)
    active = None
    segs = []
    for c in CHORDS:
        if active is None or active[0] != c['bass']:
            if active is not None:
                segs.append((active[0], active[1], c['t'], active[2], c['att'] if not c['arrival'] else 0.5, active[3]))
            active = (c['bass'], c['t'], c['att'], c['scene'])
    segs.append((active[0], active[1], DUR - 7.0, active[2], 6.5, active[3]))
    for m, s, e, att, rel, sc in segs:
        na, nr = int(max(att, 0.9) * SR), int(max(rel, 0.9) * SR)
        ns = max(0, int((e - s) * SR) - na)
        env = ar_env(na, ns, nr)
        g = style(sc)['bass'] * 0.34
        pad_note(out, m, s, env, (('sine', 1.0),), 0.2, g, rng, width=0.0, det=0.0)
    return out


def layer_shimmer(n, E):
    """Oktav-Schimmer der Oberstimmen – nur wo die Energie hoch ist (Aufbauten, Ankünfte)."""
    out = np.zeros((n, 2), F32)
    rng = np.random.default_rng(303)
    tc = ctrl_time()
    for i, c in enumerate(CHORDS):
        a, b = c['t'], c['end']
        ea = float(np.interp(0.5 * (a + b), tc, E))
        lvl = max(0.0, ea - 0.48) * 2.2 + (0.35 if c['arrival'] else 0.0)
        if lvl <= 0.02 or b - a < 1.0:
            continue
        att = 0.5 if c['arrival'] else c['att']
        rel = min(3.0, c['rel'] + 0.6)
        na, nr = int(att * SR), int(rel * SR)
        ns = max(0, int((b - a) * SR) - na)
        for m in c['upper'][1:]:
            pad_note(out, m + 12, a, ar_env(na, ns, nr), (('hollow', 1.0),), 0.55, 0.075 * lvl * pad_amp(m + 12), rng, det=9)
    return out


# Arpeggio je Szene: (Instrument, Unterteilung/Schlag, Muster, Pegel, Oktavlage, Grunddichte, Tempo)
ARP = {
    'intro': ('bell', 1, 'sparse', .50, 12, .55, 64), 'whatis': ('felt', 1, 'wander', .50, 12, .60, 72),
    'neurodev': ('felt', 2, 'rise', .50, 12, .58, 72), 'development': ('felt', 2, 'rise', .62, 12, .85, 72),
    'riskmap': ('glass', 2, 'three', .52, 12, .62, 76), 'genetics': ('glass', 2, 'three', .56, 12, .70, 76),
    'prenatal': ('glass', 1, 'wander', .50, 12, .62, 76), 'adolescence': ('pluck', 2, 'ostinato', .66, 12, .95, 84),
    'pruning': ('pluck', 2, 'ostinato', .50, 12, .72, 84), 'microglia': ('marimba', 2, 'wander', .60, 0, .60, 78),
    'complement': ('marimba', 2, 'wander', .60, 0, .70, 78), 'glutamate': ('glass', 4, 'sparkle', .42, 12, .50, 78),
    'nmda': ('epiano', 2, 'gate', .52, 0, .70, 78), 'gaba': ('glass', 4, 'clock', .36, 12, .92, 78),
    'dopamine': ('epiano', 2, 'rise', .56, 0, .75, 72), 'synthesis': ('felt', 2, 'rise', .60, 12, .85, 80),
    'stress': ('felt', 1, 'sparse', .46, 0, .55, 62), 'cannabis': ('bell', 1, 'sparse', .42, 0, .50, 62),
    'model': ('felt', 2, 'seesaw', .52, 12, .72, 70), 'lives': ('felt', 2, 'three', .48, 12, .62, 70),
    'prodrome': ('felt', 1, 'wander', .46, 12, .58, 70), 'symptoms': ('glass', 1, 'sparse', .40, 12, .55, 70),
    'summary': ('felt', 2, 'rise', .60, 12, .80, 76), 'conclusion': ('felt', 1, 'rise', .52, 12, .70, 66),
}
PATTERNS = {
    'rise': [0, 1, 2, 3, 4, 3, 2, 1], 'wander': [0, 2, 1, 3, -1, 2, 4, -1], 'three': [0, 2, 4, 1, 3, 5, 2, 4],
    'ostinato': [0, 3, 1, 3, 0, 3, 2, 3], 'sparse': [0, -1, -1, 2, -1, -1, 4, -1], 'gate': [2, 2, -1, 2, 3, -1, 1, -1],
    'clock': [0, 3, 1, 3, 2, 3, 1, 3], 'sparkle': [5, -1, 3, -1, -1, 4, -1, 2], 'seesaw': [0, -1, 5, -1, 1, -1, 4, -1],
}
# Dichte-Verläufe innerhalb einer Szene (Cue, Faktor) – z. B. GABA „verliert den Takt“, Pause nach „umgebaut“
DENSITY = {
    'intro': [('^', 0.0), ('network', .35), ('together', .6), ('title', .75), ('youth', .5)],
    'adolescence': [('^', .3), ('jump', .6), ('rebuild', .9), ('boom-0.2', 0.0), ('grey', .65), ('q', .45)],
    'gaba': [('^', .6), ('clock', 1.0), ('n2', .32), ('pm', .6), ('gred', .85)],
    'synthesis': [('^', .35), ('s1', .55), ('s5', .8), ('system', 1.0), ('simpl', .5), ('indiv', .3)],
    'summary': [('^', .45), ('levels', .75), ('schizo', .3), ('n1', .6), ('final', 1.0)],
    'conclusion': [('^', .75), ('support', .55), ('talk2', .35), ('end-0.3', 0.0)],
    'lives': [('^', .7), ('big-0.2', 0.0), ('big2', .55)],
    'stress': [('^', .7), ('trauma', .45), ('acute', .75)],
}
ANCHOR = {'intro': 'title', 'adolescence': 'boom', 'synthesis': 'system', 'lives': 'big', 'summary': 'final', 'conclusion': 'end'}


def density_at(scene, t):
    pts = DENSITY.get(scene)
    if not pts:
        return 1.0
    v = 1.0
    for spec, d in pts:
        if t >= tcue(scene, spec):
            v = d
    return v


def next_change(t):
    i = int(np.searchsorted(_CH_T, t, side='right'))
    return CHORDS[i]['cue'] if i < len(CHORDS) else DUR + 10


def place_note(out, sig, t, gain, pan, damp_pcs=None, m=None):
    """Setzt einen Ton; klingt er in einen Akkord hinein, der seine Tonhöhe nicht enthält, wird er weich abgedämpft."""
    sig = sig * F32(gain)
    if m is not None:
        tc = next_change(t)
        if tc < t + len(sig) / SR:
            nxt = chord_at(tc + 0.01)
            if m % 12 not in nxt['pcs']:
                k = int((tc + 0.25 - t) * SR)
                if k < len(sig):
                    k = max(k, int(0.06 * SR))
                    nr = int(0.35 * SR)
                    sig = sig[: k + nr].copy()
                    sig[k:] *= fade_out(len(sig) - k)
    gl, gr = pan_gains(pan)
    add_at(out, t, sig, gl, gr)


def layer_arp(n, E, voice_act):
    out = np.zeros((n, 2), F32)
    rng = np.random.default_rng(404)
    tc = ctrl_time()
    count = 0
    for s in SCENES:
        sid = s['id']
        inst, div, pat, lvl, octv, dens, bpm = ARP[sid]
        step = 60.0 / bpm / div
        anchor = tcue(sid, ANCHOR[sid]) if sid in ANCHOR else s['start']
        t0 = s['start'] + 0.35
        k0 = int(np.ceil((t0 - anchor) / step))
        k = k0
        while True:
            t = anchor + k * step
            if t >= s['end'] - 0.15 or t >= DUR - 9.5:
                break
            k += 1
            idx = PATTERNS[pat][k % 8]
            if idx < 0:
                continue
            e = float(np.interp(t, tc, E))
            p = dens * density_at(sid, t) * (0.55 + 0.8 * e)
            if rng.random() > p:
                continue
            ch = chord_at(t)
            pool = sorted(set([m + octv for m in ch['upper']] + [ch['upper'][0] + octv + 12, ch['upper'][1] + octv + 12]))
            m = pool[min(idx, len(pool) - 1)]
            while m > 91:
                m -= 12
            accent = 1.0 if (k % div == 0) else 0.74
            if k % (div * 4) == 0:
                accent *= 1.12
            vel = lvl * accent * (0.6 + 0.7 * e) * rng.uniform(0.86, 1.08)
            # während Sprache minimal zurücknehmen (Ducking macht den Rest)
            vel *= 1.0 - 0.18 * float(np.interp(t, tc, voice_act))
            vb = 2 if vel > 0.62 else (1 if vel > 0.4 else 0)
            sig = inst_note(inst, m, vb)
            pan = 0.5 + 0.28 * np.clip((m - 76) / 12, -1, 1) + 0.08 * np.sin(k * 0.9)
            place_note(out, sig, t + rng.normal(0, 0.005), vel * 0.1, pan, m=m)
            count += 1
    log(f'  Arpeggio: {count} Töne')
    return out


# Leitmotiv (5 Töne, am Ende aufgelöst): (Startzeit-Spec, Instrument, Tempo, [(MIDI, Schläge, Vel)])
MOTIF = [
    (('intro', '@3.6'), 'bell', 64, [(69, 1.5, .8), (70, .5, .6), (69, 1.0, .7), (65, 1.0, .65), (64, 2.0, .7)]),
    (('intro', 'title+0.35'), 'felt', 66, [(72, 1.5, .8), (74, .5, .62), (72, 1.0, .72), (69, 1.0, .66), (67, 2.0, .7)]),
    (('summary', 'final+0.3'), 'felt', 70, [(69, 1.5, .8), (71, .5, .62), (69, 1.0, .72), (66, 1.0, .66), (64, 2.0, .7)]),
    (('conclusion', 'end+1.6'), 'felt', 58, [(69, 1.5, .85), (71, .5, .66), (69, 1.0, .75), (66, 1.0, .7), (64, 1.0, .66), (62, 3.0, .8)]),
]


def layer_motif(n):
    out = np.zeros((n, 2), F32)
    for (sc, spec), inst, bpm, notes in MOTIF:
        t = tcue(sc, spec)
        for m, beats, v in notes:
            sig = inst_note(inst, m, 1)
            place_note(out, sig, t, 0.12 * v, 0.46 + 0.04 * (m - 67) / 5)
            if sc == 'conclusion':          # am Ende eine zarte Glas-Oktave dazu
                place_note(out, inst_note('glass', m + 12, 0), t + 0.004, 0.03 * v, 0.6)
            t += beats * 60.0 / bpm
    return out


def kick(kind='kick'):
    n = int(0.75 * SR)
    t = np.arange(n) / SR
    if kind == 'kick':
        f = 50 + 36 * np.exp(-t / 0.045)
        ph = TAU * np.cumsum(f) / SR
        y = (np.sin(ph) + 0.22 * np.sin(2 * ph)) * np.exp(-t / 0.17)
        y += 0.04 * filt(sos_lp(1200), np.random.default_rng(5).standard_normal(n)) * np.exp(-t / 0.012)
    else:                                   # Herzschlag „lub-dub“, sehr weich
        y = np.zeros(n)
        for d, a in ((0.0, 1.0), (0.27, 0.65)):
            tt = np.maximum(0, t - d)
            f = 48 + 14 * np.exp(-tt / 0.03)
            ph = TAU * np.cumsum(f * (t >= d)) / SR
            y += a * (t >= d) * (np.sin(ph) + 0.28 * np.sin(2 * ph)) * np.exp(-tt / 0.11) * (1 - np.exp(-tt / 0.004))
    y[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return edge(y.astype(F32), a=0.0, r=0.1)


# Puls: (Szene, von, bis, Tempo, alle n Schläge, Pegel von → bis, Art)
PULSES = [('adolescence', 'jump', 'boom', 84, 1, .35, .8, 'kick'), ('adolescence', 'grey', 'q', 84, 2, .32, .22, 'kick'),
          ('pruning', 'zoom', 'mg', 84, 2, .28, .14, 'kick'), ('synthesis', 's1', 'system', 80, 1, .22, .75, 'kick'),
          ('stress', 'load', 'social', 62, 1, .30, .30, 'heart'), ('stress', 'axis', 'acute', 62, 1, .26, .40, 'heart'),
          ('summary', 'levels', 'schizo', 76, 2, .22, .45, 'kick'), ('summary', 'n1', 'final', 76, 1, .40, .85, 'kick')]


def layer_pulse(n):
    out = np.zeros((n, 2), F32)
    snd = {'kick': kick('kick'), 'heart': kick('heart')}
    for sc, a, b, bpm, every, l0, l1, kind in PULSES:
        ta, tb = tcue(sc, a), tcue(sc, b)
        beat = 60.0 / bpm * every
        # Raster so legen, dass die Ankunft (bis-Cue) auf einen Schlag fällt
        t = tb - beat
        times = []
        while t >= ta - 1e-6:
            times.append(t)
            t -= beat
        for t in sorted(times):
            x = (t - ta) / max(1e-3, tb - ta)
            lv = l0 + (l1 - l0) * x
            fade = min(1.0, (t - ta) / 1.5 + 0.3)
            add_at(out, t, snd[kind] * F32(lv * fade * 0.25))
    return out


def swept_noise(dur, f0, f1, width_oct, seed, tilt=-0.3, shape=None):
    """Gefiltertes Rauschen mit gleitendem Band (STFT-Formung → glatt, keine Blockgrenzen)."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    x = rng.standard_normal(n + 4096)
    f, tt, Z = stft(x, fs=SR, nperseg=2048, noverlap=1536)
    prog = np.clip(tt / dur, 0, 1) if shape is None else shape(np.clip(tt / dur, 0, 1))
    fc = f0 * (f1 / f0) ** prog
    ff = np.maximum(f, 20.0)[:, None]
    g = np.exp(-0.5 * (np.log2(ff / fc[None, :]) / width_oct) ** 2) * (ff / 1000.0) ** tilt
    g[f > 14000] = 0
    _, y = istft(Z * g, fs=SR, nperseg=2048, noverlap=1536)
    y = y[2048:2048 + n]
    return (y / (np.sqrt(np.mean(y ** 2)) + 1e-9)).astype(F32)


def layer_builds(n):
    """Riser, Vor-Schwell (Grundton+Quinte der Ankunft) und Bloom auf der Ankunft."""
    out = np.zeros((n, 2), F32)
    rng = np.random.default_rng(505)
    for i, (sc, a, b, strength) in enumerate(BUILDS):
        ta, tb = tcue(sc, a), tcue(sc, b)
        L = float(np.clip(tb - ta, 1.5, 6.0))
        ch = chord_at(tb + 0.2)
        # 1) Riser: Luftband gleitet nach oben, schwillt an, zieht kurz vor der Ankunft weg
        rz = swept_noise(L, 350, 5200, 0.85, 900 + i, shape=lambda x: x ** 1.5)
        rzr = swept_noise(L, 350, 5200, 0.85, 950 + i, shape=lambda x: x ** 1.5)
        tt = np.arange(len(rz)) / SR
        env = ((tt / L) ** 2.6).astype(F32)
        env[-int(0.04 * SR):] *= fade_out(int(0.04 * SR))
        rz2 = np.stack([rz * env, rzr * env], axis=1)
        add_at(out, tb - L, rz2 * F32(0.022 * strength))
        # 2) Vor-Schwell: Grundton + Quinte + Oktave des Ankunftsakkords, crescendo, danach ausklingend
        root = min(m for m in range(60, 72) if m % 12 == ch['root'])
        n_pre, n_post = int(L * SR), int(3.5 * SR)
        e_pre = ((np.arange(n_pre) / n_pre) ** 3).astype(F32)
        e_pre[: int(0.3 * SR)] *= fade_in(int(0.3 * SR))
        env = np.concatenate([e_pre, fade_out(n_post)])
        for m, g in ((root, 1.0), (root + 7, 0.7), (root + 12, 0.5)):
            pad_note(out, m, tb - L, env, (('hollow', 1.0),), 0.55, 0.05 * g * strength, rng, det=8)
        # 3) Bloom: weicher Akkordanschlag (Filz) + Glocke oben
        chord = [ch['bass'] + 12] + ch['upper'] + [ch['upper'][-1] + 12 if ch['upper'][-1] + 12 <= 88 else ch['upper'][-2] + 12]
        for j, m in enumerate(chord):
            place_note(out, inst_note('felt', m, 1), tb + 0.012 * j, 0.05 * strength, 0.35 + 0.3 * j / len(chord))
        top = max(chord_tones(ch, 79, 88))
        place_note(out, inst_note('glass', top, 1), tb + 0.02, 0.035 * strength, 0.62)
    return out


def layer_air(n, E):
    """Sehr leises Luftband oberhalb der Stimme (4.5–11 kHz), langsam atmend."""
    rng = np.random.default_rng(606)
    out = np.zeros((n, 2), F32)
    blk = SR * 60
    sos = sos_bp(4500, 11000)
    zi = np.zeros((sos.shape[0], 2, 2))
    for a in range(0, n, blk):
        b = min(n, a + blk)
        x = rng.standard_normal((b - a, 2)).astype(F32)
        y, zi = sosfilt(sos, x, axis=0, zi=zi)
        out[a:b] = y
    tc = ctrl_time()
    mod = 0.6 + 0.4 * np.sin(TAU * tc / 23.0) * np.sin(TAU * tc / 57.0 + 1.0)
    out *= up(mod * (0.5 + 0.9 * E), n)[:, None]
    return out * F32(0.0045)


# ================================================================== Hall
def make_ir(t60=(3.4, 2.8, 1.5), length=4.5, predelay=0.024, corr=0.3, seed=77):
    n = int(length * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)
    c = rng.standard_normal(n)
    ir = np.zeros((n, 2))
    for ch in range(2):
        x = np.sqrt(corr) * c + np.sqrt(1 - corr) * rng.standard_normal(n)
        lo = sosfilt(sos_lp(500, 4), x)
        hi = sosfilt(sos_hp(3500, 4), x)
        mid = x - lo - hi
        y = lo * np.exp(-6.9 * t / t60[0]) + mid * np.exp(-6.9 * t / t60[1]) + hi * np.exp(-6.9 * t / t60[2])
        ir[:, ch] = y
    ons = int(0.02 * SR)
    ir[:ons] *= (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, ons)))[:, None]
    ir = np.concatenate([np.zeros((int(predelay * SR), 2)), ir])
    ir[-int(0.3 * SR):] *= np.linspace(1, 0, int(0.3 * SR))[:, None]
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    return ir.astype(F32)


def reverb(send, ir, hp=180, lp=6500):
    x = filt(sos_hp(hp, 2), send)
    x = filt(sos_lp(lp, 2), x)
    y = np.zeros_like(send)
    for ch in range(2):
        y[:, ch] = oaconvolve(x[:, ch], ir[:, ch], mode='full')[: len(send)]
    return y


# ================================================================== Soundeffekte
def pick(ch, lo, hi, rng, prefer=None):
    c = chord_tones(ch, lo, hi)
    if prefer is not None:
        c2 = [m for m in c if m % 12 in prefer]
        c = c2 or c
    return int(rng.choice(c))


def ping(f, n, tau, bright=1.0, ph=0.0):
    t = np.arange(n) / SR
    y = np.sin(TAU * f * t + ph) * np.exp(-t / tau)
    for r, a, k in ((2.0, .2, .5), (4.2, .12, .2), (6.8, .04, .1)):
        if r * f < 15000:
            y += bright * a * np.sin(TAU * r * f * t + ph * r) * np.exp(-t / (tau * k))
    return y


def fold(m, lo, hi):
    while m < lo:
        m += 12
    while m >= hi:
        m -= 12
    return m


def sfx_render(kind, t_ev, rng):
    """Liefert (Signal mono/stereo, Ziel-Lautheit in LU relativ)."""
    ch = chord_at(t_ev)
    if kind == 'click':                     # sanfter, gestimmter „Tropfen“-Tick (Synapse)
        n = int(0.16 * SR)
        f = float(hz(pick(ch, 86, 98, rng)))
        y = ping(f, n, 0.026, 0.7, rng.uniform(0, TAU))
        nz = filt(sos_bp(3000, 9000), rng.standard_normal(n)) * np.exp(-np.arange(n) / SR / 0.0022) * 0.18
        return edge((y + nz).astype(F32), a=0.0006, r=0.02), -10
    if kind == 'chime':                     # gläserne Glocke, Akkordton
        n = int(2.8 * SR)
        f = float(hz(pick(ch, 81, 93, rng)))
        t = np.arange(n) / SR
        st = np.zeros((n, 2), F32)
        for c, d in ((0, -1.5), (1, 1.5)):
            fr = f * 2 ** (d / 1200)
            y = np.sin(TAU * fr * t) * np.exp(-t / 1.15)
            for r, a, tau in ((2.0, .22, .5), (3.0, .08, .3), (4.2, .11, .14), (5.4, .04, .08)):
                if r * fr < 15000:
                    y += a * np.sin(TAU * r * fr * t + r) * np.exp(-t / tau)
            st[:, c] = y
        return edge(st, a=0.002, r=0.1), -7
    if kind == 'impulse':                   # weicher Impuls (Aktionspotenzial / Freisetzung)
        n = int(0.9 * SR)
        t = np.arange(n) / SR
        f0 = float(hz(fold(ch['root'] + 36, 31, 43)))
        f = f0 * (1 + 1.4 * np.exp(-t / 0.025))
        ph = TAU * np.cumsum(f) / SR
        y = (np.sin(ph) + 0.3 * np.sin(2 * ph) * np.exp(-t / 0.07)) * np.exp(-t / 0.12)
        y += 0.07 * filt(sos_bp(1500, 6000), rng.standard_normal(n)) * np.exp(-t / 0.012)
        y += 0.16 * ping(float(hz(pick(ch, 76, 88, rng))), n, 0.25, 0.6)
        return edge(y.astype(F32), a=0.0015, r=0.08), -6
    if kind == 'spark':                     # erster Lichtpunkt: wenige feine, hohe Pings
        n = int(1.0 * SR)
        st = np.zeros((n, 2), F32)
        for j, d in enumerate(np.sort(rng.uniform(0, 0.45, 6))):
            f = float(hz(pick(ch, 96, 105, rng)))
            p = ping(f, n - int(d * SR), rng.uniform(0.06, 0.12), 0.5) * (0.9 - 0.1 * j)
            gl, gr = pan_gains(rng.uniform(0.25, 0.75))
            st[int(d * SR):, 0] += p * gl
            st[int(d * SR):, 1] += p * gr
        return edge(st, a=0.001, r=0.05), -10
    if kind in ('whoosh', 'whooshOut'):     # weiche Luftbewegung (Kamerafahrt), Band gleitet, Panorama wandert
        dur = 1.5
        up_ = kind == 'whoosh'
        y = swept_noise(dur, 260 if up_ else 3800, 3800 if up_ else 260, 0.9, int(rng.integers(1_000_000)), tilt=-0.4)
        t = np.arange(len(y)) / dur / SR
        pk = 0.62 if up_ else 0.38
        env = np.where(t < pk, np.sin(0.5 * np.pi * t / pk) ** 2, np.cos(0.5 * np.pi * (t - pk) / (1 - pk)) ** 2)
        p = 0.3 + 0.4 * t if up_ else 0.7 - 0.4 * t
        st = np.stack([y * env * np.cos(0.5 * np.pi * p), y * env * np.sin(0.5 * np.pi * p)], axis=1)
        return edge(st.astype(F32), 0.003, 0.05), -8
    if kind == 'swell':                     # gestimmte Anschwellung aus Akkordtönen
        n = int(3.2 * SR)
        t = np.arange(n) / SR
        x = t / t[-1]
        env = np.where(x < 0.55, np.sin(0.5 * np.pi * x / 0.55) ** 2, np.cos(0.5 * np.pi * (x - 0.55) / 0.45) ** 2)
        notes = sorted(set(fold(m, 60, 79) for m in ch['upper']))[:4]
        st = np.zeros((n, 2), F32)
        for m in notes:
            f = float(hz(m))
            for c, d in ((0, -4), (1, 4)):
                fr = f * 2 ** (d / 1200)
                y = np.sin(TAU * fr * t + m) + (0.25 * x) * np.sin(2 * TAU * fr * t + 2 * m) + (0.08 * x) * np.sin(3 * TAU * fr * t)
                st[:, c] += y * env * pad_amp(m)
        return edge(st, 0.01, 0.05), -8
    if kind == 'low':                       # tiefer, weicher Ton auf dem Grundton (ernste Momente)
        n = int(3.0 * SR)
        t = np.arange(n) / SR
        f = float(hz(fold(ch['bass'], 36, 48)))
        env = (1 - np.exp(-t / 0.08)) * np.exp(-t / 0.95)
        y = (np.sin(TAU * f * t) + 0.35 * np.sin(TAU * 2 * f * t) + 0.1 * np.sin(TAU * 3 * f * t) + 0.12 * np.sin(TAU * 4 * f * t)) * env
        return edge(y.astype(F32), 0.01, 0.2), -6
    if kind == 'boom':                      # tiefer, weicher Schlag nur für große Übergänge (+ zarter Oberton-Schimmer)
        n = int(5.5 * SR)
        t = np.arange(n) / SR
        f0 = float(hz(fold(ch['bass'], 29, 41)))
        f = f0 * (1 + 0.7 * np.exp(-t / 0.06))
        ph = TAU * np.cumsum(f) / SR
        env = (0.72 * np.exp(-t / 1.15) + 0.28 * np.exp(-t / 0.22)) * (1 - np.exp(-t / 0.006))
        y = (np.sin(ph) + 0.32 * np.sin(2 * ph) * np.exp(-t / 0.5)) * env
        y += 0.1 * filt(sos_lp(180, 2), rng.standard_normal(n)) * np.exp(-t / 0.2) * (1 - np.exp(-t / 0.005))
        st = np.stack([y, y], axis=1).astype(F32)
        for j, m in enumerate(sorted(set(fold(m + 24, 79, 92) for m in ch['upper']))):
            fr = float(hz(m))
            s = np.sin(TAU * fr * t + j) * (1 - np.exp(-t / 0.08)) * np.exp(-t / 1.6) * 0.04
            gl, gr = pan_gains(0.3 + 0.4 * (j % 2))
            st[:, 0] += s * gl
            st[:, 1] += s * gr
        return edge(st, 0.0, 0.3), -2
    if kind == 'grow':                      # Wachstum: aufsteigende Akkordtöne + Luft
        n = int(2.2 * SR)
        st = np.zeros((n, 2), F32)
        tones = chord_tones(ch, 72, 93)
        start = int(rng.integers(0, max(1, len(tones) - 5)))
        for j, m in enumerate(tones[start:start + 5]):
            d = int((0.075 * j - 0.004 * j * j) * SR)
            p = ping(float(hz(m)), n - d, 0.45, 0.5) * (0.75 + 0.06 * j)
            gl, gr = pan_gains(0.3 + 0.1 * j)
            st[d:, 0] += p * gl
            st[d:, 1] += p * gr
        air = swept_noise(1.0, 900, 5500, 0.8, int(rng.integers(1_000_000)))
        e = np.sin(np.pi * np.arange(len(air)) / len(air)) ** 2 * 0.1
        st[: len(air)] += (air * e)[:, None]
        return edge(st, 0.002, 0.08), -8
    if kind == 'dissolve':                  # Zerfall in feine Partikel
        n = int(1.9 * SR)
        st = np.zeros((n, 2), F32)
        times = np.cumsum(rng.exponential(0.045, 26))
        for j, d in enumerate(times[times < 1.35]):
            f = float(hz(pick(ch, 91, 105, rng)))
            a = int(d * SR)
            p = ping(f, n - a, rng.uniform(0.03, 0.07), 0.4) * np.exp(-d / 0.55) * rng.uniform(0.5, 1)
            gl, gr = pan_gains(rng.uniform(0.2, 0.8))
            st[a:, 0] += p * gl
            st[a:, 1] += p * gr
        return edge(st, 0.001, 0.08), -10
    if kind == 'wrap':                      # Myelin wickelt sich: rotierende Luft + zarter Ton
        n = int(1.5 * SR)
        t = np.arange(n) / SR
        y = filt(sos_bp(700, 2600), rng.standard_normal(n))
        y /= np.std(y) + 1e-9
        am = np.sin(TAU * 2.25 * t) ** 2
        tone = 0.25 * np.sin(TAU * float(hz(pick(ch, 67, 79, rng))) * t)
        env = np.sin(np.pi * t / t[-1]) ** 1.5
        s = (0.5 * y + tone) * am * env
        p = 0.5 + 0.3 * np.sin(TAU * 1.1 * t)
        st = np.stack([s * np.cos(0.5 * np.pi * p), s * np.sin(0.5 * np.pi * p)], axis=1)
        return edge(st.astype(F32), 0.01, 0.05), -9
    if kind == 'engulf':                    # Mikroglia nimmt auf: weiches „Schlucken“, Ton gleitet nach unten
        n = int(1.0 * SR)
        t = np.arange(n) / SR
        f1 = float(hz(pick(ch, 62, 70, rng)))
        f = f1 * (0.4 + 0.6 * np.exp(-t / 0.18))
        ph = TAU * np.cumsum(f) / SR
        env = (1 - np.exp(-t / 0.025)) * np.exp(-t / 0.28)
        y = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * env
        y += 0.08 * filt(sos_lp(500), rng.standard_normal(n)) * env
        return edge(y.astype(F32), 0.002, 0.1), -7
    if kind == 'release':                   # Vesikel geben Botenstoff frei: feine Bläschen + weicher Impuls
        n = int(1.2 * SR)
        st = np.zeros((n, 2), F32)
        times = np.cumsum(rng.exponential(0.04, 18))
        for d in times[times < 0.8]:
            ln = int(0.06 * SR)
            tt = np.arange(ln) / SR
            f = float(hz(pick(ch, 79, 91, rng)))
            b = np.sin(TAU * f * (tt + 1.4 * tt * tt)) * np.exp(-tt / 0.016) * (1 - np.exp(-tt / 0.001)) * np.exp(-d / 0.6)
            a = int(d * SR)
            gl, gr = pan_gains(rng.uniform(0.25, 0.75))
            st[a:a + ln, 0] += b * gl
            st[a:a + ln, 1] += b * gr
        return edge(st, 0.001, 0.05), -9
    if kind == 'pulse':                     # weicher Doppelpuls (Taktgeber)
        n = int(1.1 * SR)
        t = np.arange(n) / SR
        f0 = float(hz(fold(ch['bass'], 36, 48)))
        y = np.zeros(n)
        for d, a in ((0.0, 1.0), (0.27, 0.7)):
            tt = np.maximum(0, t - d)
            ph = TAU * f0 * tt + 0.4 * np.sin(np.minimum(tt, 0.1) * 30)
            y += a * (t >= d) * (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.exp(-tt / 0.12) * (1 - np.exp(-tt / 0.003))
        return edge(y.astype(F32), 0.0, 0.1), -6
    return np.zeros(int(0.1 * SR), F32), -40


def momentary_lufs(sig, win=0.2):
    x = sig if sig.ndim == 2 else sig[:, None]
    k = sosfilt(K_SOS, x, axis=0)
    w = int(win * SR)
    ms = uniform_filter1d((k ** 2).sum(axis=1), size=w, mode='constant')
    return -0.691 + 10 * np.log10(ms.max() + 1e-12)


SFX_REF_LUFS = -25.0


def build_sfx(events, n):
    out = np.zeros((n, 2), F32)
    rng = np.random.default_rng(11)
    stats = {}
    for i, e in enumerate(events):
        t = max(0.0, float(e['t']))
        sig, target = sfx_render(e['type'], t, rng)
        g = float(e.get('gain', 1.0))
        want = SFX_REF_LUFS + target + 20 * np.log10(max(g, 1e-3))
        have = momentary_lufs(sig)
        sig = sig * F32(10 ** ((want - have) / 20))
        if sig.ndim == 1:
            gl, gr = pan_gains(0.5 + 0.2 * np.sin(i * 1.3))
            add_at(out, t, sig, gl, gr)
        else:
            add_at(out, t, sig)
        stats[e['type']] = stats.get(e['type'], 0) + 1
    log('  Effekte: ' + ', '.join(f'{k}×{v}' for k, v in sorted(stats.items())))
    return out


# ================================================================== Ducking / Mischung
def voice_activity(voice):
    """Sprachaktivität auf Steuerrate: 0/1 (Hold überbrückt Wortlücken) und geglättete Duck-Kurve."""
    m = len(voice) // HOP * HOP
    fr = np.sqrt(np.mean(voice[:m].reshape(-1, HOP).astype(np.float64) ** 2, axis=1))
    fr = uniform_filter1d(fr, 4)
    act = (20 * np.log10(fr + 1e-9) > -44).astype(float)
    act = np.pad(act, (0, int(DUR * CR) + 2 - len(act)), mode='constant')[: int(DUR * CR) + 2]
    held = maximum_filter1d(act, size=int(0.8 * CR) + 1)          # ±0.4 s Hold
    k = np.hanning(int(0.8 * CR))                                   # Look-ahead/Glättung (±0.4 s)
    sm = np.convolve(held, k / k.sum(), mode='same')
    return act, np.clip(sm, 0, 1)


def limiter(x, thr_db=-1.0, look=0.003, rel=0.08):
    """Sanfter Look-ahead-Peak-Limiter (nur Spitzen über der Schwelle werden weich abgesenkt)."""
    thr = 10 ** (thr_db / 20)
    pk = np.abs(x).max(axis=1)
    g = np.minimum(1.0, thr / np.maximum(pk, 1e-9)).astype(F32)
    if g.min() >= 1.0:
        return x, 0.0
    w = int(look * SR) * 2 + 1
    g = minimum_filter1d(g, size=w)
    g = minimum_filter1d(g, size=int(rel * SR))
    g = uniform_filter1d(g, size=int(look * SR) + 1)
    g = np.minimum(g, uniform_filter1d(g, size=int(rel * SR)))
    return x * g[:, None], float(20 * np.log10(g.min()))


def tpdf16(x, seed):
    """TPDF-Dither für 16-bit-Export (leise Musik-/Hallfahnen ohne Quantisierungsverzerrung)."""
    rng = np.random.default_rng(seed)
    lsb = 1.0 / 32768
    out = np.empty_like(x)
    blk = SR * 30
    for a in range(0, len(x), blk):
        b = min(len(x), a + blk)
        d = (rng.random((b - a, x.shape[1]), dtype=F32) - rng.random((b - a, x.shape[1]), dtype=F32)) * F32(lsb)
        out[a:b] = x[a:b] + d
    return np.clip(out, -1, 1 - lsb)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x, dtype=np.float64))) + 1e-12)


def main():
    events = json.load(open(path('data', 'sfx_events.json')))
    voice, sr = sf.read(path('audio', 'narration.wav'), dtype='float32')
    assert sr == SR
    if voice.ndim > 1:
        voice = voice.mean(axis=1)
    n = len(voice)
    log(f'{len(CHORDS)} Akkorde, {n / SR:.1f} s')
    E = energy_curve()
    act, duck_c = voice_activity(voice)

    # ---------------------------------------------------------- Musik
    dry = np.zeros((n, 2), F32)
    send = np.zeros((n, 2), F32)

    def mix_in(layer, gain, snd, name):
        r = rms_db(layer)
        dry[:] += layer * F32(gain)
        if snd:
            send[:] += layer * F32(gain * snd)
        log(f'  {name:8s} {r + 20 * np.log10(gain):6.1f} dB')

    log('Pad …')
    pad, _ = layer_pad(n, E)
    # Helligkeit folgt der Energie: y = x + β·(x − LP(x))  (β < 0 dunkler, β > 0 heller)
    beta = np.clip(-0.5 + 1.25 * (E - 0.35), -0.55, 0.7)
    low = filt(sos_lp(1800, 2), pad)
    pad += (pad - low) * up(beta, n)[:, None]
    del low
    pad *= up(0.78 + 0.5 * E, n)[:, None]
    mix_in(pad, 1.0, 0.42, 'Pad')
    del pad
    log('Bass …')
    mix_in(layer_bass(n), 1.0, 0.0, 'Bass')
    log('Schimmer …')
    mix_in(layer_shimmer(n, E), 1.0, 0.6, 'Schimmer')
    log('Arpeggio …')
    mix_in(layer_arp(n, E, act), 1.0, 0.55, 'Arpeggio')
    log('Motiv, Puls, Aufbauten, Luft …')
    mix_in(layer_motif(n), 1.0, 0.6, 'Motiv')
    mix_in(layer_pulse(n), 1.0, 0.12, 'Puls')
    mix_in(layer_builds(n), 1.0, 0.55, 'Aufbau')
    mix_in(layer_air(n, E), 1.0, 0.3, 'Luft')
    log('Hall …')
    wet = reverb(send, make_ir())
    del send
    music = dry + wet * F32(0.5)
    del dry, wet
    # Klangformung: Subbass < 30 Hz weg, tiefe Mitten schlanker, Präsenz-Kerbe für die Stimme
    music = filt(np.vstack([sos_hp(32, 4), sos_lowshelf(120, -2.5), sos_peak(2600, -3.0, 0.8), sos_peak(380, -1.5, 0.9)]), music)
    # Einblenden aus der Stille, Ausklang des Schlussakkords bis exakt 0
    fi = int(4.5 * SR)
    music[:fi] *= fade_in(fi)[:, None]
    fo = int(3.0 * SR)
    music[-fo:] *= fade_out(fo)[:, None]
    music -= music.mean(axis=0, keepdims=True)

    # ---------------------------------------------------------- Effekte
    log('Soundeffekte …')
    fx = build_sfx(events, n)
    fx_wet = reverb(fx * F32(0.35), make_ir((2.4, 2.0, 1.1), 3.0, 0.018, 0.3, seed=78), hp=250, lp=7000)
    fx = filt(sos_hp(35, 4), fx + fx_wet * F32(0.6))
    del fx_wet
    fx[-int(0.5 * SR):] *= fade_out(int(0.5 * SR))[:, None]

    # ---------------------------------------------------------- Ducking + Pegel
    log('Ducking, Pegel, Mix …')
    music *= up(db2a(-7.0 * duck_c), n)[:, None]
    fx *= up(db2a(-4.0 * duck_c), n)[:, None]
    # Musikpegel: Median der sprachaktiven 400-ms-Fenster 19 dB unter der Stimme
    w = int(0.4 * SR)
    m = n // w * w
    vr = np.sqrt(np.mean(voice[:m].reshape(-1, w).astype(np.float64) ** 2, axis=1))
    mr = np.sqrt(np.mean(music[:m].mean(axis=1).reshape(-1, w).astype(np.float64) ** 2, axis=1))
    on = vr > 10 ** (-40 / 20)
    rel = np.median(20 * np.log10(vr[on]) - 20 * np.log10(mr[on] + 1e-9))
    music *= F32(10 ** ((rel - 19.0) / 20))
    sf.write(path('audio', 'music.wav'), tpdf16(music, 1), SR, subtype='PCM_16')
    sf.write(path('audio', 'sfx.wav'), tpdf16(fx, 2), SR, subtype='PCM_16')
    mix = np.stack([voice, voice], axis=1) * F32(0.98)
    mix += music
    mix += fx
    mix, gr = limiter(mix, -1.0)
    sf.write(path('audio', 'mix.wav'), mix, SR, subtype='PCM_24')
    log(f'Pegel: Stimme {rms_db(voice):.1f} dBFS RMS · Musik {rms_db(music):.1f} · Effekte {rms_db(fx):.1f} · '
        f'Spitze Mix {20 * np.log10(np.abs(mix).max()):.1f} dBFS (Limiter max. {gr:.1f} dB)')
    del mix
    for name in ('narration', 'music', 'sfx'):
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path('audio', f'{name}.wav'), '-c:a', 'libmp3lame', '-b:a',
                        {'narration': '96k', 'music': '128k', 'sfx': '96k'}[name], '-ac', '1' if name == 'narration' else '2',
                        path('audio', f'{name}.mp3')], check=True)
    log('fertig: audio/music.wav, sfx.wav, mix.wav, *.mp3')


if __name__ == '__main__':
    main()
