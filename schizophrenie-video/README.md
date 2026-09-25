# Die Entstehung von Schizophrenie bei Kindern und Jugendlichen

Deutschsprachiges, wissenschaftlich fundiertes **Motion-Graphics-Erklärvideo** (≈ 19 Minuten, 1920 × 1080, 30 fps, H.264 / AAC 48 kHz) für eine schulische Präsentation.
Die komplette Bildsprache besteht aus zeitbasiert animierten Vektorgrafiken (Canvas 2D). Jede Bewegung hängt an **einer zentralen Zeitachse**, und diese Zeitachse stammt aus dem **Voiceover** (Audio-first).

> **Zentrale Botschaft:** Schizophrenie entsteht wahrscheinlich nicht durch eine einzelne Ursache, sondern durch das Zusammenspiel genetischer Vulnerabilität, Gehirnentwicklung, synaptischer Reifung, Neurotransmittersysteme, Immunprozesse und Umweltfaktoren über viele Jahre hinweg. **Risiko ≠ Schicksal.**

## Ergebnis

| Datei | Inhalt |
|---|---|
| `render/final.mp4` | Endfassung 1080p mit eingebrannten Untertiteln (Wort-Hervorhebung) |
| `render/preview.mp4` | kleinere 720p-Fassung |
| `captions/de.vtt`, `captions/de.srt` | Untertitel (z. B. für PowerPoint: *Einfügen → Video → Untertitel einfügen*) |
| `audio/narration.mp3`, `music.mp3`, `sfx.mp3` | getrennte Tonspuren (für die Browser-Vorschau) |
| `data/script.de.txt` | vollständiger Sprechertext mit visuellen Beats `{cue}` |
| `docs/recherche-faktencheck.md` | Faktencheck aller Kernaussagen mit Quellen (DOIs) |
| `docs/qa-bericht.md` | automatischer Qualitätsbericht (Punkt 42 des Briefings) |

## Dramaturgie (24 Szenen, 7 Akte)

| Akt | Szenen |
|---|---|
| Prolog | Lichtpunkt → Neuron → Netzwerk → Gehirn → sechs Pfade → Titel |
| I – Das Gehirn entwickelt sich | Was ist Schizophrenie? · Neuroentwicklungsmodell · Kindheit bis junges Erwachsenenalter (Synapsen, Axon, Myelin, präfrontaler Kortex) |
| II – Viele Faktoren | Netz aus Einflüssen · Genetik (Zwillinge, polygen, 287 Genregionen, 22q11.2) · pränatal/perinatal |
| III – Umbau | Adoleszenz („Das Gehirn wird nicht einfach größer. Es wird umgebaut.“) · synaptisches Pruning |
| IV – Zusammenspiel | Mikroglia · Komplement/C4 · Glutamat & Glutamat-Glutamin-Zyklus · NMDA-Hypothese · GABA & Gamma-Rhythmen · Dopamin · Netzwerk-Synthese |
| V – Belastungen | Stress & Stressachse (HPA) · Cannabis/THC/CB1 |
| VI – Risiko | Vulnerabilitäts-Stress-Modell (Federwaage mit Schwelle) · drei Lebenswege · frühe Zeichen (Prodrom) · Symptombereiche |
| VII – Risiko ist nicht Schicksal | große Zusammenfassung · Ausblick, Hilfe-Nummern, Quellen |

## Projektstruktur

```
src/
  main.html        Player (Play/Pause/Neustart, Zeitleiste mit Szenenmarkern,
                   Voiceover/Musik/Untertitel/Debug ein/aus)
  main.js          Hintergrund, Übergänge, Untertitel mit Wort-Highlight, Debug-Overlay, Render-API
  animation.js     Kern: Easing, deterministischer Zufall, Rauschen, Farben, virtuelle Kamera,
                   Glühen, Pfade, Text, Neuronen, Gehirn, Silhouette
  timeline.js      zentrale Zeitachse: scene.start/end, enter()/update()/exit(), Cue-Zugriff S.on('cue')
  styles.css
  scenes/          eine Datei pro Themenblock (intro, development, genetics, prenatal, adolescence,
                   pruning, inflammation, complement, glutamate, nmda, gaba, dopamine, synthesis,
                   stress, cannabis, risk-network, risk-model, clinical, conclusion) + shared.js
assets/            Inter-Schrift (OFL) und SVG-Grundformen (brain, neuron, synapse, dna, microglia)
audio/             narration / music / sfx (+ mix.wav lokal, nicht im Repo)
captions/          de.vtt, de.srt
data/              script.de.txt, lexicon.de.json (Aussprache), timings.json/.js, sfx_events.json
tools/             build_narration.py, tts/engines.py, tts/align.py, build_audio.py,
                   render.mjs, stills.mjs, export_events.mjs, qa_check.py, serve.mjs
render/            final.mp4, preview.mp4
docs/              Faktencheck und QA-Bericht
```

## Audio-first-Pipeline

1. **Sprechertext** schreiben: `data/script.de.txt` – jede Zeile eine Sprecheinheit, `{cue}` vor einem Wort erzeugt einen visuellen Beat genau auf diesem Wort.
2. **TTS erzeugen** (austauschbare Engine) und
3. **Audio analysieren**: Satz- und Wortzeiten werden bestimmt (Engine-Zeitstempel oder DTW-Abgleich gegen eine eSpeak-Referenz),
4. **Animation** liest `data/timings.js` – Szenen reagieren über `S.on('cue')` wortgenau,
5. **Untertitel** entstehen aus denselben Zeiten (`captions/de.vtt`).

```bash
python3 tools/build_narration.py             # 1–3 + 5 (Standard: SVOX Pico, offline)
node tools/export_events.mjs                 # Soundeffekt-Ereignisse aus den Cues
python3 tools/build_audio.py                 # Musik, Sounddesign, Ducking, Mischung
node tools/render.mjs                        # → render/master (deterministisch, Bild für Bild)
python3 tools/qa_check.py render/final.mp4   # Qualitätsbericht
```

### Stimme austauschen (ElevenLabs, Piper, Edge)

Die Animation hängt **nicht** von der TTS-Engine ab – sie liest nur `timings.json`. Eine andere Stimme erzeugt neue Zeiten, und alles (Beats, Untertitel, Musik-Ducking) passt sich automatisch an:

```bash
# ElevenLabs (liefert Zeichen-Zeitstempel → exakte Wortsynchronisation)
export ELEVENLABS_API_KEY=...  ELEVENLABS_VOICE_ID=...   # ruhige deutsche Frauenstimme
python3 tools/build_narration.py --engine elevenlabs

# Piper (offline, z. B. de_DE-kerstin-low / de_DE-ramona-low / de_DE-eva_k-x_low)
PIPER_MODEL=/pfad/de_DE-kerstin-low.onnx python3 tools/build_narration.py --engine piper

# Microsoft Edge Online-TTS (pip install edge-tts)
python3 tools/build_narration.py --engine edge --voice de-DE-KatjaNeural
```

Danach `export_events.mjs`, `build_audio.py` und `render.mjs` erneut ausführen.
Hinweis: Die mitgelieferte Fassung wurde in einer Umgebung ohne Zugang zu ElevenLabs/Hugging Face/Edge erzeugt und nutzt deshalb die freie deutsche Frauenstimme **SVOX Pico** (Apache-2.0). Die Adapter für ElevenLabs, Piper und Edge sind vorbereitet, konnten dort aber nicht getestet werden.

## Vorschau im Browser

```bash
npm install          # nur playwright-core (für Rendern/Standbilder)
npm run preview      # → http://localhost:8080/src/main.html
```

Tasten: `Leertaste` Play/Pause · `←/→` ±5 s · `u` Untertitel · `d` Debug (Szene, Zeit, Voiceover-Zeit, Szenenfortschritt, nahe Cues).
`?t=300` springt zu Sekunde 300, `?debug` startet mit Debug-Anzeige.

## Visuelle Identität (durchgehend konsistent)

| System | Farbe |
|---|---|
| Genetik / DNA | violett `#b18cff` |
| Glutamat | cyan `#2ee6ff` (Glutamin: mint) |
| GABA | grün `#3ee089` |
| Dopamin | gelb `#ffd23f` |
| Mikroglia | orange `#ff9f43` |
| Komplement | pink `#ff6fb5` |
| Stress | warmes Rot `#ff5a4f` |
| Myelin | helles Elfenbein `#fff4dc` |
| THC | limette `#c6f25a` |
| Nervenzellen | kühles Weißblau `#bcd4ff` |

Schrift: Inter / Inter Display (Überschriften Bold, Fließtext Regular, Fachbegriffe SemiBold).

## Medizinische Genauigkeit

Alle Aussagen sind als Assoziation, Risiko oder Hypothese formuliert („kann beitragen“, „wird untersucht“, „erhöhtes Risiko“, „Forschungsmodell“). Vermieden werden u. a. „Schizophrenie = Dopaminüberschuss“, „= Glutamatmangel“, „= zu viel Pruning“, „Cannabis/Trauma = Ursache“, „Gen X = Schizophrenie“. Zahlen und Quellen: `docs/recherche-faktencheck.md`.

**Wissenschaftliches Erklärmodell – keine individuelle Diagnose.**
Hilfe (Deutschland): Nummer gegen Kummer 116 111 · TelefonSeelsorge 0800 111 0 111 / 0800 111 0 222 · Notfall 112.

## Lizenzen

- Schrift **Inter** – SIL Open Font License (`assets/fonts/LICENSE-Inter.txt`)
- Stimme **SVOX Pico** (`libttspico`) – Apache License 2.0
- Musik und Soundeffekte – prozedural erzeugt in diesem Projekt (`tools/build_audio.py`)
