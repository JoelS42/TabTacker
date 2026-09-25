"""
Austauschbare TTS-Engines.

Jede Engine implementiert:
    synth(text: str, out_wav: str) -> dict
Rückgabe: {"sample_rate": int, "words": [ {"char": int, "start": float, "end": float}, ... ] | None}
    "char"  = Zeichenposition des Wortes im übergebenen Text (0-basiert)
    Falls eine Engine keine Wortzeiten liefert (words=None), bestimmt
    align.py die Zeiten per DTW-Abgleich gegen eine eSpeak-Referenz.

Engines:
    pico        SVOX Pico (de-DE, weiblich)        – offline, Ubuntu-Paket libttspico-utils   [Standard, getestet]
    espeak      eSpeak NG + MBROLA de5 (weiblich)   – offline, Ubuntu-Pakete                   [getestet]
    piper       Piper (z. B. de_DE-kerstin-low)     – offline, benötigt piper + .onnx Stimme    [nicht in dieser Umgebung getestet]
    elevenlabs  ElevenLabs API (mit Zeitstempeln)   – benötigt ELEVENLABS_API_KEY               [nicht in dieser Umgebung getestet]
    edge        Microsoft Edge Online-TTS (edge-tts)– benötigt Internet                         [nicht in dieser Umgebung getestet]
"""
import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
import urllib.request


def _run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f"Befehl fehlgeschlagen: {' '.join(cmd)}\n{r.stderr}")
    return r


class PicoEngine:
    """SVOX Pico, deutsche Frauenstimme (de-DE_gl0). speed: 100 = normal."""
    name = "pico"

    def __init__(self, speed=92, pitch=100):
        self.speed = speed
        self.pitch = pitch
        if not shutil.which("pico2wave"):
            raise RuntimeError("pico2wave fehlt: sudo apt-get install libttspico-utils")

    def synth(self, text, out_wav):
        markup = f"<pitch level='{self.pitch}'><speed level='{self.speed}'>{text}</speed></pitch>"
        _run(["pico2wave", "-l", "de-DE", "-w", out_wav, markup])
        return {"sample_rate": 16000, "words": None}


class EspeakEngine:
    """eSpeak NG mit MBROLA-Stimme (Standard: mb-de5, weiblich)."""
    name = "espeak"

    def __init__(self, voice="mb-de5", rate=140):
        self.voice, self.rate = voice, rate

    def synth(self, text, out_wav):
        _run(["espeak-ng", "-v", self.voice, "-s", str(self.rate), "-w", out_wav, text])
        return {"sample_rate": 16000 if self.voice.startswith("mb-") else 22050, "words": None}


class PiperEngine:
    """Piper TTS. PIPER_MODEL=/pfad/de_DE-kerstin-low.onnx (weiblich) oder ramona/eva_k."""
    name = "piper"

    def __init__(self, model=None, length_scale=1.08, binary="piper"):
        self.model = model or os.environ.get("PIPER_MODEL")
        if not self.model:
            raise RuntimeError("PIPER_MODEL nicht gesetzt (Pfad zur .onnx-Stimme)")
        self.length_scale, self.binary = length_scale, binary

    def synth(self, text, out_wav):
        subprocess.run([self.binary, "--model", self.model, "--length_scale", str(self.length_scale),
                        "--output_file", out_wav], input=text, text=True, check=True, capture_output=True)
        cfg = self.model + ".json"
        sr = 22050
        if os.path.exists(cfg):
            sr = json.load(open(cfg)).get("audio", {}).get("sample_rate", sr)
        return {"sample_rate": sr, "words": None}


class ElevenLabsEngine:
    """ElevenLabs mit Zeichen-Zeitstempeln (exakte Wort-Synchronisation).
    ELEVENLABS_API_KEY und ELEVENLABS_VOICE_ID setzen (eine ruhige deutsche Frauenstimme wählen)."""
    name = "elevenlabs"

    def __init__(self, voice_id=None, model_id="eleven_multilingual_v2", stability=0.6, similarity=0.75, speed=0.95):
        self.key = os.environ.get("ELEVENLABS_API_KEY")
        self.voice_id = voice_id or os.environ.get("ELEVENLABS_VOICE_ID")
        if not self.key or not self.voice_id:
            raise RuntimeError("ELEVENLABS_API_KEY und ELEVENLABS_VOICE_ID müssen gesetzt sein")
        self.model_id, self.stability, self.similarity, self.speed = model_id, stability, similarity, speed

    def synth(self, text, out_wav):
        url = (f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}/with-timestamps"
               f"?output_format=mp3_44100_192")
        body = json.dumps({
            "text": text, "model_id": self.model_id, "language_code": "de",
            "voice_settings": {"stability": self.stability, "similarity_boost": self.similarity,
                               "style": 0.0, "use_speaker_boost": True, "speed": self.speed},
        }).encode()
        req = urllib.request.Request(url, data=body, headers={"xi-api-key": self.key, "Content-Type": "application/json"})
        data = json.load(urllib.request.urlopen(req, timeout=120))
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(base64.b64decode(data["audio_base64"]))
            mp3 = f.name
        _run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ac", "1", "-ar", "44100", out_wav])
        os.unlink(mp3)
        al = data.get("alignment") or {}
        chars = al.get("characters", [])
        starts = al.get("character_start_times_seconds", [])
        ends = al.get("character_end_times_seconds", [])
        words, i = [], 0
        while i < len(chars):
            if chars[i].isspace():
                i += 1
                continue
            j = i
            while j < len(chars) and not chars[j].isspace():
                j += 1
            words.append({"char": i, "start": starts[i], "end": ends[j - 1]})
            i = j
        return {"sample_rate": 44100, "words": words}


class EdgeEngine:
    """Microsoft Edge Online-TTS über das Python-Paket edge-tts (pip install edge-tts).
    Weibliche deutsche Stimmen z. B. de-DE-KatjaNeural, de-DE-AmalaNeural, de-DE-SeraphinaMultilingualNeural."""
    name = "edge"

    def __init__(self, voice="de-DE-KatjaNeural", rate="-6%"):
        self.voice, self.rate = voice, rate

    def synth(self, text, out_wav):
        import asyncio
        import edge_tts

        async def go():
            try:
                comm = edge_tts.Communicate(text, self.voice, rate=self.rate, boundary="WordBoundary")
            except TypeError:
                comm = edge_tts.Communicate(text, self.voice, rate=self.rate)
            audio, bounds = bytearray(), []
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    bounds.append((chunk["text"], chunk["offset"] / 1e7, (chunk["offset"] + chunk["duration"]) / 1e7))
            return bytes(audio), bounds

        audio, bounds = asyncio.run(go())
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(audio)
            mp3 = f.name
        _run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ac", "1", "-ar", "24000", out_wav])
        os.unlink(mp3)
        words, pos = [], 0
        for w, s, e in bounds:
            k = text.find(w, pos)
            if k < 0:
                continue
            words.append({"char": k, "start": s, "end": e})
            pos = k + len(w)
        return {"sample_rate": 24000, "words": words or None}


ENGINES = {"pico": PicoEngine, "espeak": EspeakEngine, "piper": PiperEngine,
           "elevenlabs": ElevenLabsEngine, "edge": EdgeEngine}


def make_engine(name, **kw):
    if name not in ENGINES:
        raise SystemExit(f"Unbekannte Engine '{name}'. Verfügbar: {', '.join(ENGINES)}")
    return ENGINES[name](**kw)


def strip_markup(s):
    return re.sub(r"<[^>]+>", "", s)
