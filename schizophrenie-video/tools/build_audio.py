#!/usr/bin/env python3
"""
Musik + Sounddesign + Mischung (alles prozedural, lizenzfrei, deterministisch).

Eingaben : audio/narration.wav, data/timings.json, data/sfx_events.json
Ausgaben : audio/music.wav, audio/sfx.wav, audio/mix.wav (48 kHz Stereo)
           audio/narration.mp3, audio/music.mp3, audio/sfx.mp3 (für die Browser-Vorschau)

Prinzip: Voiceover bleibt immer dominant (−16 LUFS); Musik wird unter Sprache
automatisch abgesenkt (Ducking), Effekte sind dezent.
"""
import json
import os
import subprocess

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, oaconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
RNG = np.random.default_rng(7)


def path(*p):
    return os.path.join(ROOT, *p)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, f1, f2, order=2):
    return sosfilt(butter(order, [f1, f2], 'band', fs=SR, output='sos'), x, axis=0)


def reverb_ir(seconds=3.2, predelay=0.02, bright=6000):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2), np.float32)
    for ch in range(2):
        noise = RNG.standard_normal(n).astype(np.float32)
        noise = lp(noise, bright)
        ir[:, ch] = noise * np.exp(-t * 6.9 / seconds)
    ir[: int(predelay * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True)) + 1e-9
    return ir


def add_reverb(x, wet=0.25, seconds=3.2):
    ir = reverb_ir(seconds)
    y = np.zeros_like(x)
    for ch in range(2):
        y[:, ch] = oaconvolve(x[:, ch], ir[:, ch], mode='full')[: len(x)]
    return x * (1 - wet) + y * wet


# ------------------------------------------------------------------ Musik
PROG = [  # ruhige modale Harmonik (d-Moll / F-Dur), Akkordtöne als MIDI
    [50, 57, 62, 65, 69, 76],   # Dm9-Farbe
    [46, 53, 58, 62, 65, 69],   # Bbmaj7
    [41, 48, 53, 57, 60, 64],   # Fmaj7
    [48, 55, 60, 64, 67, 74],   # C (add9)
    [45, 52, 57, 60, 64, 71],   # Am7(add9)
    [46, 53, 58, 62, 65, 72],   # Bb(add9)
    [43, 50, 55, 58, 62, 69],   # Gm9
    [45, 52, 57, 61, 64, 69],   # A (Spannung, sanft)
]
INTENSITY = {
    'intro': 0.35, 'whatis': 0.3, 'neurodev': 0.35, 'development': 0.4, 'riskmap': 0.4, 'genetics': 0.45, 'prenatal': 0.4,
    'adolescence': 0.72, 'pruning': 0.55, 'microglia': 0.5, 'complement': 0.5, 'glutamate': 0.55, 'nmda': 0.55, 'gaba': 0.58,
    'dopamine': 0.6, 'synthesis': 0.72, 'stress': 0.5, 'cannabis': 0.5, 'model': 0.5, 'lives': 0.45, 'prodrome': 0.4,
    'symptoms': 0.45, 'summary': 0.78, 'conclusion': 0.55,
}


def intensity_curve(timings, n):
    t = np.arange(n) / SR
    curve = np.zeros(n, np.float32)
    for sc in timings['scenes']:
        a, b = int(sc['start'] * SR), int(sc['end'] * SR)
        curve[a:b] = INTENSITY.get(sc['id'], 0.45)
    # sanft glätten (≈ 4 s)
    k = int(4 * SR)
    kern = np.hanning(k).astype(np.float32)
    kern /= kern.sum()
    curve = oaconvolve(curve, kern, mode='same').astype(np.float32)
    # Intro: aus der Stille
    curve *= np.clip(t / 8.0, 0, 1)
    return curve


def pad(n, chord_len=8.0):
    out = np.zeros((n, 2), np.float32)
    seg = int(chord_len * SR)
    fade = int(2.5 * SR)
    t_seg = np.arange(seg + fade) / SR
    env = np.ones(seg + fade, np.float32)
    env[:fade] = np.linspace(0, 1, fade) ** 1.5
    env[-fade:] = np.linspace(1, 0, fade) ** 1.5
    i = 0
    pos = 0
    while pos < n:
        chord = PROG[i % len(PROG)]
        buf = np.zeros((seg + fade, 2), np.float32)
        for j, m in enumerate(chord):
            f = midi(m + 12 if j >= 4 else m)
            amp = [0.0, 0.5, 0.42, 0.36, 0.22, 0.14][j] if j > 0 else 0.0
            if amp == 0:
                continue
            for ch, det in ((0, -0.12), (1, 0.13)):
                ph = RNG.uniform(0, 2 * np.pi)
                lfo = 1 + 0.002 * np.sin(2 * np.pi * 0.11 * t_seg + ph)
                s = np.sin(2 * np.pi * (f + det) * t_seg * lfo + ph) + 0.18 * np.sin(2 * np.pi * 2 * (f + det) * t_seg + ph)
                buf[:, ch] += (amp * s).astype(np.float32)
        # Grundton als weicher Bass
        fb = midi(chord[0] - 12)
        bass = 0.55 * np.sin(2 * np.pi * fb * t_seg)
        buf[:, 0] += bass
        buf[:, 1] += bass
        buf *= env[:, None]
        end = min(n, pos + seg + fade)
        out[pos:end] += buf[: end - pos]
        pos += seg
        i += 1
    return lp(out, 2400) * 0.12


def arpeggio(n, intens, bpm=72, chord_len=8.0):
    out = np.zeros((n, 2), np.float32)
    step = 60 / bpm / 2  # Achtel
    note_len = int(1.6 * SR)
    tn = np.arange(note_len) / SR
    k = 0
    t = 0.0
    while t < n / SR - 2:
        lvl = float(intens[min(n - 1, int(t * SR))])
        if lvl > 0.42:
            chord = PROG[int(t // chord_len) % len(PROG)]
            pattern = [2, 3, 4, 3, 5, 4, 3, 4]
            m = chord[pattern[k % 8]] + 12
            f = midi(m)
            env = np.exp(-tn * 3.2) * (1 - np.exp(-tn * 200))
            s = np.sin(2 * np.pi * f * tn + 0.6 * np.sin(2 * np.pi * f * 2 * tn) * np.exp(-tn * 6))
            g = (lvl - 0.42) * 0.9 * (0.75 if k % 2 else 1.0)
            pan = 0.5 + 0.35 * np.sin(k * 0.7)
            a = int(t * SR)
            e = min(n, a + note_len)
            out[a:e, 0] += (s * env * g * (1 - pan))[: e - a]
            out[a:e, 1] += (s * env * g * pan)[: e - a]
        t += step
        k += 1
    return lp(out, 5000) * 0.085


def pulse_layer(n, intens, bpm=60):
    out = np.zeros((n, 2), np.float32)
    beat = 60 / bpm
    ln = int(0.5 * SR)
    tt = np.arange(ln) / SR
    thump = (np.sin(2 * np.pi * (48 + 30 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 9)).astype(np.float32)
    t = 0.0
    while t < n / SR - 1:
        lvl = float(intens[min(n - 1, int(t * SR))])
        a = int(t * SR)
        e = min(n, a + ln)
        g = 0.05 + 0.3 * max(0.0, lvl - 0.35)
        out[a:e] += (thump[: e - a] * g)[:, None]
        t += beat
    return out * 0.35


def air(n, intens):
    noise = RNG.standard_normal((n, 2)).astype(np.float32)
    noise = bp(noise, 1800, 7000)
    t = np.arange(n) / SR
    mod = 0.5 + 0.5 * np.sin(2 * np.pi * 0.05 * t)[:, None]
    return noise * mod * (0.004 + 0.006 * intens[:, None])


# ------------------------------------------------------------------ Soundeffekte
def env_ar(n, a, r):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(r, 1e-4))


def sfx(kind, rng):
    if kind == 'click':
        n = int(0.09 * SR); t = np.arange(n) / SR
        s = np.sin(2 * np.pi * rng.uniform(1800, 2600) * t) * np.exp(-t * 90) * 0.5 + bp(rng.standard_normal(n), 2000, 9000) * np.exp(-t * 140) * 0.35
        return s, 0.25
    if kind == 'chime':
        n = int(2.2 * SR); t = np.arange(n) / SR
        f = midi(rng.choice([74, 76, 79, 81, 86]))
        s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.01 * t) + 0.12 * np.sin(2 * np.pi * f * 3.02 * t)) * env_ar(n, 0.005, 0.7)
        return s, 0.16
    if kind == 'impulse':
        n = int(0.6 * SR); t = np.arange(n) / SR
        s = np.sin(2 * np.pi * (40 + 80 * np.exp(-t * 20)) * t) * np.exp(-t * 7) + 0.15 * bp(rng.standard_normal(n), 3000, 9000) * np.exp(-t * 60)
        return s, 0.5
    if kind == 'spark':
        n = int(0.6 * SR); t = np.arange(n) / SR
        s = sum(np.sin(2 * np.pi * rng.uniform(3500, 7000) * t) * np.exp(-(t - d) ** 2 / 0.0004) for d in rng.uniform(0.02, 0.4, 6))
        return s, 0.12
    if kind in ('whoosh', 'whooshOut'):
        n = int(1.6 * SR); t = np.arange(n) / SR
        noise = rng.standard_normal(n)
        out = np.zeros(n)
        seg = 1024
        for i in range(0, n, seg):
            k = i / n if kind == 'whoosh' else 1 - i / n
            fc = 250 * (14 ** k)
            out[i:i + seg] = bp(noise[max(0, i - 2048):i + seg], fc * 0.7, min(fc * 1.4, 20000))[-len(noise[i:i + seg]):]
        s = out * np.sin(np.pi * t / t[-1]) ** 2
        return s, 0.35
    if kind == 'swell':
        n = int(3.5 * SR); t = np.arange(n) / SR
        f = midi(rng.choice([57, 62, 65]))
        s = sum(np.sin(2 * np.pi * f * m * t) * a for m, a in ((1, 1), (1.5, 0.5), (2, 0.35), (3, 0.12)))
        s *= np.sin(np.pi * t / t[-1]) ** 2
        return lp(s, 3000), 0.12
    if kind == 'low':
        n = int(2.6 * SR); t = np.arange(n) / SR
        s = np.sin(2 * np.pi * 55 * t) * env_ar(n, 0.3, 1.0) + 0.3 * np.sin(2 * np.pi * 110 * t) * env_ar(n, 0.3, 0.6)
        return s, 0.3
    if kind == 'boom':
        n = int(4.0 * SR); t = np.arange(n) / SR
        s = np.sin(2 * np.pi * (36 + 30 * np.exp(-t * 4)) * t) * np.exp(-t * 1.3) + 0.2 * lp(rng.standard_normal(n), 400) * np.exp(-t * 3)
        return s, 0.55
    if kind == 'grow':
        n = int(2.0 * SR); t = np.arange(n) / SR
        f = 200 * (1 + t)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / t[-1]) ** 2 * 0.6 + bp(rng.standard_normal(n), 800, 4000) * np.sin(np.pi * t / t[-1]) ** 2 * 0.15
        return s, 0.18
    if kind == 'dissolve':
        n = int(1.6 * SR); s = np.zeros(n)
        for d in np.sort(rng.exponential(0.35, 40)):
            a = int(min(d, 1.4) * SR); ln = int(0.03 * SR); tt = np.arange(ln) / SR
            s[a:a + ln] += np.sin(2 * np.pi * rng.uniform(2000, 6000) * tt) * np.exp(-tt * 150) * rng.uniform(0.3, 1)
        return s, 0.14
    if kind == 'wrap':
        n = int(1.4 * SR); t = np.arange(n) / SR
        s = bp(rng.standard_normal(n), 600, 2500) * (np.sin(2 * np.pi * 4 * t) ** 2) * np.sin(np.pi * t / t[-1])
        return s, 0.14
    if kind == 'engulf':
        n = int(0.9 * SR); t = np.arange(n) / SR
        f = 220 * np.exp(-t * 1.6) + 70
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ar(n, 0.04, 0.3)
        return s, 0.35
    if kind == 'release':
        n = int(1.2 * SR); s = np.zeros(n)
        for d in rng.uniform(0, 0.8, 24):
            a = int(d * SR); ln = int(0.06 * SR); tt = np.arange(ln) / SR
            s[a:a + ln] += np.sin(2 * np.pi * rng.uniform(600, 1600) * tt * (1 + tt * 4)) * np.exp(-tt * 60) * 0.6
        return s, 0.14
    if kind == 'pulse':
        n = int(1.0 * SR); t = np.arange(n) / SR
        s = sum(np.sin(2 * np.pi * 60 * (t - d)) * np.exp(-np.maximum(0, t - d) * 12) * (t > d) for d in (0.0, 0.28))
        return s, 0.3
    n = int(0.2 * SR)
    return np.zeros(n), 0


def build_sfx(events, n):
    out = np.zeros((n, 2), np.float32)
    rng = np.random.default_rng(11)
    for i, e in enumerate(events):
        s, g = sfx(e['type'], rng)
        s = np.asarray(s, np.float32) * g * e.get('gain', 1)
        a = int(max(0, e['t']) * SR)
        if a >= n:
            continue
        b = min(n, a + len(s))
        pan = 0.5 + 0.25 * np.sin(i * 1.3)
        out[a:b, 0] += s[: b - a] * (1 - pan) * 1.4
        out[a:b, 1] += s[: b - a] * pan * 1.4
    return out


# ------------------------------------------------------------------ Mischung
def envelope(x, attack=0.05, release=0.45):
    a = np.exp(-1 / (attack * SR / 256)); r = np.exp(-1 / (release * SR / 256))
    blocks = np.sqrt(np.mean(x[: len(x) // 256 * 256].reshape(-1, 256) ** 2, axis=1))
    env = np.zeros_like(blocks)
    v = 0.0
    for i, b in enumerate(blocks):
        v = a * v + (1 - a) * b if b > v else r * v + (1 - r) * b
        env[i] = v
    env = np.repeat(env, 256)
    return np.pad(env, (0, len(x) - len(env)), mode='edge')


def main():
    timings = json.load(open(path('data', 'timings.json'), encoding='utf-8'))
    events = json.load(open(path('data', 'sfx_events.json')))
    voice, sr = sf.read(path('audio', 'narration.wav'), dtype='float32')
    assert sr == SR
    n = len(voice)
    print('Musik …', flush=True)
    intens = intensity_curve(timings, n)
    music = pad(n) * (0.75 + 0.5 * intens[:, None]) + arpeggio(n, intens) + pulse_layer(n, intens) + air(n, intens)
    music = add_reverb(music.astype(np.float32), wet=0.35, seconds=4.0)
    # Ausklang am Ende
    tail = int(8 * SR)
    music[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 2
    print('Soundeffekte …', flush=True)
    fx = add_reverb(build_sfx(events, n), wet=0.3, seconds=2.5)
    # Ducking: Musik bis −7 dB unter Sprache
    venv = envelope(voice)
    duck = 1 - 0.55 * np.clip(venv / (np.percentile(venv, 95) + 1e-9), 0, 1)
    music_d = music * duck[:, None]
    fx_d = fx * (1 - 0.3 * np.clip(venv / (np.percentile(venv, 95) + 1e-9), 0, 1))[:, None]
    # Pegel: Musik ≈ −30 dBFS RMS, Effekte dezent
    def rms_db(x):
        return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    music_d *= 10 ** ((-31 - rms_db(music_d)) / 20)
    fx_d *= 10 ** ((-36 - rms_db(fx_d)) / 20)
    sf.write(path('audio', 'music.wav'), music_d, SR, subtype='PCM_16')
    sf.write(path('audio', 'sfx.wav'), fx_d, SR, subtype='PCM_16')
    mix = np.stack([voice, voice], axis=1) * 0.98 + music_d + fx_d
    peak = np.abs(mix).max()
    if peak > 0.97:
        mix *= 0.97 / peak
    sf.write(path('audio', 'mix.wav'), mix, SR, subtype='PCM_24')
    print(f'Pegel: Stimme {rms_db(voice):.1f} dBFS RMS, Musik {rms_db(music_d):.1f}, Effekte {rms_db(fx_d):.1f}, Spitze Mix {20 * np.log10(np.abs(mix).max()):.1f} dBFS')
    for name in ('narration', 'music', 'sfx'):
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path('audio', f'{name}.wav'), '-c:a', 'libmp3lame', '-b:a', {'narration': '96k', 'music': '112k', 'sfx': '80k'}[name],
                        '-ac', '1' if name == 'narration' else '2', path('audio', f'{name}.mp3')], check=True)
    print('fertig: audio/mix.wav, *.mp3')


if __name__ == '__main__':
    main()
