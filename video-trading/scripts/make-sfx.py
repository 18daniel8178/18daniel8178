"""Genera los efectos de sonido sintetizados (sin licencias de terceros)."""
import os
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sfx')


def save(name, x):
    x = np.clip(x / (np.max(np.abs(x)) + 1e-9) * 0.8, -1, 1)
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def t_(d):
    return np.arange(int(SR * d)) / SR


def ding():
    # Destello: dos campanitas brillantes
    t = t_(0.9)
    x = np.zeros_like(t)
    for f, dly, a in [(2093, 0.0, 1.0), (3136, 0.07, 0.7)]:
        tt = np.clip(t - dly, 0, None)
        env = np.exp(-tt * 6) * (t >= dly)
        x += a * env * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 2.01 * tt))
    return x


def whoosh():
    rng = np.random.default_rng(1)
    t = t_(0.45)
    n = rng.standard_normal(len(t))
    # filtro pasa-bajos que se abre y se cierra
    cut = 0.02 + 0.25 * np.sin(np.pi * t / t[-1]) ** 2
    y = np.zeros_like(n)
    for i in range(1, len(n)):
        y[i] = y[i - 1] + cut[i] * (n[i] - y[i - 1])
    return y * np.sin(np.pi * t / t[-1]) ** 1.5


def alarm():
    t = t_(1.6)
    f = np.where((t * 6).astype(int) % 2 == 0, 880, 660)
    sq = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
    gate = ((t * 6) % 1) < 0.8
    return sq * gate * 0.5 * np.exp(-t * 0.6)


def tinnitus():
    # Pitido de "me quedé en blanco" + caída grave
    t = t_(1.6)
    beep = np.sin(2 * np.pi * 5200 * t) * np.minimum(1, t * 8) * np.exp(-t * 0.9) * 0.25
    drop = np.sin(2 * np.pi * np.cumsum(120 - 70 * t / t[-1]) / SR) * np.exp(-t * 2.5)
    return beep + drop


def creak():
    # Rechinido de puerta: golpecitos resonantes (pegar-soltar) cada vez más seguidos
    rng = np.random.default_rng(3)
    t = t_(1.3)
    x = np.zeros_like(t)
    pos, k = 0.0, 0
    while pos < t[-1] - 0.05:
        rate = 22 + 38 * (pos / t[-1]) + rng.uniform(-6, 6)
        tt = t - pos
        on = tt >= 0
        f = 520 + 260 * np.sin(pos * 4.1) + rng.uniform(-40, 40)
        x += on * np.exp(-np.clip(tt, 0, None) * 90) * np.sin(2 * np.pi * f * np.clip(tt, 0, None)) * (0.6 + 0.4 * rng.random())
        pos += 1 / rate
        k += 1
    return x * np.minimum(1, t * 12) * np.minimum(1, (t[-1] - t) * 6)


if __name__ == '__main__':
    for name, fn in [('ding', ding), ('whoosh', whoosh), ('alarm', alarm), ('tinnitus', tinnitus), ('creak', creak)]:
        save(name, fn())
    print('SFX en', os.path.normpath(OUT))
