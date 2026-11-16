"""scribe_a_timeline.py · tiempos palabra a palabra desde la transcripción de ElevenLabs Scribe (sin Whisper)

Uso:
  python3 scribe_a_timeline.py <proyecto> --audio <toma.mp3> --palabras <words.json> [--fuente "texto"]

  <proyecto>/voz.txt        el guion (solo para comprobar que Scribe oyó las mismas palabras)
  --audio                   la toma elegida (mp3/wav descargado del conector)
  --palabras                words.json de Scribe: {"words":[{"text","type","start","end"}, ...]}
                            (se baja de `words_download_url` del resultado de creative_transcribe_audio)

Deja en <proyecto>/voz/: voz.wav (48 kHz mono), timeline.json y timeline.js (los mismos que produce voz.py de la skill
motor incluido en esta skill, así que render.mjs y X.en('palabra') funcionan igual).
Si Scribe oyó distinto número de palabras que el guion, AVISA (nunca repartas tiempos a ojo).
"""
import argparse, importlib.util, json, pathlib, re, sys

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

BASE = pathlib.Path(__file__).resolve().parent / 'voz.py'   # misma carpeta: la skill es autosuficiente
ap = argparse.ArgumentParser()
ap.add_argument('proyecto'); ap.add_argument('--audio', required=True); ap.add_argument('--palabras', required=True)
ap.add_argument('--fuente', default='ElevenLabs Scribe (toma elegida)')
a = ap.parse_args()
proy = pathlib.Path(a.proyecto).resolve()
if not BASE.exists(): sys.exit(f'Falta el motor de voz de la skill: {BASE}')
spec = importlib.util.spec_from_file_location('vozbase', BASE); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

datos = json.load(open(a.palabras, encoding='utf-8'))
ws = [{'w': w['text'], 's': float(w['start']), 'e': float(w['end'])} for w in datos['words'] if w.get('type', 'word') == 'word' and re.search(r'[A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü]', w['text'])]  # sin «…» sueltos
guion = (proy / 'voz.txt').read_text(encoding='utf-8') if (proy / 'voz.txt').exists() else ''
norm = lambda s: re.sub(r'[^a-z0-9ñ]', '', re.sub(r'[̀-ͯ]', '', __import__('unicodedata').normalize('NFD', s.lower())))
gw = [norm(x) for x in guion.split() if norm(x)]
sw = [norm(x['w']) for x in ws if norm(x['w'])]
if gw and gw != sw:
    dif = [(i, g, s) for i, (g, s) in enumerate(zip(gw, sw)) if g != s][:5]
    print(f'AVISO: Scribe oyó {len(sw)} palabras y el guion tiene {len(gw)}. Primeras diferencias: {dif}. Revisa voz/timeline.json antes de animar.')
else:
    print(f'✓ las {len(ws)} palabras de Scribe coinciden con voz.txt')
(proy / 'voz').mkdir(exist_ok=True)
m.guardar(proy, ws, a.audio, a.fuente)
