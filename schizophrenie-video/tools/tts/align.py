"""
Wort-Alignment ohne Internet: Die Sprachaufnahme (beliebige TTS-Engine) wird per
Dynamic Time Warping (DTW) auf MFCC-Merkmalen mit einer eSpeak-NG-Referenzsynthese
desselben Textes abgeglichen. eSpeak liefert exakte Wortzeitpunkte für die Referenz;
über den DTW-Pfad werden sie auf die echte Aufnahme übertragen (Prinzip wie „aeneas“).
"""
import ctypes
import numpy as np
from scipy.signal import resample_poly
from scipy.fft import dct

_lib = None
_CB = None
_state = {"chunks": [], "words": []}


class _EVID(ctypes.Union):
    _fields_ = [("number", ctypes.c_int), ("name", ctypes.c_char_p), ("string", ctypes.c_char * 8)]


class _EVT(ctypes.Structure):
    _fields_ = [("type", ctypes.c_int), ("unique_identifier", ctypes.c_uint), ("text_position", ctypes.c_int),
                ("length", ctypes.c_int), ("audio_position", ctypes.c_int), ("sample", ctypes.c_int),
                ("user_data", ctypes.c_void_p), ("id", _EVID)]


def _espeak_init(voice="de+f3", rate=150):
    global _lib, _CB, _sr
    if _lib is not None:
        return
    _lib = ctypes.cdll.LoadLibrary("libespeak-ng.so.1")
    _sr = _lib.espeak_Initialize(1, 500, None, 0)  # AUDIO_OUTPUT_RETRIEVAL
    _lib.espeak_SetVoiceByName(voice.encode())
    _lib.espeak_SetParameter(1, rate, 0)
    proto = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.POINTER(_EVT))

    def cb(wav, n, ev):
        if n > 0 and wav:
            _state["chunks"].append(np.ctypeslib.as_array(wav, shape=(n,)).copy())
        i = 0
        while ev[i].type != 0:
            if ev[i].type == 1:  # espeakEVENT_WORD
                _state["words"].append((ev[i].text_position - 1, ev[i].length, ev[i].sample))
            i += 1
        return 0

    _CB = proto(cb)
    _lib.espeak_SetSynthCallback(_CB)


def espeak_reference(text):
    """-> (audio float32 @16 kHz, [(char_pos, len, t_sec), ...])"""
    _espeak_init()
    _state["chunks"], _state["words"] = [], []
    b = text.encode("utf-8")
    _lib.espeak_Synth(b, len(b) + 1, 0, 1, 0, 1, None, None)
    _lib.espeak_Synchronize()
    a = np.concatenate(_state["chunks"]).astype(np.float32) / 32768.0
    a16 = resample_poly(a, 320, 441)  # 22050 -> 16000
    words = [(p, l, s / _sr) for (p, l, s) in _state["words"]]
    return a16, words


def _mel_fb(sr, n_fft, n_mels=26, fmin=60, fmax=7600):
    def hz2mel(f): return 2595 * np.log10(1 + f / 700)
    def mel2hz(m): return 700 * (10 ** (m / 2595) - 1)
    mels = np.linspace(hz2mel(fmin), hz2mel(fmax), n_mels + 2)
    hz = mel2hz(mels)
    bins = np.floor((n_fft + 1) * hz / sr).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1))
    for m in range(1, n_mels + 1):
        l, c, r = bins[m - 1], bins[m], bins[m + 1]
        for k in range(l, c):
            fb[m - 1, k] = (k - l) / max(1, c - l)
        for k in range(c, r):
            fb[m - 1, k] = (r - k) / max(1, r - c)
    return fb


_FB = None


def mfcc(a, sr=16000, hop=0.01, win=0.025, n=13):
    global _FB
    n_fft = 512
    if _FB is None:
        _FB = _mel_fb(sr, n_fft)
    a = np.append(a[0], a[1:] - 0.97 * a[:-1])
    h, w = int(hop * sr), int(win * sr)
    nfr = max(1, 1 + (len(a) - w) // h)
    idx = np.arange(w)[None, :] + h * np.arange(nfr)[:, None]
    fr = a[np.clip(idx, 0, len(a) - 1)] * np.hamming(w)
    spec = np.abs(np.fft.rfft(fr, n_fft)) ** 2
    mel = np.log(spec @ _FB.T + 1e-8)
    c = dct(mel, type=2, axis=1, norm="ortho")[:, 1:n]
    energy = np.log(spec.sum(1) + 1e-8)[:, None]
    feat = np.hstack([c, 0.5 * (energy - energy.mean())])
    feat = (feat - feat.mean(0)) / (feat.std(0) + 1e-6)
    d = np.gradient(feat, axis=0)
    return np.hstack([feat, 0.5 * d])


def dtw_path(A, B, band=0.25):
    """Klassisches DTW mit Sakoe-Chiba-Band. A: (n,d) Referenz, B: (m,d) Aufnahme."""
    n, m = len(A), len(B)
    An = A / (np.linalg.norm(A, axis=1, keepdims=True) + 1e-9)
    Bn = B / (np.linalg.norm(B, axis=1, keepdims=True) + 1e-9)
    C = 1 - An @ Bn.T
    D = np.full((n + 1, m + 1), np.inf)
    D[0, 0] = 0
    bw = max(int(band * max(n, m)), abs(n - m) + 10)
    for i in range(1, n + 1):
        jc = int(i * m / n)
        lo, hi = max(1, jc - bw), min(m, jc + bw)
        prev = D[i - 1]
        row = D[i]
        for j in range(lo, hi + 1):
            c = C[i - 1, j - 1]
            a, b, d = prev[j - 1], prev[j], row[j - 1]
            row[j] = c + (a if a <= b and a <= d else (b if b <= d else d))
    # Backtracking
    i, j, path = n, m, []
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        a, b, d = D[i - 1, j - 1], D[i - 1, j], D[i, j - 1]
        if a <= b and a <= d:
            i, j = i - 1, j - 1
        elif b <= d:
            i -= 1
        else:
            j -= 1
    return path[::-1]


def speech_bounds(a, sr, thr_db=-38, hop=0.01):
    h = int(hop * sr)
    nfr = max(1, len(a) // h)
    e = np.array([np.sqrt(np.mean(a[i * h:(i + 1) * h] ** 2) + 1e-12) for i in range(nfr)])
    db = 20 * np.log10(e / (e.max() + 1e-12))
    on = np.where(db > thr_db)[0]
    if len(on) == 0:
        return 0.0, len(a) / sr, db
    return on[0] * hop, (on[-1] + 1) * hop, db


def align_words(audio16, spoken_text):
    """-> Liste [(char_pos, start_sec)] für jedes eSpeak-Wort im gesprochenen Text."""
    ref, words = espeak_reference(spoken_text)
    A, B = mfcc(ref), mfcc(audio16)
    # Stille-Ränder ausschneiden, damit DTW nur Sprache vergleicht
    rs, re_, _ = speech_bounds(ref, 16000)
    bs, be, _ = speech_bounds(audio16, 16000)
    ra, rb = int(rs / 0.01), max(int(rs / 0.01) + 2, int(re_ / 0.01))
    ba, bb = int(bs / 0.01), max(int(bs / 0.01) + 2, int(be / 0.01))
    A2, B2 = A[ra:rb], B[ba:bb]
    path = dtw_path(A2, B2)
    map_ref = {}
    for i, j in path:
        map_ref.setdefault(i, j)
    out = []
    for (pos, ln, t) in words:
        fi = int(round(t / 0.01)) - ra
        fi = min(max(fi, 0), len(A2) - 1)
        while fi not in map_ref and fi > 0:
            fi -= 1
        j = map_ref.get(fi, 0)
        out.append((pos, (j + ba) * 0.01))
    # Monotonie erzwingen
    for k in range(1, len(out)):
        if out[k][1] < out[k - 1][1]:
            out[k] = (out[k][0], out[k - 1][1])
    return out, (bs, be)
