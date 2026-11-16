"""voz_voicestudio.py · voz + tiempos palabra a palabra con VoiceStudio (servidor propio), sin ElevenLabs

Uso:
  VOICESTUDIO_API_KEY=... python3 voz_voicestudio.py <proyecto> [--voz M1] [--idioma Spanish] [--url https://voz.redstonengineers.com]

  <proyecto>/voz.txt   el guion que se locuta (UNA toma: si ya existe voz/tomas/toma1.wav no se repite salvo --forzar)

Hace, en este orden:
  1. POST /generate  (motor Supertonic-3, voz predefinida, español)        -> voz/tomas/toma1.wav
  2. POST /v1/audio/transcriptions con timestamp_granularities=word (Whisper medium del servidor)
  3. compara las palabras oídas con voz.txt (AVISA si difieren; nunca reparte tiempos a ojo)
  4. m.guardar(...) de esta skill -> voz/voz.wav, timeline.json y timeline.js (los mismos que usa render.mjs)

La clave NUNCA se escribe en ficheros: solo variable de entorno VOICESTUDIO_API_KEY.
Solo librería estándar.
"""
import argparse, importlib.util, json, os, pathlib, re, sys, unicodedata, urllib.request, uuid

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

BASE = pathlib.Path(__file__).resolve().parent / 'voz.py'   # misma carpeta: la skill es autosuficiente
ap = argparse.ArgumentParser()
ap.add_argument('proyecto')
ap.add_argument('--voz', default='M1', help='voz predefinida de Supertonic-3: M1 M3 M4 M5 F3 F4 F5')
ap.add_argument('--idioma', default='Spanish')
ap.add_argument('--url', default=os.environ.get('VOICESTUDIO_URL', 'https://voz.redstonengineers.com'))
ap.add_argument('--velocidad', type=float, default=1.0)
ap.add_argument('--forzar', action='store_true', help='generar otra toma aunque ya exista (consume tiempo de servidor)')
a = ap.parse_args()

KEY = os.environ.get('VOICESTUDIO_API_KEY', '')
if not KEY: sys.exit('Falta la variable de entorno VOICESTUDIO_API_KEY (la clave está en Coolify -> voicestudio -> Environment Variables).')
proy = pathlib.Path(a.proyecto).resolve()
guion = (proy / 'voz.txt').read_text(encoding='utf-8').strip()
if not guion: sys.exit('voz.txt está vacío')
if not BASE.exists(): sys.exit(f'Falta el motor de voz de la skill: {BASE}')
tomas = proy / 'voz' / 'tomas'; tomas.mkdir(parents=True, exist_ok=True)
toma = tomas / 'toma1.wav'


def multipart(campos, ficheros=None):
    b = '----vs' + uuid.uuid4().hex
    out = b''
    for k, v in campos:
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, nombre, datos in (ficheros or []):
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{nombre}"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + datos + b'\r\n'
    return out + f'--{b}--\r\n'.encode(), f'multipart/form-data; boundary={b}'


def post(ruta, campos, ficheros=None, espera=1500):
    cuerpo, tipo = multipart(campos, ficheros)
    req = urllib.request.Request(a.url.rstrip('/') + ruta, data=cuerpo, method='POST',
                                 headers={'Authorization': f'Bearer {KEY}', 'Content-Type': tipo})
    try:
        with urllib.request.urlopen(req, timeout=espera) as r: return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f'{ruta} -> HTTP {e.code}: {e.read()[:400].decode("utf-8", "replace")}')


if toma.exists() and not a.forzar:
    print(f'Ya hay una toma ({toma}); regla de UNA toma de voz: no se genera otra (usa --forzar si hace falta).')
else:
    print(f'Generando voz ({a.voz}, {a.idioma}) …')
    wav = post('/generate', [('text', guion), ('language', a.idioma), ('engine', 'supertonic3'),
                              ('preset_voice', a.voz), ('speed', str(a.velocidad))])
    if wav[:4] != b'RIFF': sys.exit(f'El servidor no devolvió audio WAV: {wav[:300]!r}')
    toma.write_bytes(wav)
    print(f'✓ {toma} ({len(wav) // 1024} KB)')

print('Transcribiendo con tiempos palabra a palabra …')
res = json.loads(post('/v1/audio/transcriptions',
                      [('model', 'whisper-1'), ('language', 'es'), ('response_format', 'verbose_json'),
                       ('timestamp_granularities[]', 'word')],
                      [('file', toma.name, toma.read_bytes())]))
ws = [{'w': w['word'].strip(), 's': float(w['start']), 'e': float(w['end'])} for w in res.get('words', []) if w['word'].strip()]
if not ws: sys.exit('La transcripción no devolvió palabras con tiempos.')

norm = lambda s: re.sub(r'[^a-z0-9ñ]', '', re.sub(r'[̀-ͯ]', '', unicodedata.normalize('NFD', s.lower())))
gw = [norm(x) for x in guion.split() if norm(x)]
# Whisper parte a veces una palabra en trozos ("wifi" -> "wi"+"fi"): se funden si juntos igualan la palabra del guion
fund, i, j = [], 0, 0
while i < len(ws):
    g = gw[j] if j < len(gw) else None
    hecho = False
    if g is not None and norm(ws[i]['w']) != g:
        for n in (2, 3, 4):
            trozo = ws[i:i + n]
            if len(trozo) == n and ''.join(norm(x['w']) for x in trozo) == g:
                fund.append({'w': ''.join(x['w'] for x in trozo), 's': trozo[0]['s'], 'e': trozo[-1]['e']}); i += n; j += 1; hecho = True; break
    if not hecho:
        fund.append(ws[i]); i += 1; j += 1
ws = fund
sw = [norm(x['w']) for x in ws if norm(x['w'])]
if gw != sw:
    dif = [(i, g, s) for i, (g, s) in enumerate(zip(gw, sw)) if g != s][:5]
    print(f'AVISO: el servidor oyó {len(sw)} palabras y el guion tiene {len(gw)}. Primeras diferencias: {dif}. '
          'Revisa voz/timeline.json antes de animar (cifras y siglas son lo habitual).')
else:
    print(f'✓ las {len(ws)} palabras coinciden con voz.txt')

spec = importlib.util.spec_from_file_location('vozbase', BASE); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
(proy / 'voz').mkdir(exist_ok=True)
m.guardar(proy, ws, str(toma), f'VoiceStudio Supertonic-3 ({a.voz}) + Whisper medium')
print('✓ voz/voz.wav, voz/timeline.json y voz/timeline.js listos')
