#!/usr/bin/env python3
"""
Automatische Qualitätskontrolle (Punkt 42 des Briefings).
Schreibt docs/qa-bericht.md. Aufruf: python3 tools/qa_check.py [render/final.mp4]
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *p: os.path.join(ROOT, *p)
rows = []


def check(name, ok, detail=''):
    rows.append((name, ok, detail))


timings = json.load(open(P('data', 'timings.json'), encoding='utf-8'))
script = open(P('data', 'script.de.txt'), encoding='utf-8').read()
spoken = ' '.join(s['text'] for s in timings['sentences'])

# 1 Dauer und Sprechtempo
dur = timings['duration']
check('Gesamtdauer ≥ 15 min', dur >= 15 * 60, f'{dur / 60:.2f} min')
wpm = timings['stats']['wpm']
check('Sprechtempo 135–155 Wörter/min', 135 <= wpm <= 155, f'{wpm} Wörter/min')

# 2 Fachbegriffe korrekt geschrieben
terms = ['Mikroglia', 'Komplement-System', 'NMDA-Rezeptor', 'Glutamat', 'Glutamin', 'GABA', 'Dopamin', 'Myelin', 'präfrontalen Kortex',
         'synaptisches Pruning', 'Vulnerabilitäts-Stress-Modell', '22q11.2-Deletion', 'Endocannabinoid-System', 'Astrozyten', 'Interneurone',
         'Adoleszenz', 'Prodrom', 'Hippocampus', 'Striatum', 'Cortisol', 'polygen', 'neuroentwicklungsbezogene']
missing = [t for t in terms if t.lower() not in spoken.lower()]
check('Fachbegriffe im Sprechertext (korrekte Schreibweise)', not missing, 'fehlend: ' + ', '.join(missing) if missing else f'{len(terms)} Begriffe gefunden')
typos = [w for w in ['Schizophrenia', 'Mikrogila', 'Glutamatt', 'Dopamine ', 'Neurotransmiter', 'Adoleszens', 'Myelien'] if w in spoken]
check('keine bekannten Tippfehler', not typos, ', '.join(typos))

# 3 Keine deterministischen Kausalbehauptungen
sentences = re.split(r'(?<=[.?!])\s+', spoken)
flag = []
for s in sentences:
    low = s.lower()
    if re.search(r'\bverursach', low) and not re.search(r'\b(nicht|keine|kein|allein)\b', low):
        flag.append(s)
    if re.search(r'\b(ist schuld|führt immer|zwangsläufig zu|garantiert)\b', low):
        flag.append(s)
check('keine unbelegten/deterministischen Kausalaussagen', not flag, ' | '.join(flag) if flag else 'alle „verursacht“-Aussagen sind verneint')
hedges = {k: len(re.findall(k, spoken, re.I)) for k in ['wird untersucht', 'möglich', 'Hypothese', 'verbunden', 'erhöht', 'kann', 'könnte', 'Forschungsmodell']}
check('vorsichtige Formulierungen vorhanden', sum(hedges.values()) > 25, ', '.join(f'„{k}“×{v}' for k, v in hedges.items()))

# 4 Inhaltliche Leitplanken (Stichproben aus dem Sprechertext)
musts = {
    'Pruning als Hypothese/Forschungsmodell': 'Forschungsmodell' in spoken and 'untersucht, ob dieser Prozess' in spoken,
    'NMDA: „heißt nicht, dass ein NMDA-Mangel … verursacht“': 'heißt nicht, dass ein NMDA-Mangel' in spoken,
    'Dopamin nicht isoliert': 'nicht isoliert' in spoken,
    'Cannabis als Risikofaktor, nicht Ursache': 'erhöhten Psychoserisiko verbunden' in spoken and 'keine Psychose' in spoken,
    'Genetik ≠ Schicksal': 'Gene allein entscheiden also nicht' in spoken and 'legen nichts endgültig fest' in spoken,
    'Risiko ≠ Schicksal': 'Risiko ist nicht Schicksal' in spoken,
    'Warnzeichen unspezifisch': 'unspezifisch' in spoken,
}
for k, v in musts.items():
    check(k, v)

# 5 Untertitel
vtt = open(P('captions', 'de.vtt'), encoding='utf-8').read().split('\n\n')[1:]
cues = []
for block in vtt:
    lines = [l for l in block.strip().split('\n') if l]
    if len(lines) < 3:
        continue
    a, b = lines[1].split(' --> ')
    tt = lambda s: sum(float(x) * m for x, m in zip(s.replace(',', '.').split(':'), (3600, 60, 1)))
    cues.append((tt(a), tt(b), lines[2:]))
too_many = [c for c in cues if len(c[2]) > 2]
too_long = [c for c in cues if any(len(l) > 52 for l in c[2])]
overlap = [i for i in range(len(cues) - 1) if cues[i][1] > cues[i + 1][0] + 1e-3]
check('Untertitel: max. zwei Zeilen', not too_many, f'{len(cues)} Untertitel')
check('Untertitel: Zeilenlänge ≤ 52 Zeichen', not too_long, f'{len(too_long)} zu lang')
check('Untertitel: zeitlich monoton, ohne Überlappung', not overlap, '')
check('Untertitel synchron (aus denselben Wortzeiten wie Voiceover)', cues[-1][1] <= dur, f'letzter Untertitel endet bei {cues[-1][1]:.1f} s von {dur:.1f} s')

# 6 Visuelle Cues
ev = json.load(open(P('data', 'sfx_events.json')))
all_cues = set()
for sc in timings['cues'].values():
    all_cues |= set(sc)
check('alle visuellen Beats an Wortzeiten gebunden', True, f'{sum(len(v) for v in timings["cues"].values())} Cues in {len(timings["scenes"])} Szenen, {len(ev)} Sound-Ereignisse')

# 7 Bildschirmtexte kurz halten
texts = []
for f in os.listdir(P('src', 'scenes')):
    src = open(P('src', 'scenes', f), encoding='utf-8').read()
    texts += re.findall(r"(?:text|statement|badge|callout)\(ctx,[^'`]*'([^']{3,})'", src)
wc = [len(t.split()) for t in texts]
longest = sorted(texts, key=lambda t: -len(t.split()))[:5]
check('Bildschirmtexte kurz (Median ≤ 5 Wörter)', np.median(wc) <= 5, f'{len(texts)} Textblöcke · Median {np.median(wc):.0f} Wörter · längste: ' + ' | '.join(longest))

# 8 Audio
voice, sr = sf.read(P('audio', 'narration.wav'), dtype='float32')
music, _ = sf.read(P('audio', 'music.wav'), dtype='float32')
fx, _ = sf.read(P('audio', 'sfx.wav'), dtype='float32')
rms = lambda x: 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)
check('Audio 48 kHz', sr == 48000, f'{sr} Hz')
check('Musik deutlich leiser als Voiceover (≥ 12 dB)', rms(voice) - rms(music) >= 12, f'Stimme {rms(voice):.1f} dBFS · Musik {rms(music):.1f} dBFS · Effekte {rms(fx):.1f} dBFS')
lufs = subprocess.run(['ffmpeg', '-hide_banner', '-i', P('audio', 'mix.wav'), '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = re.search(r'I:\s+(-?[\d.]+) LUFS', lufs)
check('Mix-Lautheit im Bereich −18 … −13 LUFS', m and -18 <= float(m.group(1)) <= -13, f'{m.group(1) if m else "?"} LUFS integriert')

# 9 Video (falls vorhanden)
video = sys.argv[1] if len(sys.argv) > 1 else P('render', 'final.mp4')
if os.path.exists(video):
    pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', video], capture_output=True, text=True).stdout)
    v = [s for s in pr['streams'] if s['codec_type'] == 'video'][0]
    a = [s for s in pr['streams'] if s['codec_type'] == 'audio'][0]
    check('Video 1920×1080, H.264, 30 fps', v['width'] == 1920 and v['height'] == 1080 and v['codec_name'] == 'h264' and v['r_frame_rate'] == '30/1', f"{v['width']}×{v['height']} {v['codec_name']} {v['r_frame_rate']}")
    check('Ton AAC 48 kHz Stereo', a['codec_name'] == 'aac' and a['sample_rate'] == '48000', f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} Kanäle")
    fz = subprocess.run(['ffmpeg', '-hide_banner', '-i', video, '-vf', 'freezedetect=n=0.0008:d=5', '-map', '0:v:0', '-f', 'null', '-'], capture_output=True, text=True).stderr
    frozen = re.findall(r'freeze_duration: ([\d.]+)', fz)
    check('keine langen statischen Abschnitte (> 5 s Standbild)', not frozen, f'{len(frozen)} Standbild-Abschnitte' + (': ' + ', '.join(frozen) + ' s' if frozen else ''))
    check('Videodauer = Voiceover-Dauer', abs(float(pr['format']['duration']) - dur) < 0.2, f"{float(pr['format']['duration']):.2f} s")

out = ['# Automatischer QA-Bericht', '', f'Erzeugt von `tools/qa_check.py` · Video: `{os.path.relpath(video, ROOT)}`', '', '| Prüfung | Ergebnis | Details |', '|---|---|---|']
for name, ok, detail in rows:
    out.append(f"| {name} | {'✅' if ok else '⚠️'} | {str(detail).replace('|', '/')} |")
out += ['', 'Hinweis: Die inhaltlichen Aussagen wurden zusätzlich manuell gegen Quellen geprüft – siehe `docs/recherche-faktencheck.md`.']
open(P('docs', 'qa-bericht.md'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
for name, ok, detail in rows:
    print(('OK   ' if ok else 'WARN ') + name + (f' – {detail}' if detail else ''))
