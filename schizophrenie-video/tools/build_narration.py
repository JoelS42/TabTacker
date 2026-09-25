#!/usr/bin/env python3
"""
AUDIO-FIRST PIPELINE
    1. Sprechertext (data/script.de.txt) parsen
    2. Jeden Satz mit der gewählten TTS-Engine erzeugen   (tools/tts/engines.py)
    3. Wortzeiten bestimmen (Engine-Zeitstempel oder DTW)  (tools/tts/align.py)
    4. Sätze mit Pausen zu audio/narration.wav montieren
    5. data/timings.json  (Szenen, Sätze, Wörter, visuelle Cues) schreiben
    6. captions/de.vtt + de.srt aus denselben Zeiten erzeugen

Aufruf:
    python3 tools/build_narration.py                  # Standard: SVOX Pico, offline
    python3 tools/build_narration.py --engine elevenlabs
    python3 tools/build_narration.py --engine piper   (PIPER_MODEL=... setzen)
    python3 tools/build_narration.py --engine edge --voice de-DE-KatjaNeural
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools", "tts"))
from engines import make_engine, strip_markup  # noqa: E402
from align import align_words, speech_bounds  # noqa: E402

OUT_SR = 48000
PUNCT = ".,:;!?“„\"'()–…"


# ------------------------------------------------------------------ Parsing
def parse_script(path):
    scenes = []
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith("==="):
            parts = [p.strip() for p in line[3:].split("|")]
            sc = {"id": parts[0], "title": parts[1], "lead": 1.0, "tail": 0.8, "sentences": []}
            for p in parts[2:]:
                k, v = p.split("=")
                sc[k.strip()] = float(v)
            scenes.append(sc)
            continue
        text, pause = line, 0.45
        if "||" in line:
            text, opts = line.split("||", 1)
            m = re.search(r"pause=([\d.]+)", opts)
            if m:
                pause = float(m.group(1))
        tokens = []
        for tok in text.strip().split():
            cues = re.findall(r"\{([^}]+)\}", tok)
            w = re.sub(r"\{[^}]+\}", "", tok)
            if not w:
                continue
            tokens.append({"w": w, "cues": cues})
        sc = scenes[-1]
        sc["sentences"].append({"id": f"{sc['id']}_{len(sc['sentences']) + 1:02d}", "tokens": tokens, "pause": pause})
    return scenes


def load_lexicon(path):
    lex = json.load(open(path, encoding="utf-8"))
    return lex.get("substring", {}), lex.get("word", {})


def spoken_form(tok, sub, word):
    core = tok.strip(PUNCT)
    if tok in word:
        return word[tok]
    if core and core in word:
        i = tok.find(core)
        return tok[:i] + word[core] + tok[i + len(core):]
    s = tok
    for k, v in sub.items():
        s = s.replace(k, v)
    return s


def build_spoken(tokens, sub, word):
    parts, spans, pos = [], [], 0
    for t in tokens:
        sp = spoken_form(t["w"], sub, word)
        sp = sp.replace("–", ",")
        if parts:
            pos += 1
        spans.append((pos, pos + len(sp)))
        parts.append(sp)
        pos += len(sp)
    return " ".join(parts), spans


# ------------------------------------------------------------------ Audio
def load_mono(path):
    a, sr = sf.read(path, dtype="float32", always_2d=True)
    return a.mean(1), sr


def to_sr(a, sr, target):
    if sr == target:
        return a
    g = np.gcd(sr, target)
    return resample_poly(a, target // g, sr // g).astype(np.float32)


def fade(a, sr, ms=6):
    n = min(len(a) // 2, int(sr * ms / 1000))
    if n > 0:
        r = np.linspace(0, 1, n, dtype=np.float32)
        a[:n] *= r
        a[-n:] *= r[::-1]
    return a


# ------------------------------------------------------------------ Main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", default="pico")
    ap.add_argument("--speed", type=int, default=114, help="pico: Sprechtempo in Prozent")
    ap.add_argument("--voice", default=None, help="edge/espeak/elevenlabs: Stimme")
    ap.add_argument("--only", default=None, help="nur Sätze dieser Szene erzeugen (Test)")
    args = ap.parse_args()

    kw = {}
    if args.engine == "pico":
        kw["speed"] = args.speed
    if args.voice and args.engine in ("edge", "espeak"):
        kw["voice"] = args.voice
    if args.voice and args.engine == "elevenlabs":
        kw["voice_id"] = args.voice
    engine = make_engine(args.engine, **kw)

    scenes = parse_script(os.path.join(ROOT, "data", "script.de.txt"))
    sub, word = load_lexicon(os.path.join(ROOT, "data", "lexicon.de.json"))
    cache = os.path.join(ROOT, "audio", "sentences", args.engine)
    os.makedirs(cache, exist_ok=True)

    t = 0.0
    out_audio = []
    timings = {"engine": args.engine, "sampleRate": OUT_SR, "scenes": [], "sentences": [], "cues": {}}
    n_words = 0
    speech_time = 0.0

    for sc in scenes:
        if args.only and sc["id"] != args.only:
            continue
        sc_start = t
        lead = np.zeros(int(sc["lead"] * OUT_SR), np.float32)
        out_audio.append(lead)
        t += sc["lead"]
        timings["cues"][sc["id"]] = {}
        for si, s in enumerate(sc["sentences"]):
            spoken, spans = build_spoken(s["tokens"], sub, word)
            plain = strip_markup(spoken)
            h = hashlib.sha1(f"{args.engine}|{kw}|{spoken}".encode()).hexdigest()[:10]
            wav = os.path.join(cache, f"{s['id']}_{h}.wav")
            meta_p = wav + ".json"
            if not os.path.exists(wav):
                meta = engine.synth(spoken, wav)
                json.dump(meta, open(meta_p, "w"))
            meta = json.load(open(meta_p))
            a, sr = load_mono(wav)
            a16 = to_sr(a, sr, 16000)
            # Wortzeiten
            if meta.get("words"):
                wpos = [(w["char"], w["start"]) for w in meta["words"]]
                bs, be, _ = speech_bounds(a16, 16000)
            else:
                wpos, (bs, be) = align_words(a16, plain)
            _, _, db = speech_bounds(a16, 16000)
            # Zuschnitt
            c0 = max(0.0, bs - 0.03)
            c1 = min(len(a) / sr, be + 0.09)
            seg = fade(to_sr(a[int(c0 * sr):int(c1 * sr)].copy(), sr, OUT_SR), OUT_SR)
            dur = len(seg) / OUT_SR
            # Token-Startzeiten
            starts = []
            for (s0, s1) in spans:
                st = None
                for (p, tt) in wpos:
                    if s0 <= p < s1:
                        st = tt
                        break
                starts.append(st)
            own = [st is not None for st in starts]
            last = bs
            for i in range(len(starts)):
                if starts[i] is None:
                    starts[i] = last
                last = starts[i]
            words = []
            for i, tok in enumerate(s["tokens"]):
                st = starts[i]
                nxt = [k for k in range(i + 1, len(starts)) if own[k]]
                en = starts[nxt[0]] if nxt else be
                # Pausen erkennen: Ende = letzter stimmhafter Frame vor dem nächsten Wort
                f0, f1 = int(st / 0.01), int(en / 0.01)
                voiced = [f for f in range(f0, min(f1, len(db))) if db[f] > -34]
                if voiced:
                    en = min(en, (voiced[-1] + 1) * 0.01 + 0.04)
                words.append({"w": tok["w"], "start": round(t + st - c0, 3), "end": round(t + max(en, st + 0.06) - c0, 3)})
                for c in tok["cues"]:
                    timings["cues"][sc["id"]][c] = round(t + st - c0, 3)
            text = " ".join(tk["w"] for tk in s["tokens"])
            timings["sentences"].append({"id": s["id"], "scene": sc["id"], "start": round(t, 3),
                                         "end": round(t + dur, 3), "text": text, "words": words})
            out_audio.append(seg)
            n_words += len([w for w in s["tokens"] if w["w"].strip(PUNCT)])
            speech_time += dur
            t += dur
            is_last = si == len(sc["sentences"]) - 1
            gap = max(s["pause"], sc["tail"]) if is_last else s["pause"]
            out_audio.append(np.zeros(int(gap * OUT_SR), np.float32))
            t += gap
            print(f"  {s['id']:<18} {dur:5.2f}s  {text[:70]}", flush=True)
        timings["scenes"].append({"id": sc["id"], "title": sc["title"], "start": round(sc_start, 3), "end": round(t, 3)})

    audio = np.concatenate(out_audio)
    timings["duration"] = round(len(audio) / OUT_SR, 3)
    timings["stats"] = {"words": n_words, "speechSeconds": round(speech_time, 1),
                        "wpm": round(n_words / (speech_time / 60), 1)}

    raw = os.path.join(ROOT, "audio", "narration_raw.wav")
    sf.write(raw, audio, OUT_SR, subtype="PCM_24")
    # Klangbearbeitung: Trittschall weg, etwas Wärme und Präsenz, trocken; Lautheit -16 LUFS
    final = os.path.join(ROOT, "audio", "narration.wav")
    eq = ("highpass=f=70,equalizer=f=180:t=q:w=1:g=2,equalizer=f=2800:t=q:w=1.2:g=1.5,"
          "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=1,"
          "loudnorm=I=-16:TP=-1.5:LRA=9")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", eq, "-ar", str(OUT_SR),
                    "-c:a", "pcm_s24le", final], check=True)
    os.remove(raw)

    json.dump(timings, open(os.path.join(ROOT, "data", "timings.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    # Auch als JS, damit main.html ohne Server-Fetch (file://) funktioniert
    with open(os.path.join(ROOT, "data", "timings.js"), "w", encoding="utf-8") as f:
        f.write("window.TIMINGS = " + json.dumps(timings, ensure_ascii=False) + ";\n")
    write_captions(timings)
    st = timings["stats"]
    print(f"\nGesamtdauer {timings['duration'] / 60:.2f} min | {st['words']} Wörter | "
          f"Sprechzeit {st['speechSeconds'] / 60:.2f} min | {st['wpm']} Wörter/min")


# ------------------------------------------------------------------ Captions
def fmt(t, sep="."):
    h, m = int(t // 3600), int(t % 3600 // 60)
    s = t - h * 3600 - m * 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", sep)


def split_caption_chunks(words, max_chars=74):
    """Satz in Untertitel-Blöcke (max. 2 Zeilen) teilen, bevorzugt an Satzzeichen."""
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        txt = " ".join(x["w"] for x in cur)
        nxt = words[i + 1]["w"] if i + 1 < len(words) else None
        strong = w["w"][-1] in ",:;–.?!" or w["w"] == "–"
        sentence_end = w["w"][-1] in ".?!"
        if nxt is None:
            break
        if len(txt) + 1 + len(nxt) > max_chars or (strong and len(txt) > 38) or (sentence_end and len(txt) > 12):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def two_lines(text, max_line=42):
    if len(text) <= max_line:
        return text
    words = text.split()
    best, best_d = None, 1e9
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        d = abs(len(a) - len(b)) + (0 if a[-1] in ",:;–" else 6)
        if max(len(a), len(b)) <= max_line + 8 and d < best_d:
            best, best_d = (a, b), d
    return "\n".join(best) if best else text


def write_captions(timings):
    cues = []
    for s in timings["sentences"]:
        for ch in split_caption_chunks(s["words"]):
            txt = " ".join(w["w"] for w in ch).replace(" –", " –")
            cues.append([ch[0]["start"], ch[-1]["end"] + 0.25, two_lines(txt)])
    for i in range(len(cues) - 1):
        cues[i][1] = min(cues[i][1], cues[i + 1][0] - 0.02)
    vtt = ["WEBVTT", "Kind: captions", "Language: de", ""]
    srt = []
    for i, (a, b, txt) in enumerate(cues, 1):
        vtt += [str(i), f"{fmt(a)} --> {fmt(b)}", txt, ""]
        srt += [str(i), f"{fmt(a, ',')} --> {fmt(b, ',')}", txt, ""]
    os.makedirs(os.path.join(ROOT, "captions"), exist_ok=True)
    open(os.path.join(ROOT, "captions", "de.vtt"), "w", encoding="utf-8").write("\n".join(vtt))
    open(os.path.join(ROOT, "captions", "de.srt"), "w", encoding="utf-8").write("\n".join(srt))


if __name__ == "__main__":
    main()
