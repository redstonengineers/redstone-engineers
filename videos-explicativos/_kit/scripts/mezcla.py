"""mezcla.py · voz + música + efectos → voz/mezcla.wav a −14 LUFS (videos-explicativos-claude)

  python mezcla.py <proyecto>
Lee voz/voz.wav, voz/eventos.json (los X.sonido() de la escena, lo escribe render.mjs) y estilo.json del proyecto:
  { "musica": "ambient-2" | "sin" | "ruta/a/tu-musica.mp3", "musica_db": -22, "sfx_db": -8 }
La música es de la biblioteca propia (musica/biblioteca.py, sintetizada, uso libre) y baja sola cuando habla la voz.
"""
import json, pathlib, subprocess, sys, hashlib

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
SKILL = pathlib.Path(__file__).resolve().parent.parent
proy = pathlib.Path(sys.argv[1]).resolve(); vz = proy / 'voz'

# ── Máster a −14 LUFS exactos ───────────────────────────────────────────────────────────────────────────────
# Antes se usaba un solo loudnorm (modo dinámico, una pasada): con los golpes de los efectos se quedaba en
# −15,3…−15,8 LUFS. Ahora: medir (ebur128) → ganancia lineal → limitador con sobremuestreo ×4 (pico real) → volver
# a medir y corregir lo que se haya comido el limitador. Así queda en −14 ±0,1 y el pico real ≤ −1,5 dBTP
# (deja margen para el AAC del MP4, que sube el pico unas décimas).
OBJ_I, OBJ_TP = -14.0, -1.5

def medir(wav):
    import re
    r = subprocess.run(['ffmpeg', '-nostats', '-i', str(wav), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    r = r[r.rfind('Summary:'):]
    i = float(re.search(r'I:\s+(-?[\d.]+) LUFS', r).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', r).group(1))
    return i, tp

def normalizar(entrada, salida, obj=OBJ_I, techo=OBJ_TP):
    """Deja «entrada» en «obj» LUFS con pico real ≤ «techo» dBTP. Devuelve (LUFS, dBTP) medidos al final."""
    i0, _ = medir(entrada)
    g = obj - i0
    for _ in range(4):
        lim = 10 ** ((techo - 0.3) / 20)
        af = (f'volume={g:.3f}dB,aresample=192000,alimiter=limit={lim:.5f}:level=0:attack=1:release=60:asc=1,'
              f'aresample=48000')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(entrada), '-af', af, '-ar', '48000', '-ac', '2',
                        '-c:a', 'pcm_s24le', str(salida)], check=True)
        i, tp = medir(salida)
        if abs(i - obj) <= 0.1 and tp <= techo:
            break
        g += obj - i
    return i, tp

if len(sys.argv) > 2 and sys.argv[2] == '--renormalizar':
    # Rehace solo el máster de una mezcla ya hecha (voz/mezcla.wav), sin volver a mezclar. Guarda la anterior.
    m = vz / 'mezcla.wav'; viejo = vz / 'mezcla-15lufs.wav'
    if not viejo.exists(): m.replace(viejo)
    i, tp = normalizar(viejo, m)
    print(f'✓ voz/mezcla.wav renormalizada · {i:.1f} LUFS · {tp:.1f} dBTP'); sys.exit(0)

est = {}
try: est = json.loads((proy / 'estilo.json').read_text(encoding='utf-8'))
except Exception: pass
ev = json.loads((vz / 'eventos.json').read_text(encoding='utf-8'))
dur = ev['dur']
mus = est.get('musica', 'ambient-2'); mdb = est.get('musica_db', -21); sdb = est.get('sfx_db', -9)

ins, filt = ['-i', str(vz / 'voz.wav')], []
# voz: «natural» (voz de IA → que suene a persona en una sala) · «grabada» (voz grabada: graves +5 dB a 140 Hz) · «limpia»
VFX = {
  'natural': 'highpass=f=70,deesser=i=0.35:m=0.5:f=0.5,equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=3200:t=q:w=1.2:g=1.5,'
             'acompressor=threshold=-20dB:ratio=3:attack=6:release=110:makeup=2,aecho=0.9:0.92:18|31:0.12|0.07',
  'grabada': 'highpass=f=40,equalizer=f=140:t=q:w=1:g=5,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120',
  'limpia': 'highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120',
}
vfx = VFX.get(est.get('voz_fx', 'natural'), VFX['natural'])
filt.append(f'[0:a]aresample=48000,{vfx},apad[voz0]')
# tono de sala muy bajo (−60 dBFS) para que no haya silencios digitales entre frases
filt.append(f'anoisesrc=color=pink:amplitude=0.0015:sample_rate=48000:duration={dur:.3f},lowpass=f=6000[sala]')
filt.append('[voz0][sala]amix=inputs=2:normalize=0:duration=first[voz]')
n = 1
if mus != 'sin':
    mp = pathlib.Path(mus)
    if not mp.exists():
        mp = vz / f'musica-{mus}.wav'
        subprocess.run([sys.executable, str(SKILL / 'musica' / 'biblioteca.py'), 'pista', mus, f'{dur:.3f}', str(mp)], check=True, capture_output=True)
    ins += ['-stream_loop', '-1', '-i', str(mp)]
    filt.append(f'[{n}:a]aresample=48000,volume={mdb}dB,atrim=0:{dur:.3f},afade=t=out:st={max(0, dur - 1.2):.3f}:d=1.2[mus0]')
    filt.append('[voz]asplit=2[vozm][vozsc]')
    filt.append('[mus0][vozsc]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=450[mus]')
    n += 1
sfx = []
for i, e in enumerate(ev['eventos']):
    d = SKILL / 'musica' / 'sfx' / e['tipo']
    fs = sorted(p for p in d.glob('*.wav')) if d.exists() else []
    if not fs: continue
    f = fs[int(hashlib.md5(f"{e['t']}{i}".encode()).hexdigest(), 16) % len(fs)]
    ins += ['-i', str(f)]
    g = sdb + 20 * __import__('math').log10(max(0.05, e.get('ganancia', 1)))
    filt.append(f'[{n}:a]aresample=48000,volume={g:.1f}dB,adelay={int(e["t"] * 1000)}:all=1[s{i}]'); sfx.append(f'[s{i}]'); n += 1
mezc = ('[vozm][mus]' if mus != 'sin' else '[voz]') + ''.join(sfx)
k = 1 + (mus != 'sin') + len(sfx)
filt.append(f'{mezc}amix=inputs={k}:normalize=0:duration=first,atrim=0:{dur:.3f}[out]')
cruda = vz / 'mezcla-cruda.wav'; salida = vz / 'mezcla.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(filt), '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', str(cruda)], check=True)
li, tp = normalizar(cruda, salida)
print(f'✓ voz/mezcla.wav · {dur:.1f} s · música {mus} · {len(sfx)} efectos · {li:.1f} LUFS · {tp:.1f} dBTP')
