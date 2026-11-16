"""biblioteca.py · Música y SFX de los carruseles animados · Viegas Estudio

Todo sintetizado aquí con numpy/scipy (sin muestras de terceros): 20 estilos × 3 variantes (tonalidad, tempo, melodía).
Cada pista se genera a la duración EXACTA de la lámina y en bucle perfecto: el tempo se ajusta (±10 %) para que la lámina
dure un número entero de tiempos y las colas que pasan del final vuelven al principio.

  python biblioteca.py construir                 → catalogo.json + previas/<id>.mp3 (12 s)
  python biblioteca.py pista <id> <dur> <salida.wav> [compas0] [lufs]
  python biblioteca.py mezcla <plan.json>        → wav por lámina (música −16 LUFS + SFX por eventos). Imprime un informe JSON.

plan.json = { pista: 'lofi-1' | 'sin', sfx: 'sin'|'sutil'|'normal', lufs: -16, semilla: 'texto',
              slides: [{ n: 1, dur: 5.2, compas0: 0, cta: false, eventos: [{t, d, a, cls, fs, ac, txt, pill}], salida: 'x.wav',
                         salida_musica?: 'm.wav', salida_sfx?: 's.wav' }] }
"""
import json, sys, math, hashlib, pathlib, subprocess, tempfile
from functools import lru_cache
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.io import wavfile

AQUI = pathlib.Path(__file__).resolve().parent
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
SR = 48000
NOMBRES = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si']
RUIDO = np.random.default_rng(7).standard_normal(SR * 6)

# ------------------------------------------------------------------ utilidades
def mf(m): return 440.0 * 2 ** ((m - 69) / 12)
def _t(d): return np.arange(max(1, int(d * SR))) / SR
def _sos(tipo, fc, orden=2):
    fc = np.clip(np.atleast_1d(fc), 20, SR / 2 - 200) / (SR / 2)
    return butter(orden, fc if len(fc) > 1 else fc[0], tipo, output='sos')
def lp(x, fc, o=2): return sosfilt(_sos('low', fc, o), x)
def hp(x, fc, o=2): return sosfilt(_sos('high', fc, o), x)
def bp(x, a, b, o=2): return sosfilt(_sos('band', [a, b], o), x)
def ruido(n, off=0): off = off % (len(RUIDO) - n - 1) if n < len(RUIDO) else 0; return RUIDO[off:off + n] if n < len(RUIDO) else np.resize(RUIDO, n)
def att(t, a): return np.clip(t / max(a, 1e-4), 0, 1)
def gate(t, dur, rel): return np.where(t < dur, 1.0, np.exp(-np.clip(t - dur, 0, None) / rel))
def saw(ph): return 2 * (ph % 1.0) - 1
def tri(ph): return 2 * np.abs(2 * (ph % 1.0) - 1) - 1
def pulso(ph, duty=0.5): return np.where((ph % 1.0) < duty, 1.0, -1.0)

# ------------------------------------------------------------------ batería (sin altura)
@lru_cache(maxsize=None)
def bateria(nombre):
    if nombre == 'kick_house':
        t = _t(0.45); f = 48 + 120 * np.exp(-t / 0.035); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.26)
        return 0.9 * np.tanh(1.8 * x) / np.tanh(1.8) + 0.15 * hp(ruido(len(t)), 2500) * np.exp(-t / 0.004)
    if nombre == 'kick_boom':
        t = _t(0.6); f = 45 + 85 * np.exp(-t / 0.05); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.38)
        return 0.95 * np.tanh(2.4 * x) / np.tanh(2.4) + 0.2 * bp(ruido(len(t), 999), 800, 3500) * np.exp(-t / 0.006)
    if nombre == 'kick_soft':
        t = _t(0.35); f = 50 + 60 * np.exp(-t / 0.03); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
        return 0.8 * lp(x, 1800)
    if nombre == 'kick_808':
        t = _t(1.1); f = 42 + 55 * np.exp(-t / 0.06); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.75) * att(t, 0.002)
        return 0.95 * np.tanh(1.6 * x) / np.tanh(1.6)
    if nombre == 'kick_chip':
        t = _t(0.18); f = 60 + 300 * np.exp(-t / 0.02); return 0.7 * tri(np.cumsum(f) / SR) * np.exp(-t / 0.07)
    if nombre == 'timbal':
        t = _t(1.4); f = 70 + 25 * np.exp(-t / 0.1)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * np.exp(-t / 0.3)
        return 0.75 * x * np.exp(-t / 0.55) + 0.25 * lp(ruido(len(t), 77), 600) * np.exp(-t / 0.08)
    if nombre in ('snare', 'snare_lofi'):
        t = _t(0.35); f = 185 + 60 * np.exp(-t / 0.02)
        cuerpo = tri(np.cumsum(f) / SR) * np.exp(-t / 0.07)
        r = bp(ruido(len(t), 1234), 1200, 9000) if nombre == 'snare' else lp(ruido(len(t), 1234), 4200)
        return 0.45 * cuerpo + 0.55 * r * np.exp(-t / (0.14 if nombre == 'snare' else 0.1))
    if nombre == 'clap':
        t = _t(0.35); r = bp(ruido(len(t), 2345), 900, 5500)
        env = sum(np.exp(-np.clip(t - d, 0, None) / 0.011) * (t >= d) for d in (0, 0.012, 0.024)) * np.exp(-t / 0.11)
        return 0.75 * r * env
    if nombre == 'rim':
        t = _t(0.06); return 0.5 * (np.sin(2 * np.pi * 1700 * t) + 0.6 * np.sin(2 * np.pi * 420 * t)) * np.exp(-t / 0.012)
    if nombre == 'hat':
        t = _t(0.08); return 0.35 * hp(ruido(len(t), 3456), 7500) * np.exp(-t / 0.022)
    if nombre == 'hat_open':
        t = _t(0.35); return 0.28 * hp(ruido(len(t), 4567), 6500) * np.exp(-t / 0.13)
    if nombre == 'shaker':
        t = _t(0.12); return 0.22 * bp(ruido(len(t), 5678), 4500, 11000) * att(t, 0.012) * np.exp(-t / 0.045)
    if nombre == 'brush':
        t = _t(0.25); return 0.18 * bp(ruido(len(t), 6789), 2500, 9000) * att(t, 0.03) * np.exp(-t / 0.09)
    if nombre == 'ruido_chip':
        t = _t(0.06); r = np.repeat(np.sign(ruido(len(t) // 8 + 1, 42)), 8)[:len(t)]; return 0.25 * r * np.exp(-t / 0.02)
    raise KeyError(nombre)

# ------------------------------------------------------------------ instrumentos con altura: f(midi, dur) → array (con cola)
def _parciales(fr, t, amps, taus, inarm=0.0):
    x = np.zeros_like(t)
    for k, (a, tau) in enumerate(zip(amps, taus), 1):
        fk = fr * k * np.sqrt(1 + inarm * k * k)
        if fk > SR / 2 - 500: break
        x += a * np.sin(2 * np.pi * fk * t + k) * np.exp(-t / tau)
    return x

@lru_cache(maxsize=4096)
def nota(inst, m, dur):
    fr = mf(m)
    if inst == 'bass_sub':
        t = _t(dur + 0.15); x = np.sin(2 * np.pi * fr * t) + 0.25 * np.sin(4 * np.pi * fr * t)
        return 0.8 * np.tanh(1.3 * x) * att(t, 0.006) * gate(t, dur, 0.04)
    if inst == 'bass_saw':
        t = _t(dur + 0.15); x = saw(fr * t) + 0.5 * np.sin(2 * np.pi * fr / 2 * t)
        oscuro, claro = lp(x, 260), lp(x, 1400); e = np.exp(-t / 0.12)
        return 0.7 * (oscuro + e * (claro - oscuro)) * att(t, 0.004) * gate(t, dur, 0.04)
    if inst == 'bass_funk':
        t = _t(dur + 0.12); x = saw(fr * t) + 0.4 * pulso(fr * t, 0.3)
        oscuro, claro = lp(x, 300), lp(x, 2600); e = np.exp(-t / 0.07)
        return 0.62 * (oscuro + e * (claro - oscuro)) * att(t, 0.003) * gate(t, dur, 0.03)
    if inst == 'bass_808':
        t = _t(dur + 0.3); f = fr * (1 + 0.5 * np.exp(-t / 0.025)); x = np.sin(2 * np.pi * np.cumsum(f) / SR)
        return 0.9 * np.tanh(1.8 * x) / np.tanh(1.8) * att(t, 0.003) * gate(t, dur, 0.08) * np.exp(-t / 1.6)
    if inst == 'bass_reese':
        t = _t(dur + 0.15); x = saw(fr * t) + saw(fr * 1.012 * t) + 0.6 * np.sin(2 * np.pi * fr / 2 * t)
        return 0.45 * lp(x, 480) * att(t, 0.01) * gate(t, dur, 0.05)
    if inst == 'bass_upright':
        t = _t(dur + 0.3); x = _parciales(fr, t, [1, 0.5, 0.25, 0.12], [0.9, 0.35, 0.18, 0.1])
        return 0.85 * x * att(t, 0.008) * gate(t, dur, 0.06)
    if inst == 'bass_tri':
        t = _t(dur + 0.05); return 0.7 * tri(fr * t) * gate(t, dur, 0.01)
    if inst == 'epiano':
        t = _t(dur + 1.2); I = 1.8 * np.exp(-t / 0.4) + 0.25
        x = np.sin(2 * np.pi * fr * t + I * np.sin(2 * np.pi * fr * t)) + 0.12 * np.sin(2 * np.pi * fr * 14 * t) * np.exp(-t / 0.05)
        return 0.32 * x * np.exp(-t / 1.6) * att(t, 0.003) * gate(t, dur, 0.25) * (1 + 0.15 * np.sin(2 * np.pi * 4.5 * t))
    if inst == 'piano':
        t = _t(dur + 1.6); x = _parciales(fr, t, [1, 0.55, 0.3, 0.2, 0.12, 0.08, 0.05, 0.03], [1.8, 1.1, 0.8, 0.5, 0.35, 0.25, 0.18, 0.12], 0.0003)
        x += 0.15 * bp(ruido(len(t), int(m) * 31), 800, 4000) * np.exp(-t / 0.01)
        return 0.3 * x * att(t, 0.002) * gate(t, dur, 0.3)
    if inst == 'piano_lofi':
        return lp(nota('piano', m, dur), 2400) * 1.1
    if inst == 'organ':
        t = _t(dur + 0.1); x = np.sin(2 * np.pi * fr * t) + 0.6 * np.sin(4 * np.pi * fr * t) + 0.35 * np.sin(6 * np.pi * fr * t) + 0.2 * np.sin(8 * np.pi * fr * t)
        return 0.2 * x * att(t, 0.006) * gate(t, dur, 0.05)
    if inst == 'stab':
        t = _t(dur + 0.4); x = saw(fr * t) + saw(fr * 1.007 * t) + 0.5 * pulso(fr * 2 * t)
        oscuro, claro = lp(x, 700), lp(x, 3800); e = np.exp(-t / 0.09)
        return 0.13 * (oscuro + e * (claro - oscuro)) * np.exp(-t / 0.35) * att(t, 0.003) * gate(t, dur, 0.08)
    if inst in ('pad_warm', 'pad_dark', 'strings', 'pad_glass'):
        t = _t(dur + 1.0)
        if inst == 'pad_glass':
            x = sum(np.sin(2 * np.pi * fr * d * t) + 0.3 * np.sin(4 * np.pi * fr * d * t) for d in (0.997, 1.0, 1.003)); a, rel, g = 0.6, 0.9, 0.12
        else:
            vib = 1 + (0.003 * np.sin(2 * np.pi * 5.2 * t) if inst == 'strings' else 0)
            x = sum(saw(fr * d * vib * t + k * 0.31) for k, d in enumerate((0.994, 1.0, 1.006)))
            x = lp(x, {'pad_warm': 1300, 'pad_dark': 520, 'strings': 2600}[inst], 2)
            a, rel, g = {'pad_warm': (0.4, 0.8, 0.07), 'pad_dark': (0.7, 1.0, 0.1), 'strings': (0.25, 0.6, 0.06)}[inst]
        return g * x * att(t, a) * gate(t, dur, rel)
    if inst == 'pluck_guitar':
        t = _t(dur + 1.2); k = np.arange(1, 13); pos = 0.22
        x = _parciales(fr, t, list(np.abs(np.sin(np.pi * k * pos)) / k), list(1.4 / k ** 0.8), 0.00008)
        return 0.38 * x * att(t, 0.002) * gate(t, dur, 0.15)
    if inst == 'pizz':
        t = _t(dur + 0.6); x = _parciales(fr, t, [1, 0.5, 0.3, 0.15, 0.1], [0.35, 0.22, 0.15, 0.1, 0.07])
        return 0.42 * lp(x, 3000) * att(t, 0.004)
    if inst == 'synth_pluck':
        t = _t(dur + 0.5); x = saw(fr * t) + saw(fr * 1.005 * t)
        oscuro, claro = lp(x, 500), lp(x, 5000); e = np.exp(-t / 0.08)
        return 0.16 * (oscuro + e * (claro - oscuro)) * np.exp(-t / 0.3) * att(t, 0.002)
    if inst == 'marimba':
        t = _t(dur + 0.8); x = np.sin(2 * np.pi * fr * t) * np.exp(-t / 0.45) + 0.35 * np.sin(2 * np.pi * fr * 3.93 * t) * np.exp(-t / 0.07) + 0.12 * np.sin(2 * np.pi * fr * 9.2 * t) * np.exp(-t / 0.02)
        return 0.5 * x * att(t, 0.002)
    if inst == 'vibes':
        t = _t(dur + 1.5); x = np.sin(2 * np.pi * fr * t) + 0.25 * np.sin(2 * np.pi * fr * 4 * t) * np.exp(-t / 0.2)
        return 0.32 * x * np.exp(-t / 1.3) * (1 + 0.25 * np.sin(2 * np.pi * 5.5 * t)) * att(t, 0.003)
    if inst == 'bell':
        t = _t(dur + 1.6); I = 2.6 * np.exp(-t / 0.6)
        return 0.22 * np.sin(2 * np.pi * fr * t + I * np.sin(2 * np.pi * fr * 3.5 * t)) * np.exp(-t / 1.1) * att(t, 0.002)
    if inst == 'glock':
        t = _t(dur + 1.2); x = np.sin(2 * np.pi * fr * t) + 0.4 * np.sin(2 * np.pi * fr * 2.76 * t) * np.exp(-t / 0.15)
        return 0.22 * x * np.exp(-t / 0.8) * att(t, 0.001)
    if inst == 'chip':
        t = _t(dur + 0.03); vib = 1 + 0.006 * np.sin(2 * np.pi * 6 * t) * (t > 0.12)
        return 0.17 * pulso(np.cumsum(fr * vib) / SR, 0.25) * gate(t, dur * 0.9, 0.01)
    if inst == 'lead_saw':
        t = _t(dur + 0.2); x = saw(fr * t) + saw(fr * 1.008 * t)
        return 0.12 * lp(x, 3200) * att(t, 0.01) * gate(t, dur, 0.08)
    if inst == 'brass':
        t = _t(dur + 0.2); x = saw(fr * t) + saw(fr * 1.004 * t)
        oscuro, claro = lp(x, 900), lp(x, 3200); e = att(t, 0.05) * np.exp(-t / 0.25)
        return 0.14 * (oscuro + e * (claro - oscuro)) * att(t, 0.02) * gate(t, dur, 0.06)
    raise KeyError(inst)

# ------------------------------------------------------------------ acordes y escalas
M, m_, M7, m7, D7, m9, M9, D9, sus2, add9, six = [0, 4, 7], [0, 3, 7], [0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 10], [0, 3, 7, 10, 14], [0, 4, 7, 11, 14], [0, 4, 7, 10, 14], [0, 2, 7], [0, 4, 7, 14], [0, 4, 7, 9]
m11 = [0, 3, 7, 10, 17]; dim7 = [0, 3, 6, 9]; D7b9 = [0, 4, 7, 10, 13]; D13 = [0, 4, 10, 14, 21]

def B(*xs): return ''.join(xs)  # patrón de 16 pasos

# Cada estilo: tempos/tonos de sus 3 variantes, progresión (por compás), partes y efectos.
# partes: ('bat', inst, patrón, ganancia) · ('bajo', inst, [(paso, largo, intervalo)], g) · ('acorde', inst, [(paso, largo)], g, octava)
#         ('arp', inst, patrón, orden, g, octava, largo) · ('mel', inst, densidad, g, octava, largo)
ESTILOS = {
 'lofi': dict(nombre='Lo-fi chill', mood=['calma', 'foco', 'nostalgia'], energia=1, etiquetas=['lofi', 'chill', 'estudio', 'relajado'],
   var=[(62, 80), (65, 84), (57, 74), (60, 78)], modo='mayor', prog=[(2, m9), (7, D9), (0, M9), (9, m7)], swing=0.55,
   partes=[('bat', 'kick_soft', 'x......x..x.....', 1.0), ('bat', 'snare_lofi', '....x.......x...', 0.7), ('bat', 'hat', 'x.o.x.o.x.o.x.oo', 0.55),
           ('acorde', 'epiano', [(0, 14)], 0.9, 0), ('bajo', 'bass_sub', [(0, 6, 0), (10, 5, 0)], 0.8), ('mel', 'vibes', 0.22, 0.55, 1, 3)],
   fx=dict(lofi=0.016, lp=4200, rev=0.22, t60=1.6)),
 'tech': dict(nombre='Pulso tech minimal', mood=['tecnologia', 'foco', 'moderno'], energia=3, etiquetas=['tech', 'minimal', 'ia', 'código'],
   var=[(57, 120), (60, 124), (55, 112), (62, 116)], modo='menor', prog=[(0, m7), (0, m7), (8, M7), (10, sus2)],
   partes=[('bat', 'kick_house', 'x...x...x...x...', 1.0), ('bat', 'hat', '..x...x...x...x.', 0.7), ('bat', 'rim', '...x.....x....x.', 0.4),
           ('bajo', 'bass_saw', [(i, 1, 0) for i in range(16) if i % 4 != 0], 0.55), ('arp', 'synth_pluck', 'x.xxx.x.x.xxx.x.', [0, 2, 1, 3, 2, 4], 0.5, 1, 1),
           ('acorde', 'pad_dark', [(0, 16)], 0.6, 0)],
   fx=dict(pump=0.45, rev=0.18, t60=1.4, lp=11000)),
 'corporate': dict(nombre='Corporate optimista', mood=['optimista', 'negocio', 'confianza'], energia=3, etiquetas=['corporate', 'empresa', 'positivo'],
   var=[(60, 112), (62, 118), (55, 104), (64, 122)], modo='mayor', prog=[(0, add9), (7, M), (9, m7), (5, M9)],
   partes=[('bat', 'kick_soft', 'x.......x.......', 1.0), ('bat', 'clap', '....x.......x...', 0.6), ('bat', 'hat', 'x.x.x.x.x.x.x.x.', 0.45), ('bat', 'shaker', '.x.x.x.x.x.x.x.x', 0.4),
           ('acorde', 'piano', [(2, 2), (6, 2), (10, 2), (14, 2)], 0.6, 0), ('arp', 'pluck_guitar', 'x.x.x.x.x.x.x.x.', [0, 1, 2, 3, 2, 1], 0.55, 1, 2),
           ('bajo', 'bass_sub', [(0, 2, 0), (4, 2, 0), (8, 2, 0), (12, 2, 7)], 0.75)],
   fx=dict(rev=0.2, t60=1.5)),
 'synthwave': dict(nombre='Synthwave 80s', mood=['nostalgia', 'energia', 'tecnologia'], energia=4, etiquetas=['synthwave', 'retro', '80s', 'neón'],
   var=[(57, 118), (62, 108), (52, 100), (55, 112), (59, 104)], modo='menor', prog=[(0, m_), (8, M7), (3, M), (10, M)],
   partes=[('bat', 'kick_house', 'x...x...x...x.x.', 1.0), ('bat', 'snare', '....x.......x...', 0.75), ('bat', 'hat', 'xxxxxxxxxxxxxxox', 0.4),
           ('bajo', 'bass_saw', [(i, 1, 12 if i % 2 else 0) for i in range(16)], 0.6), ('acorde', 'pad_warm', [(0, 15)], 0.9, 0),
           ('arp', 'lead_saw', 'xxxxxxxxxxxxxxxx', [0, 1, 2, 3, 4, 3, 2, 1], 0.45, 2, 1)],
   fx=dict(rev=0.32, t60=2.4, pump=0.2, lp=8500)),
 'ambient': dict(nombre='Ambient cálido', mood=['calma', 'emotivo', 'reflexion'], energia=1, etiquetas=['ambient', 'atmósfera', 'suave'],
   var=[(60, 70), (55, 64), (63, 76), (58, 68)], modo='mayor', prog=[(0, M9), (0, M9), (5, M9), (9, m9)],
   partes=[('acorde', 'pad_glass', [(0, 16)], 1.0, 0), ('acorde', 'pad_warm', [(0, 16)], 0.5, -1), ('mel', 'bell', 0.12, 0.5, 1, 6), ('bat', 'shaker', '........o.......', 0.3),
           ('bajo', 'bass_sub', [(0, 16, 0)], 0.5)],
   fx=dict(rev=0.45, t60=3.5, lp=7000)),
 'house': dict(nombre='House suave', mood=['energia', 'moderno', 'lifestyle'], energia=4, etiquetas=['house', 'baile', 'groove'],
   var=[(57, 120), (60, 122), (53, 118)], modo='menor', prog=[(0, m9), (5, m9), (8, M9), (7, m7)],
   partes=[('bat', 'kick_house', 'x...x...x...x...', 1.0), ('bat', 'clap', '....x.......x...', 0.6), ('bat', 'hat_open', '..x...x...x...x.', 0.5), ('bat', 'shaker', 'xxxxxxxxxxxxxxxx', 0.25),
           ('acorde', 'stab', [(3, 1), (6, 2), (10, 1), (14, 1)], 0.9, 0), ('bajo', 'bass_sub', [(2, 1, 0), (6, 1, 0), (10, 1, 12), (14, 1, 7)], 0.8)],
   fx=dict(pump=0.55, rev=0.2, t60=1.6)),
 'cinematic': dict(nombre='Cinematic tensión', mood=['tension', 'epico', 'misterio'], energia=3, etiquetas=['cine', 'tensión', 'suspense'],
   var=[(50, 90), (52, 84), (45, 96), (47, 88)], modo='menor', prog=[(0, m_), (8, M), (0, m_), (1, M)],
   partes=[('arp', 'strings', 'x.x.x.x.x.x.x.x.', [0, 0, 1, 0, 2, 0, 1, 0], 0.7, 0, 1), ('acorde', 'pad_dark', [(0, 16)], 1.0, -1), ('bat', 'timbal', 'x.........x.....', 0.8),
           ('bat', 'kick_boom', 'x.......x.x.....', 0.6), ('mel', 'bell', 0.08, 0.35, 2, 4), ('bajo', 'bass_sub', [(0, 16, 0)], 0.6)],
   fx=dict(rev=0.4, t60=3.0, lp=9000)),
 'acustico': dict(nombre='Acústico pluck', mood=['alegre', 'cercano', 'natural'], energia=2, etiquetas=['acústico', 'guitarra', 'cercano'],
   var=[(55, 100), (60, 92), (62, 108)], modo='mayor', prog=[(0, M), (9, m_), (5, M9), (7, sus2)],
   partes=[('arp', 'pluck_guitar', 'x.xxx.x.x.xxx.x.', [0, 2, 1, 3, 2, 1, 3, 2], 0.75, 0, 3), ('bat', 'shaker', 'oxoxoxoxoxoxoxox', 0.4), ('bat', 'kick_soft', 'x.......x.......', 0.6),
           ('bat', 'rim', '....x.......x...', 0.35), ('bajo', 'bass_upright', [(0, 6, 0), (8, 6, 7)], 0.7)],
   fx=dict(rev=0.22, t60=1.4)),
 'boombap': dict(nombre='Hip-hop boom bap', mood=['urbano', 'confianza', 'opinion'], energia=3, etiquetas=['hiphop', 'boom bap', 'calle'],
   var=[(57, 90), (52, 86), (60, 94)], modo='menor', prog=[(0, m9), (0, m9), (5, m7), (8, M7)], swing=0.5,
   partes=[('bat', 'kick_boom', 'x......x.xx.....', 1.0), ('bat', 'snare', '....x.......x...', 0.85), ('bat', 'hat', 'x.x.x.xox.x.x.xo', 0.5),
           ('acorde', 'piano_lofi', [(0, 3), (7, 2), (10, 4)], 0.75, 0), ('bajo', 'bass_sub', [(0, 5, 0), (7, 2, 0), (10, 4, -2)], 0.85)],
   fx=dict(lofi=0.008, rev=0.15, t60=1.2, lp=7500)),
 'piano': dict(nombre='Piano emotivo', mood=['emotivo', 'inspirador', 'historia'], energia=1, etiquetas=['piano', 'emoción', 'historia'],
   var=[(57, 72), (60, 66), (55, 80)], modo='menor', prog=[(0, m_), (8, M), (3, M), (10, M)],
   partes=[('arp', 'piano', 'x.x.x.x.x.x.x.x.', [0, 1, 2, 3, 2, 1, 2, 1], 0.7, 0, 3), ('bajo', 'piano', [(0, 16, 0)], 0.6), ('acorde', 'strings', [(0, 16)], 0.35, 0),
           ('mel', 'piano', 0.14, 0.55, 1, 4)],
   fx=dict(rev=0.35, t60=2.6)),
 'funk': dict(nombre='Funk', mood=['divertido', 'energia', 'alegre'], energia=4, etiquetas=['funk', 'groove', 'bajo'],
   var=[(52, 108), (57, 104), (55, 114)], modo='dorico', prog=[(0, m7), (0, m7), (5, D9), (5, D9)],
   partes=[('bat', 'kick_house', 'x..x..x...x..x..', 0.9), ('bat', 'snare', '....x..g....x.g.', 0.8), ('bat', 'hat', 'xoxoxoxoxoxoxoxo', 0.45),
           ('bajo', 'bass_funk', [(0, 1, 0), (3, 1, 12), (6, 1, 0), (7, 1, 10), (10, 1, 0), (12, 1, 7), (13, 1, 12), (15, 1, 10)], 0.8),
           ('acorde', 'organ', [(2, 1), (6, 1), (11, 1), (14, 1)], 0.8, 0), ('mel', 'brass', 0.12, 0.6, 1, 2)],
   fx=dict(rev=0.15, t60=1.2)),
 'chiptune': dict(nombre='Retro chiptune', mood=['divertido', 'juego', 'tecnologia'], energia=4, etiquetas=['8 bits', 'videojuego', 'retro'],
   var=[(60, 128), (57, 140), (64, 120)], modo='mayor', prog=[(0, M), (9, m_), (5, M), (7, M)],
   partes=[('bat', 'kick_chip', 'x...x...x...x...', 1.0), ('bat', 'ruido_chip', '..x...x...x...xx', 0.8), ('bajo', 'bass_tri', [(i, 2, 0 if i % 4 == 0 else 12) for i in range(0, 16, 2)], 0.7),
           ('arp', 'chip', 'xxxxxxxxxxxxxxxx', [0, 1, 2, 3], 0.4, 1, 1), ('mel', 'chip', 0.4, 0.6, 2, 2)],
   fx=dict(rev=0.08, t60=0.8)),
 'jazz': dict(nombre='Jazz suave', mood=['elegante', 'calma', 'cafe'], energia=2, etiquetas=['jazz', 'café', 'elegante'],
   var=[(55, 92), (60, 84), (53, 100)], modo='mayor', prog=[(2, m9), (7, D13), (0, M9), (9, D7b9)], swing8=0.33,
   partes=[('bat', 'brush', 'x.o.x.o.x.o.x.o.', 0.6), ('bat', 'rim', '............x...', 0.3), ('bat', 'hat', '....x.......x...', 0.4),
           ('bajo', 'bass_upright', [(0, 4, 0), (4, 4, 7), (8, 4, 12), (12, 4, 10)], 0.8), ('acorde', 'epiano', [(2, 3), (10, 4)], 0.7, 0), ('mel', 'vibes', 0.25, 0.6, 1, 2)],
   fx=dict(rev=0.25, t60=1.8, lp=8000)),
 'trap': dict(nombre='Trap ligero', mood=['urbano', 'confianza', 'moderno'], energia=3, etiquetas=['trap', '808', 'urbano'],
   var=[(54, 140), (57, 130), (52, 150)], modo='menor', prog=[(0, m_), (8, M), (5, m_), (7, m_)],
   partes=[('bat', 'kick_808', 'x......x..x.....', 0.0), ('bajo', 'bass_808', [(0, 7, 0), (7, 3, 0), (10, 6, 3)], 0.95), ('bat', 'clap', '........x.......', 0.75),
           ('bat', 'hat', 'xxxxxxxrxxxxxrxr', 0.4), ('mel', 'bell', 0.2, 0.5, 1, 2), ('acorde', 'pad_dark', [(0, 16)], 0.5, 0)],
   fx=dict(rev=0.2, t60=1.6)),
 'marimba': dict(nombre='Marimba alegre', mood=['alegre', 'divertido', 'consejos'], energia=3, etiquetas=['marimba', 'tropical', 'feliz'],
   var=[(60, 116), (65, 124), (62, 108)], modo='mayor', prog=[(0, M), (5, M), (7, M), (5, M)],
   partes=[('arp', 'marimba', 'x.xx.x.xx.x.x.xx', [0, 2, 1, 3, 2, 1], 0.7, 1, 1), ('bat', 'kick_soft', 'x.......x.......', 0.8), ('bat', 'clap', '....x.......x...', 0.45),
           ('bat', 'shaker', 'xxxxxxxxxxxxxxxx', 0.3), ('bajo', 'bass_sub', [(0, 3, 0), (6, 2, 0), (8, 3, 7), (14, 2, 7)], 0.7)],
   fx=dict(rev=0.18, t60=1.3)),
 'drone': dict(nombre='Drone oscuro', mood=['oscuro', 'misterio', 'tension'], energia=1, etiquetas=['oscuro', 'drone', 'misterio'],
   var=[(45, 60), (43, 70), (48, 54)], modo='frigio', prog=[(0, [0, 7, 12]), (0, [0, 7, 12]), (1, [0, 4, 7]), (0, [0, 7, 15])],
   partes=[('acorde', 'pad_dark', [(0, 16)], 1.3, -1), ('bajo', 'bass_reese', [(0, 16, 0)], 0.7), ('bat', 'kick_boom', 'x...............', 0.6),
           ('mel', 'bell', 0.07, 0.35, 1, 6), ('bat', 'brush', '......o.......o.', 0.3)],
   fx=dict(rev=0.45, t60=4.0, lp=5000, viento=0.012)),
 'garage': dict(nombre='UK garage 2-step', mood=['urbano', 'energia', 'moderno'], energia=4, etiquetas=['garage', '2-step', 'club'],
   var=[(57, 132), (53, 130), (60, 134)], modo='menor', prog=[(0, m9), (8, M9), (3, M9), (7, m7)], swing=0.6,
   partes=[('bat', 'kick_house', 'x.........x.....', 1.0), ('bat', 'snare', '....x.......x...', 0.7), ('bat', 'hat', '..xo..x...xo..x.', 0.5), ('bat', 'shaker', 'x.x.x.x.x.x.x.x.', 0.25),
           ('acorde', 'organ', [(0, 1), (3, 1), (7, 1), (11, 2)], 0.75, 0), ('bajo', 'bass_reese', [(0, 3, 0), (6, 2, 0), (10, 4, 12)], 0.75)],
   fx=dict(pump=0.35, rev=0.2, t60=1.4)),
 'pop': dict(nombre='Pop brillante', mood=['optimista', 'energia', 'alegre'], energia=4, etiquetas=['pop', 'brillante', 'pegadizo'],
   var=[(60, 118), (62, 124), (57, 110)], modo='mayor', prog=[(0, M), (7, M), (9, m_), (5, M)],
   partes=[('bat', 'kick_house', 'x...x...x...x...', 1.0), ('bat', 'clap', '....x.......x...', 0.65), ('bat', 'hat', '..x...x...x...x.', 0.5),
           ('acorde', 'synth_pluck', [(2, 1), (6, 1), (10, 1), (14, 1)], 1.0, 0), ('bajo', 'bass_saw', [(i, 2, 0) for i in range(0, 16, 2)], 0.6), ('mel', 'bell', 0.32, 0.6, 1, 2)],
   fx=dict(pump=0.3, rev=0.22, t60=1.6)),
 'deeptech': dict(nombre='Deep tech', mood=['foco', 'tecnologia', 'elegante'], energia=3, etiquetas=['deep', 'techno', 'noche'],
   var=[(53, 122), (55, 124), (50, 120)], modo='menor', prog=[(0, m7), (0, m7), (0, m11), (3, M7)],
   partes=[('bat', 'kick_house', 'x...x...x...x...', 1.0), ('bat', 'hat', '..x...x...x...x.', 0.55), ('bat', 'rim', '.....x....x..x..', 0.35), ('bat', 'shaker', 'xoxoxoxoxoxoxoxo', 0.2),
           ('bajo', 'bass_reese', [(2, 1, 0), (3, 1, 0), (6, 1, 12), (10, 1, 0), (11, 1, 0), (14, 1, 7)], 0.8), ('acorde', 'stab', [(7, 1)], 0.8, 0), ('acorde', 'pad_dark', [(0, 16)], 0.5, 0)],
   fx=dict(pump=0.4, rev=0.3, t60=2.2, eco=0.3)),
 'orquestal': dict(nombre='Orquestal ligero', mood=['inspirador', 'epico', 'historia'], energia=2, etiquetas=['orquesta', 'pizzicato', 'cuento'],
   var=[(60, 96), (55, 88), (62, 104)], modo='mayor', prog=[(0, M), (5, M), (9, m_), (7, M)],
   partes=[('arp', 'pizz', 'x.x.x.x.x.x.x.x.', [0, 2, 1, 2, 0, 2, 1, 2], 0.7, 0, 1), ('acorde', 'strings', [(0, 16)], 0.6, 0), ('mel', 'glock', 0.22, 0.55, 2, 2),
           ('bat', 'timbal', 'x.......x.......', 0.6), ('bajo', 'pizz', [(0, 2, 0), (8, 2, 7)], 0.7)],
   fx=dict(rev=0.35, t60=2.4)),
 'outrun': dict(nombre='Synthwave outrun', mood=['energia', 'nostalgia', 'motivacion'], energia=5, etiquetas=['synthwave', 'outrun', 'carretera', 'neón'],
   var=[(52, 124), (57, 128), (55, 120)], modo='menor', prog=[(0, m_), (5, m_), (8, M), (7, M)],
   partes=[('bat', 'kick_house', 'x...x...x...x...', 1.0), ('bat', 'snare', '....x.......x...', 0.8), ('bat', 'hat', '..x...x...x...x.', 0.5),
           ('bajo', 'bass_saw', [(i, 1, 0) for i in range(16)], 0.6), ('acorde', 'pad_warm', [(0, 16)], 0.8, 0),
           ('arp', 'synth_pluck', 'x.xxx.xxx.xxx.xx', [0, 2, 4, 2, 1, 3], 0.4, 1, 1), ('mel', 'lead_saw', 0.2, 0.4, 1, 3)],
   fx=dict(rev=0.3, t60=2.2, pump=0.35, lp=9000)),
 'darksynth': dict(nombre='Darksynth', mood=['oscuro', 'tension', 'tecnologia'], energia=4, etiquetas=['synthwave', 'dark', 'cyberpunk', 'noche'],
   var=[(45, 110), (48, 104), (43, 116)], modo='frigio', prog=[(0, m_), (1, M), (0, m_), (10, m_)],
   partes=[('bat', 'kick_boom', 'x...x...x...x...', 1.0), ('bat', 'snare', '....x.......x...', 0.8), ('bat', 'hat', 'x.x.x.x.x.x.x.x.', 0.4),
           ('bajo', 'bass_reese', [(i, 1, 0 if i % 4 else 12) for i in range(0, 16, 2)], 0.75), ('acorde', 'pad_dark', [(0, 16)], 1.0, 0),
           ('arp', 'lead_saw', 'x.x.x.x.x.x.x.x.', [0, 1, 2, 1], 0.35, 1, 1)],
   fx=dict(rev=0.3, t60=2.4, pump=0.3, lp=7000)),
 'chillwave': dict(nombre='Chillwave', mood=['calma', 'nostalgia', 'lifestyle'], energia=2, etiquetas=['synthwave', 'chill', 'atardecer', 'retro'],
   var=[(62, 96), (57, 90), (64, 100)], modo='mayor', prog=[(0, M7), (9, m7), (5, M7), (7, add9)],
   partes=[('bat', 'kick_soft', 'x.......x.......', 0.9), ('bat', 'clap', '....x.......x...', 0.5), ('bat', 'shaker', 'x.x.x.x.x.x.x.x.', 0.3),
           ('acorde', 'pad_warm', [(0, 16)], 0.9, 0), ('bajo', 'bass_sub', [(0, 4, 0), (6, 2, 0), (8, 4, 7)], 0.7), ('arp', 'pad_glass', 'x...x...x...x...', [0, 2, 1, 3], 0.35, 1, 4),
           ('mel', 'bell', 0.15, 0.45, 1, 3)],
   fx=dict(rev=0.4, t60=3.0, pump=0.2, lp=6500, lofi=0.006)),
 'vaporwave': dict(nombre='Vaporwave lento', mood=['nostalgia', 'calma', 'divertido'], energia=1, etiquetas=['vaporwave', 'retro', 'mall', '90s'],
   var=[(58, 78), (63, 72), (55, 84)], modo='mayor', prog=[(2, m9), (7, D9), (0, M9), (5, M7)], swing=0.3,
   partes=[('bat', 'kick_soft', 'x.......x.x.....', 0.9), ('bat', 'snare_lofi', '....x.......x...', 0.6), ('acorde', 'epiano', [(0, 8), (8, 8)], 0.9, 0),
           ('bajo', 'bass_funk', [(0, 3, 0), (6, 2, 7), (10, 3, 12)], 0.6), ('mel', 'vibes', 0.18, 0.5, 1, 3)],
   fx=dict(rev=0.45, t60=3.0, lp=5000, lofi=0.01, eco=0.25)),
 'lofihop': dict(nombre='Lo-fi hip-hop', mood=['calma', 'foco', 'cafe'], energia=2, etiquetas=['lofi', 'hiphop', 'estudio', 'beats'],
   var=[(57, 86), (60, 90), (53, 82)], modo='dorico', prog=[(0, m9), (5, D9), (3, M7), (10, D9)], swing=0.5,
   partes=[('bat', 'kick_boom', 'x.....x...x.....', 0.8), ('bat', 'snare_lofi', '....x.......x...', 0.75), ('bat', 'hat', 'x.x.x.xox.x.x.x.', 0.45),
           ('acorde', 'piano_lofi', [(0, 6), (8, 6)], 0.8, 0), ('bajo', 'bass_upright', [(0, 5, 0), (7, 2, 7), (10, 4, 0)], 0.8), ('mel', 'epiano', 0.14, 0.45, 1, 3)],
   fx=dict(lofi=0.014, lp=5200, rev=0.2, t60=1.5)),
 'hiphopsuave': dict(nombre='Hip-hop suave', mood=['urbano', 'cercano', 'confianza'], energia=2, etiquetas=['hiphop', 'suave', 'jazzy', 'vlog'],
   var=[(55, 88), (60, 92), (52, 84)], modo='menor', prog=[(0, m9), (8, M7), (3, M9), (7, m7)], swing=0.45,
   partes=[('bat', 'kick_boom', 'x......x..x.....', 0.85), ('bat', 'snare', '....x.......x...', 0.6), ('bat', 'hat', 'x.x.x.x.x.x.x.xo', 0.4), ('bat', 'rim', '..........x.....', 0.3),
           ('acorde', 'epiano', [(0, 4), (10, 4)], 0.8, 0), ('bajo', 'bass_sub', [(0, 5, 0), (7, 3, 0), (10, 5, 7)], 0.85), ('mel', 'vibes', 0.12, 0.45, 1, 2)],
   fx=dict(lofi=0.004, rev=0.2, t60=1.4, lp=8000)),
 'upbeat': dict(nombre='Corporativo upbeat', mood=['optimista', 'negocio', 'energia'], energia=4, etiquetas=['corporate', 'upbeat', 'startup', 'presentación'],
   var=[(62, 124), (60, 120), (65, 128)], modo='mayor', prog=[(0, M), (7, M), (9, m_), (5, add9)],
   partes=[('bat', 'kick_house', 'x...x...x...x...', 1.0), ('bat', 'clap', '....x.......x...', 0.6), ('bat', 'hat_open', '..x...x...x...x.', 0.4), ('bat', 'shaker', 'xxxxxxxxxxxxxxxx', 0.25),
           ('acorde', 'piano', [(0, 2), (3, 1), (6, 2), (10, 2), (14, 2)], 0.6, 0), ('arp', 'pluck_guitar', 'x.xxx.xxx.xxx.xx', [0, 1, 2, 3, 2, 1], 0.45, 1, 1),
           ('bajo', 'bass_saw', [(i, 1, 0 if i % 4 else 12) for i in range(0, 16, 2)], 0.55), ('mel', 'glock', 0.18, 0.45, 2, 2)],
   fx=dict(pump=0.25, rev=0.2, t60=1.5)),
 'motivacional': dict(nombre='Motivacional épico', mood=['inspirador', 'motivacion', 'epico'], energia=4, etiquetas=['motivación', 'himno', 'superación'],
   var=[(60, 100), (62, 96), (57, 104)], modo='mayor', prog=[(9, m_), (5, M), (0, M), (7, M)],
   partes=[('arp', 'piano', 'x.x.x.x.x.x.x.x.', [0, 1, 2, 1, 3, 1, 2, 1], 0.6, 0, 2), ('acorde', 'strings', [(0, 16)], 0.8, 0), ('bat', 'kick_boom', 'x.......x.......', 0.8),
           ('bat', 'snare', '....x.......x...', 0.6), ('bat', 'timbal', '..............x.', 0.5), ('bajo', 'bass_sub', [(0, 8, 0), (8, 8, 0)], 0.7), ('mel', 'brass', 0.12, 0.45, 0, 4)],
   fx=dict(rev=0.35, t60=2.6)),
 'trailer': dict(nombre='Épico tráiler', mood=['epico', 'tension', 'inspirador'], energia=5, etiquetas=['tráiler', 'épico', 'cine', 'percusión'],
   var=[(50, 100), (45, 92), (52, 108)], modo='menor', prog=[(0, m_), (8, M), (3, M), (10, M)],
   partes=[('bat', 'timbal', 'x..x..x...x..x..', 1.0), ('bat', 'kick_boom', 'x.....x...x.....', 0.9), ('bat', 'snare', '....x.......x...', 0.7),
           ('arp', 'strings', 'xxxxxxxxxxxxxxxx', [0, 1, 0, 2, 0, 1, 0, 2], 0.6, 0, 1), ('acorde', 'pad_dark', [(0, 16)], 0.9, -1),
           ('bajo', 'bass_reese', [(0, 16, 0)], 0.6), ('mel', 'brass', 0.1, 0.5, 0, 4)],
   fx=dict(rev=0.4, t60=3.2, lp=9500)),
 'minimal': dict(nombre='Tech minimal clic', mood=['tecnologia', 'foco', 'moderno'], energia=2, etiquetas=['minimal', 'tech', 'clics', 'ia'],
   var=[(57, 118), (52, 122), (60, 114)], modo='menor', prog=[(0, m7), (0, m7), (5, m7), (3, M7)],
   partes=[('bat', 'kick_soft', 'x...x...x...x...', 1.0), ('bat', 'rim', '..x..x....x..x.x', 0.35), ('bat', 'hat', '..x...x...x...x.', 0.45),
           ('bajo', 'bass_sub', [(2, 1, 0), (6, 1, 0), (10, 1, 0), (13, 1, 12)], 0.8), ('arp', 'glock', 'x..x..x..x..x...', [0, 2, 4, 1], 0.35, 1, 1), ('acorde', 'pad_glass', [(0, 16)], 0.45, 0)],
   fx=dict(pump=0.3, rev=0.25, t60=1.8, eco=0.25)),
 'espacial': dict(nombre='Ambient espacial', mood=['calma', 'misterio', 'reflexion'], energia=1, etiquetas=['ambient', 'espacio', 'flotante', 'pads'],
   var=[(50, 60), (53, 66), (48, 56)], modo='dorico', prog=[(0, m9), (0, m9), (10, M9), (5, M9)],
   partes=[('acorde', 'pad_glass', [(0, 16)], 1.0, 0), ('acorde', 'pad_dark', [(0, 16)], 0.6, -1), ('mel', 'bell', 0.09, 0.4, 2, 8), ('bajo', 'bass_sub', [(0, 16, 0)], 0.45)],
   fx=dict(rev=0.55, t60=4.5, lp=6500, eco=0.3)),
 'pianoambient': dict(nombre='Piano y ambiente', mood=['emotivo', 'calma', 'reflexion'], energia=1, etiquetas=['piano', 'ambient', 'suave', 'emoción'],
   var=[(60, 68), (57, 62), (64, 72)], modo='mayor', prog=[(0, add9), (9, m7), (5, M9), (7, sus2)],
   partes=[('arp', 'piano', 'x...x.x...x.x...', [0, 2, 1, 3], 0.55, 0, 4), ('acorde', 'pad_warm', [(0, 16)], 0.6, 0), ('mel', 'glock', 0.08, 0.3, 2, 6), ('bajo', 'piano', [(0, 16, 0)], 0.45)],
   fx=dict(rev=0.45, t60=3.4, lp=8000)),
 'tropical': dict(nombre='Tropical house', mood=['alegre', 'lifestyle', 'energia'], energia=3, etiquetas=['tropical', 'verano', 'house', 'playa'],
   var=[(60, 108), (65, 112), (62, 104)], modo='mayor', prog=[(0, M), (7, M), (9, m_), (5, M)],
   partes=[('bat', 'kick_house', 'x...x...x...x...', 0.9), ('bat', 'clap', '....x.......x...', 0.5), ('bat', 'shaker', 'xxxxxxxxxxxxxxxx', 0.3),
           ('arp', 'marimba', 'x..x..x...x..x..', [0, 2, 1, 3, 2], 0.6, 1, 1), ('acorde', 'pad_warm', [(0, 16)], 0.5, 0), ('bajo', 'bass_sub', [(0, 3, 0), (6, 2, 0), (10, 3, 7)], 0.75), ('mel', 'pluck_guitar', 0.15, 0.45, 1, 2)],
   fx=dict(pump=0.45, rev=0.25, t60=1.8)),
 'dnb': dict(nombre='Liquid drum & bass', mood=['energia', 'tecnologia', 'moderno'], energia=5, etiquetas=['dnb', 'liquid', 'rápido', 'breakbeat'],
   var=[(57, 172), (60, 170), (53, 174)], modo='menor', prog=[(0, m9), (8, M9), (3, M9), (10, D9)],
   partes=[('bat', 'kick_house', 'x.........x.....', 1.0), ('bat', 'snare', '....x.......x...', 0.85), ('bat', 'hat', 'x.xxx.xxx.xxx.xx', 0.35),
           ('acorde', 'pad_warm', [(0, 16)], 0.8, 0), ('bajo', 'bass_reese', [(0, 6, 0), (10, 6, 0)], 0.7), ('mel', 'epiano', 0.12, 0.45, 1, 3)],
   fx=dict(rev=0.3, t60=2.2, lp=10000)),
}
ESCALAS = {'mayor': [0, 2, 4, 5, 7, 9, 11], 'menor': [0, 2, 3, 5, 7, 8, 10], 'dorico': [0, 2, 3, 5, 7, 9, 10], 'frigio': [0, 1, 3, 5, 7, 8, 10]}
LETRAS = 'abcdefgh'

def lista_ids():
    return [f'{e}-{i + 1}' for e, st in ESTILOS.items() for i in range(len(st['var']))]
def parse_id(pid):
    e, _, v = str(pid).rpartition('-')
    if e not in ESTILOS: e, v = pid, '1'
    if e not in ESTILOS: raise KeyError(pid)
    return e, max(0, min(len(ESTILOS[e]['var']) - 1, int(v or 1) - 1))

# ------------------------------------------------------------------ melodía con semilla (motivos de 1 compás A/B)
def motivos(semilla, dens, largo):
    r = np.random.default_rng(int(hashlib.md5(semilla.encode()).hexdigest()[:8], 16)); out = []
    for _ in range(2):
        mot, idx = [], int(r.integers(2, 5))
        for s in range(16):
            p = dens * (1.7 if s % 4 == 0 else 1.0 if s % 2 == 0 else 0.35)
            if r.random() < p:
                idx = int(np.clip(idx + r.choice([-2, -1, -1, 0, 1, 1, 2]), 0, 7)); mot.append((s, idx, largo))
        if not mot: mot = [(0, 3, largo), (8, 2, largo)]
        out.append(mot)
    return out

# ------------------------------------------------------------------ reverb circular
@lru_cache(maxsize=16)
def respuesta(t60, lado):
    L = int(t60 * SR); r = np.random.default_rng(100 + lado).standard_normal(L) * np.exp(-6.9 * np.arange(L) / L)
    r = lp(r, 6000); r[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR)); return r / np.sqrt((r ** 2).sum())
def conv_circular(x, ir):
    n = len(x); reps = 2 + int(np.ceil(len(ir) / n))
    return fftconvolve(np.tile(x, reps), ir)[(reps - 1) * n:reps * n]

# ------------------------------------------------------------------ render de una pista
def tempo_ajustado(bpm, dur):
    tiempos = dur * bpm / 60; cands = [k for k in range(1, 400) if abs(k * 60 / dur - bpm) / bpm <= 0.1]
    if not cands: return bpm, max(1, round(tiempos))
    k = min(cands, key=lambda k: (abs(k * 60 / dur - bpm) / bpm) - (0.015 if k % 2 == 0 else 0))
    return k * 60 / dur, k

def render(pid, dur, compas0=0, devolver_info=False):
    e, vi = parse_id(pid); st = ESTILOS[e]; tono, bpm0 = st['var'][vi]
    bpm, ntiempos = tempo_ajustado(bpm0, dur); paso = 60 / bpm / 4; npasos = ntiempos * 4
    n = int(round(dur * SR)); cola = 6 * SR
    bus = {k: np.zeros(n + cola) for k in ('bat', 'musica', 'acorde', 'envio')}
    def pon(b, x, t, g=1.0, envio=0.0):
        i = int(round(t * SR)) % n; L = min(len(x), len(bus[b]) - i); bus[b][i:i + L] += g * x[:L]
        if envio: bus['envio'][i:i + L] += envio * g * x[:L]
    sw, sw8 = st.get('swing', 0.0), st.get('swing8', 0.0)
    def tiempo(s):
        k = s % 16; return s * paso + (sw * 0.5 * paso if k % 2 == 1 else 0) + (sw8 * 2 * paso if k % 4 == 2 else 0)
    escala = ESCALAS[st['modo']]; pm = next(((p[2], p[5]) for p in st['partes'] if p[0] == 'mel'), (0.2, 2)); mots = motivos(f'{e}-{vi}', *pm)
    rev = st['fx'].get('rev', 0.2); kicks = []
    for s0 in range(0, npasos, 16):
        compas = compas0 + s0 // 16; ro, ints = st['prog'][compas % len(st['prog'])]
        raiz = tono + ro; raiz = raiz - 12 if raiz - tono >= 7 else raiz
        tonos = sorted(raiz + i for i in ints); ext = tonos + [x + 12 for x in tonos] + [x + 24 for x in tonos]
        for parte in st['partes']:
            tipo, inst = parte[0], parte[1]
            if tipo == 'bat':
                pat, g = parte[2], parte[3]
                if g <= 0 and inst != 'kick_808': continue
                for k, ch in enumerate(pat):
                    s = s0 + k
                    if s >= npasos or ch == '.': continue
                    if inst.startswith('kick'): kicks.append(tiempo(s))
                    if g <= 0: continue
                    v = {'x': 1.0, 'X': 1.2, 'o': 0.55, 'g': 0.3, 'r': 0.7}.get(ch, 1.0)
                    pon('bat', bateria(inst), tiempo(s), g * v, rev * (0.6 if 'snare' in inst or inst == 'clap' else 0.15))
                    if ch == 'r': pon('bat', bateria(inst), tiempo(s) + paso / 2, g * 0.55)
            elif tipo == 'bajo':
                for (k, L, iv) in parte[2]:
                    s = s0 + k
                    if s >= npasos: continue
                    m = raiz - 24 + iv; m += 12 if m < 28 else 0
                    pon('musica', nota(inst, m, round(L * paso, 3)), tiempo(s), parte[3], rev * 0.1)
            elif tipo == 'acorde':
                g, octv = parte[3], parte[4]
                for (k, L) in parte[2]:
                    s = s0 + k
                    if s >= npasos: continue
                    dd = round(min(L, npasos - s + 2) * paso, 3)
                    for j, m in enumerate(tonos):
                        pon('acorde', nota(inst, m + 12 * octv, dd), tiempo(s) + j * 0.004, g / np.sqrt(len(tonos)) * 1.6, rev)
            elif tipo == 'arp':
                pat, orden, g, octv, L = parte[2], parte[3], parte[4], parte[5], parte[6]; c = 0
                for k, ch in enumerate(pat):
                    s = s0 + k
                    if s >= npasos or ch == '.': continue
                    m = ext[orden[c % len(orden)] % len(ext)] + 12 * octv; c += 1
                    pon('musica', nota(inst, m, round(L * paso, 3)), tiempo(s), g * (1.0 if k % 4 == 0 else 0.8), rev * 0.8)
            elif tipo == 'mel':
                g, octv = parte[3], parte[4]; mot = mots[compas % 2]
                for (k, idx, L) in mot:
                    s = s0 + k
                    if s >= npasos: continue
                    m = ext[idx % len(ext)] + 12 * octv
                    pon('musica', nota(inst, m, round(L * paso, 3)), tiempo(s), g, rev * 1.2)
    def vuelta(x):
        y = x[:n].copy(); c = x[n:]
        for j in range(0, len(c), n): y[:len(c[j:j + n])] += c[j:j + n]
        return y
    bat, mus, aco, env = (vuelta(bus[k]) for k in ('bat', 'musica', 'acorde', 'envio'))
    fx = st['fx']
    if fx.get('pump') and kicks:
        tt = np.arange(n) / SR; g = np.ones(n)
        for tk in kicks:
            d = (tt - tk) % dur; g *= 1 - fx['pump'] * np.exp(-d / 0.11) * (d < 0.4)
        mus *= g; aco *= g
    if fx.get('eco'):
        dl = int(round(3 * paso * SR)); mus = mus + fx['eco'] * np.roll(aco, dl); aco = aco + fx['eco'] * 0.5 * np.roll(aco, 2 * dl)
    t60 = fx.get('t60', 1.8)
    wl, wr = conv_circular(env, respuesta(t60, 0)), conv_circular(env, respuesta(t60, 1))
    L = bat + mus + aco + wl; R = bat + mus + np.roll(aco, int(0.013 * SR)) + wr
    x = np.stack([L, R])
    if fx.get('viento'):
        v = bp(ruido(n + SR, 4321), 300, 1400)[:n] * fx['viento'] * 30 * (0.6 + 0.4 * np.sin(2 * np.pi * max(1, round(dur / 4)) / dur * np.arange(n) / SR))
        x += v
    if fx.get('lofi'):
        wow = max(1, round(0.5 * dur)) / dur; idx = (np.arange(n) + 0.0012 * SR * np.sin(2 * np.pi * wow * np.arange(n) / SR)) % n
        x = np.stack([np.interp(idx, np.arange(n), c, period=n) for c in x])
        x = np.round(x * 2 ** 11) / 2 ** 11
        crack = np.zeros(n); rr = np.random.default_rng(55); pos = rr.integers(0, n, int(dur * 9)); crack[pos] = rr.uniform(-1, 1, len(pos))
        x += fx['lofi'] * (lp(crack, 5000) * 8 + 0.15 * hp(ruido(n, 888), 3000))
    x = np.stack([circular(lambda c: hp(lp(c, fx.get('lp', 12000)), 30), c) for c in x])
    return (x, dict(bpm=round(bpm, 2), tiempos=ntiempos)) if devolver_info else x

# ------------------------------------------------------------------ sonoridad (BS.1770, K-weighting a 48 kHz)
KW = [(np.array([1.53512485958697, -2.69169618940638, 1.19839281085285]), np.array([1.0, -1.69065929318241, 0.73248077421585])),
      (np.array([1.0, -2.0, 1.0]), np.array([1.0, -1.99004745483398, 0.99007225036621]))]
def lufs(x):
    from scipy.signal import lfilter
    x = np.atleast_2d(x); reps = max(2, int(np.ceil(3 * SR / x.shape[1])) + 1); x = np.tile(x, reps)
    y = x
    for b, a in KW: y = lfilter(b, a, y, axis=1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    if y.shape[1] < blk: return -70.0
    pot = np.array([(y[:, i:i + blk] ** 2).mean(1).sum() for i in range(0, y.shape[1] - blk + 1, hop)])
    l = -0.691 + 10 * np.log10(pot + 1e-12); pot = pot[l > -70]
    if not len(pot): return -70.0
    rel = -0.691 + 10 * np.log10(pot.mean()) - 10; l = -0.691 + 10 * np.log10(pot + 1e-12)
    return float(-0.691 + 10 * np.log10(pot[l > rel].mean()))
def pico_tp(x): return float(20 * np.log10(np.abs(resample_poly(np.atleast_2d(x), 4, 1, axis=1)).max() + 1e-12))
def circular(fn, x): n = len(x); return fn(np.tile(x, 3))[n:2 * n]
def limita(x, techo_db=-1.5):
    techo = 10 ** (techo_db / 20); n = x.shape[1]
    picos = np.abs(resample_poly(np.tile(x, 3), 4, 1, axis=1)).max(0).reshape(-1, 4).max(1)[:3 * n]
    g = np.minimum(1.0, techo / np.maximum(picos, 1e-9)); w = int(0.003 * SR)
    g = uniform_filter1d(minimum_filter1d(g, 2 * w + 1), w)[n:2 * n]
    return x * np.minimum(g, 1.0)
def normaliza(x, meta):
    gan = 10 ** ((meta - lufs(x)) / 20); y = x * gan
    for _ in range(2):
        y = limita(y); gan *= 10 ** ((meta - lufs(y)) / 20); y = limita(x * gan)
    return y
def graba(ruta, x):
    x = np.atleast_2d(x); x = np.vstack([x, x]) if x.shape[0] == 1 else x
    wavfile.write(str(ruta), SR, (np.clip(x.T, -1, 1) * 32767).astype(np.int16))
def lee(ruta):
    sr, d = wavfile.read(str(ruta)); d = d.astype(np.float64) / (32768.0 if d.dtype == np.int16 else 1.0)
    d = d.mean(1) if d.ndim > 1 else d
    return resample_poly(d, SR, sr) if sr != SR else d

def pista(pid, dur, meta=-16.0, compas0=0):
    return normaliza(render(pid, dur, compas0), meta)

# ------------------------------------------------------------------ SFX por eventos
SFX_DIR = AQUI / 'sfx'
@lru_cache(maxsize=1)
def sfx_cat():
    try: return {s['id']: s for s in json.load(open(SFX_DIR / 'catalogo.json', encoding='utf-8'))['sonidos']}
    except Exception: return {}
@lru_cache(maxsize=None)
def sfx_audio(sid):
    s = sfx_cat()[sid]; return lee(SFX_DIR / s['archivo'])
POOLS = {
    'entrada': ['swoosh-texto-1', 'whoosh-corto-1', 'swoosh-texto-3', 'whoosh-corto-2', 'swoosh-texto-2', 'whoosh-corto-3', 'swoosh-texto-4', 'swish-arriba'],
    'imagen': ['whoosh-medio-1', 'whoosh-medio-3', 'whoosh-medio-2', 'whoosh-paso'],
    'destacado': ['pop-1', 'pop-4', 'pop-2', 'pop-burbuja', 'pop-5', 'pop-3', 'pop-6'],
    'cifra': ['tick-1', 'tick-2', 'tick-3'],
    'cta': ['ding-1', 'campanita', 'ding-2', 'notif-suave', 'check-suave', 'correcto-2'],
    'teclado': ['tecla-1', 'tecla-2', 'tecla-espacio'],
    'bloque': ['click-suave', 'click-2', 'toggle', 'click-1', 'swish-abajo', 'click-3'],
}
NIVEL = {'entrada': -24, 'imagen': -25, 'destacado': -23, 'cifra': -31, 'cta': -21, 'teclado': -30, 'bloque': -29}  # LUFS momentáneos del golpe (normal)
PRIORIDAD = ['cta', 'entrada', 'imagen', 'cifra', 'teclado', 'destacado', 'bloque']
NUM = __import__('re').compile(r'^\D{0,3}[\d][\d.,]*\s?(%|k|K|M|€|\$|x)?\D{0,6}$')

def clasifica(evs, dur, es_cta):
    out = []
    for e in evs or []:
        a = str(e.get('a') or ''); cls = str(e.get('cls') or ''); t = float(e.get('t') or 0); d = float(e.get('d') or 0); fs = float(e.get('fs') or 0)
        txt = str(e.get('txt') or '').strip()
        if t >= dur - 0.05 or a in ('flota', 'marquee', 'late', 'pulsa', 'ninguna') or 'marca' in cls.split(): continue
        if a == 'cuenta': tipo = 'cifra'; d = d or 1.0
        elif a in ('maquina', 'escribe', 'tecla', 'teclea'): tipo = 'teclado'; d = d or max(0.4, min(2.0, len(txt) * 0.045))
        elif e.get('pill') or cls in ('sticker',): tipo = 'cta' if es_cta else 'destacado'
        elif cls in ('imagen', 'foto') or ' img' in ' ' + cls: tipo = 'imagen'
        elif cls == 'icono' or cls == 'emoji': tipo = 'destacado'
        elif txt and NUM.match(txt) and len(txt) < 12: tipo = 'cifra'; d = d or 0.5
        elif fs >= 66 or any(k in cls.split() for k in ('tit', 'titulo', 'cuerpo', 'palabra', 'grande', 'num')): tipo = 'entrada'
        else: tipo = 'bloque'
        out.append(dict(t=t, d=d, tipo=tipo, txt=txt[:30]))
        if e.get('ac') and tipo not in ('cta', 'cifra'): out.append(dict(t=t + 0.32, d=0, tipo='destacado', txt='*'))
    out.sort(key=lambda x: (x['t'], PRIORIDAD.index(x['tipo'])))
    if es_cta and not any(x['tipo'] == 'cta' for x in out) and out:
        max(out, key=lambda x: x['t'])['tipo'] = 'cta'
    if out and not any(x['tipo'] == 'entrada' for x in out[:3]) and out[0]['tipo'] == 'bloque': out[0]['tipo'] = 'entrada'
    final = []
    for x in out:  # nada pisado: 0,14 s mínimo; el más importante gana
        sep = 0.22 if x['tipo'] == 'bloque' else 0.14
        choque = next((y for y in final if abs(y['t'] - x['t']) < (0.22 if 'bloque' in (x['tipo'], y['tipo']) else sep)), None)
        if choque:
            if PRIORIDAD.index(x['tipo']) < PRIORIDAD.index(choque['tipo']): final[final.index(choque)] = x
            continue
        final.append(x)
    bl = [x for x in final if x['tipo'] == 'bloque']
    for x in bl[3:]: final.remove(x)  # como mucho 3 clics por lámina
    return final

def sfx_pista(eventos, dur, n_slide, intensidad, semilla='', es_cta=False, previo=None):
    """Devuelve (estéreo, lista de golpes colocados). previo = firma de la lámina anterior (para no repetir)."""
    n = int(round(dur * SR)); x = np.zeros(n + 3 * SR); usados = []
    if intensidad == 'sin' or not sfx_cat(): return np.zeros((2, n)), usados
    extra_db = -6.0 if intensidad == 'sutil' else 0.0
    rot = int(hashlib.md5(str(semilla).encode()).hexdigest()[:4], 16) % 7
    cuenta = {}
    def elige(tipo):
        pool = [p for p in POOLS[tipo] if p in sfx_cat()]; j = cuenta.get(tipo, 0); cuenta[tipo] = j + 1
        return pool[(n_slide * 3 + j + rot) % len(pool)] if pool else None
    def pon(sid, t, db=0.0):
        if not sid: return
        a = sfx_audio(sid); s = sfx_cat()[sid]; g = 10 ** ((NIVEL[tipo] + extra_db + db - s.get('lufs_m', -18)) / 20)
        i = int(round(t * SR))
        if i < 0: a = a[-i:]; i = 0
        L = min(len(a), len(x) - i); x[i:i + L] += g * a[:L]
    for ev in clasifica(eventos, dur, es_cta):
        tipo = ev['tipo']; t = ev['t']
        if tipo in ('entrada', 'imagen'):
            sid = elige(tipo); pon(sid, t - 0.25 * sfx_cat()[sid]['dur'] if sid else t)
        elif tipo == 'cifra':
            k = max(3, min(18, int(ev['d'] / 0.07))); sid = elige('cifra')
            for j in range(k): pon(sid, t + j * ev['d'] / k, -2.5 * j / k + (1.5 if j == k - 1 else 0))
        elif tipo == 'teclado':
            r = np.random.default_rng(int(t * 1000) + n_slide); k = max(3, min(40, int(ev['d'] * 15))); pool = [p for p in POOLS['teclado'] if p in sfx_cat()]
            for j in range(k): pon(pool[int(r.integers(len(pool)))], t + j * ev['d'] / k + r.uniform(-0.012, 0.012), r.uniform(-3, 0))
            sid = pool[0]
        elif tipo == 'cta':
            sid = elige('cta'); pon(sid, t + 0.08)
        else:
            sid = elige(tipo); pon(sid, t)
        usados.append(dict(t=round(t, 2), tipo=tipo, sfx=sid, texto=ev['txt']))
    y = x[:n].copy(); y[-int(0.04 * SR):] *= np.linspace(1, 0, int(0.04 * SR))  # sin colas que vuelvan al principio
    return np.stack([y, y]), usados

def mezcla(plan):
    pid = plan.get('pista') or 'sin'; inten = plan.get('sfx', 'normal'); meta = float(plan.get('lufs', -16)); informe = {'pista': pid, 'sfx': inten, 'slides': []}
    firma_prev = None
    for sl in plan['slides']:
        dur = float(sl['dur']); n = int(round(dur * SR))
        mus = pista(pid, dur, meta, int(sl.get('compas0', 0))) if pid != 'sin' else np.zeros((2, n))
        fx, usados = sfx_pista(sl.get('eventos', []), dur, int(sl.get('n', 1)), inten, plan.get('semilla', ''), bool(sl.get('cta')))
        firma = tuple(u['sfx'] for u in usados)
        if firma and firma == firma_prev:  # dos láminas seguidas idénticas: se desplaza la elección
            fx, usados = sfx_pista(sl.get('eventos', []), dur, int(sl.get('n', 1)) + 1, inten, str(plan.get('semilla', '')) + 'x', bool(sl.get('cta')))
            firma = tuple(u['sfx'] for u in usados)
        firma_prev = firma
        if sl.get('salida_musica'): graba(sl['salida_musica'], mus)
        if sl.get('salida_sfx'): graba(sl['salida_sfx'], fx)
        total = mus + fx
        total = limita(total) if pid != 'sin' else (limita(total) if np.abs(total).max() > 0 else total)
        if sl.get('salida'): graba(sl['salida'], total)
        l = lufs(total) if np.abs(total).max() > 0 else -70.0
        informe['slides'].append(dict(n=sl.get('n'), dur=dur, lufs=round(l, 1), lufs_musica=round(lufs(mus), 1) if pid != 'sin' else None,
                                      pico_dbtp=round(pico_tp(total), 1) if np.abs(total).max() > 0 else None, sfx=usados))
    return informe

# ------------------------------------------------------------------ catálogo + previas
def construir():
    (AQUI / 'previas').mkdir(exist_ok=True); items = []
    for e, st in ESTILOS.items():
        for vi, (tono, bpm) in enumerate(st['var']):
            pid = f'{e}-{vi + 1}'; x = pista(pid, 12.0, -16.0)
            tmp = AQUI / 'previas' / f'{pid}.wav'; graba(tmp, x)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-af', 'afade=t=in:d=0.05,afade=t=out:st=11.2:d=0.8', '-c:a', 'libmp3lame', '-q:a', '5', str(AQUI / 'previas' / f'{pid}.mp3')], check=True)
            tmp.unlink()
            modo = {'mayor': 'mayor', 'menor': 'menor', 'dorico': 'dórico', 'frigio': 'frigio'}[st['modo']]
            items.append(dict(id=pid, estilo=e, nombre=f"{st['nombre']} · {LETRAS[vi].upper()}", tono=f'{NOMBRES[tono % 12]} {modo}', tempo=bpm, energia=st['energia'],
                              mood=st['mood'], etiquetas=st['etiquetas'], previa=f'previas/{pid}.mp3', lufs=round(lufs(x), 1)))
            print('✓', pid, items[-1]['tono'], bpm, 'BPM', items[-1]['lufs'], 'LUFS', flush=True)
    estilos = [dict(id=e, nombre=st['nombre'], mood=st['mood'], energia=st['energia'], etiquetas=st['etiquetas'], variantes=[f'{e}-{i + 1}' for i in range(len(st['var']))]) for e, st in ESTILOS.items()]
    moods = sorted({m for st in ESTILOS.values() for m in st['mood']})
    json.dump(dict(version=1, sr=SR, lufs=-16, licencia='Propia: sintetizado por Viegas Estudio con numpy/scipy. Uso libre, también comercial.', moods=moods, estilos=estilos, pistas=items),
              open(AQUI / 'catalogo.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    orden = sys.argv[1] if len(sys.argv) > 1 else ''
    if orden == 'construir': construir()
    elif orden == 'pista':
        pid, dur, sal = sys.argv[2], float(sys.argv[3]), sys.argv[4]
        x = pista(pid, dur, float(sys.argv[6]) if len(sys.argv) > 6 else -16.0, int(sys.argv[5]) if len(sys.argv) > 5 else 0); graba(sal, x)
        print(json.dumps(dict(lufs=round(lufs(x), 1), pico=round(pico_tp(x), 1))))
    elif orden == 'mezcla':
        plan = json.load(open(sys.argv[2], encoding='utf-8')); print(json.dumps(mezcla(plan), ensure_ascii=False))
    else: print(__doc__)
