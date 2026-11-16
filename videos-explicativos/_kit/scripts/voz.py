"""voz.py · la voz en off y sus tiempos palabra a palabra (videos-explicativos-claude · Viegas Estudio)

Lee el texto de <proyecto>/voz.txt (lo que se dice, tal cual) y deja en <proyecto>/voz/:
  voz.wav          la voz (48 kHz mono)
  timeline.json    { palabras: [{w, s, e}], dur, fuente }   ← las animaciones y los subtítulos se anclan a esto
  timeline.js      lo mismo para la página (window.TIMELINE)

Formas de conseguir la voz (de mejor a peor):
  python voz.py <proyecto> --elevenlabs <respuesta.json>
        La respuesta del conector MCP de ElevenLabs (o de la API «with-timestamps»): audio en base64 + alignment
        (characters, character_start_times_seconds, character_end_times_seconds). También vale un .mp3/.wav ya
        descargado con su alignment en un .json al lado (mismo nombre).
  python voz.py <proyecto> --api [--voz <voice_id>] [--modelo eleven_multilingual_v2]
        Llama a la API de ElevenLabs con la clave de ELEVENLABS_API_KEY (o el archivo ~/.viegas/elevenlabs.env).
        Nunca imprime la clave.
  python voz.py <proyecto> --alinear <audio>
        Ya tienes la voz (ElevenLabs web, tu propia voz grabada…): saca los tiempos con Whisper (faster-whisper u openai-whisper).
  python voz.py <proyecto> --prueba
        Voz de prueba del sistema (Windows: Helena · Mac: «say -v Monica»). Solo para montar y revisar el ritmo:
        al cambiarla por la buena, todo se vuelve a sincronizar solo porque las animaciones van ancladas a palabras.
"""
import argparse, base64, json, os, pathlib, re, subprocess, sys, tempfile, urllib.request

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass


def guardar(proy, palabras, wav_src, fuente):
    vz = proy / 'voz'; vz.mkdir(exist_ok=True)
    wav = vz / 'voz.wav'
    if pathlib.Path(wav_src).resolve() != wav.resolve():
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav_src), '-ac', '1', '-ar', '48000', str(wav)], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(wav)], capture_output=True, text=True).stdout.strip())
    palabras = [p for p in palabras if p['w'].strip()]
    for i, p in enumerate(palabras):          # fin que falte: hasta la siguiente palabra (o el final)
        if p.get('e') is None or p['e'] <= p['s']:
            p['e'] = min(palabras[i + 1]['s'] - 0.02, p['s'] + 0.8) if i + 1 < len(palabras) else min(dur, p['s'] + 0.6)
        p['s'] = round(p['s'], 3); p['e'] = round(p['e'], 3)
    tl = {'palabras': palabras, 'dur': round(dur, 3), 'fuente': fuente}
    (vz / 'timeline.json').write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding='utf-8')
    (vz / 'timeline.js').write_text('window.TIMELINE = ' + json.dumps(tl, ensure_ascii=False) + ';\n', encoding='utf-8')
    print(f'✓ voz/voz.wav · {dur:.1f} s · {len(palabras)} palabras · {fuente}')
    print(f'  ritmo: {len(palabras) / max(dur, 0.1):.2f} palabras/s (ideal 2,4–3,0 en español)')


def palabras_de_alineacion(al):
    """ElevenLabs alignment (por carácter) → palabras con inicio y fin."""
    ch = al.get('characters') or al.get('chars'); s = al.get('character_start_times_seconds'); e = al.get('character_end_times_seconds')
    out, cur, cs, ce = [], '', None, None
    for c, a, b in zip(ch, s, e):
        if c.isspace():
            if cur: out.append({'w': cur, 's': cs, 'e': ce}); cur = ''
            continue
        if not cur: cs = a
        cur += c; ce = b
    if cur: out.append({'w': cur, 's': cs, 'e': ce})
    return out


def desde_elevenlabs(proy, ruta):
    ruta = pathlib.Path(ruta)
    if ruta.suffix.lower() in ('.mp3', '.wav', '.m4a'):
        al = json.loads(ruta.with_suffix('.json').read_text(encoding='utf-8')); audio = ruta
    else:
        d = json.loads(ruta.read_text(encoding='utf-8'))
        al = d.get('normalized_alignment') or d.get('alignment') or d
        b64 = d.get('audio_base64') or d.get('audio')
        audio = pathlib.Path(tempfile.gettempdir()) / 'voz-eleven.mp3'
        audio.write_bytes(base64.b64decode(b64))
    guardar(proy, palabras_de_alineacion(al), audio, 'elevenlabs')


def clave_api():
    k = os.environ.get('ELEVENLABS_API_KEY')
    if not k:
        f = pathlib.Path.home() / '.viegas' / 'elevenlabs.env'
        if f.exists():
            m = re.search(r'ELEVENLABS_API_KEY\s*=\s*(\S+)', f.read_text(encoding='utf-8'))
            k = m and m.group(1)
    if not k: sys.exit('Falta la clave: pon ELEVENLABS_API_KEY=… en ~/.viegas/elevenlabs.env (o usa el conector MCP y --elevenlabs).')
    return k


def desde_api(proy, texto, voz, modelo, ajustes):
    cuerpo = {'text': texto, 'model_id': modelo, 'voice_settings': ajustes}
    q = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voz}/with-timestamps?output_format=mp3_44100_128',
                               data=json.dumps(cuerpo).encode(), headers={'xi-api-key': clave_api(), 'Content-Type': 'application/json'})
    with urllib.request.urlopen(q, timeout=180) as r: d = json.loads(r.read())
    tmp = pathlib.Path(tempfile.gettempdir()) / 'voz-eleven.json'; tmp.write_text(json.dumps(d), encoding='utf-8')
    desde_elevenlabs(proy, tmp)


def prueba_windows(proy, texto):
    wav = pathlib.Path(tempfile.gettempdir()) / 'voz-prueba.wav'
    txt = pathlib.Path(tempfile.gettempdir()) / 'voz-prueba.txt'; txt.write_text(texto, encoding='utf-8')
    js = pathlib.Path(tempfile.gettempdir()) / 'voz-prueba.json'
    ps = r'''
Add-Type -AssemblyName System.Speech
$code = @"
using System; using System.Collections.Generic; using System.Speech.Synthesis; using System.Threading;
public class Voz { public static string Habla(string texto, string wav) {
  var s = new SpeechSynthesizer(); foreach (var v in s.GetInstalledVoices()) { if (v.VoiceInfo.Culture.Name.StartsWith("es")) { s.SelectVoice(v.VoiceInfo.Name); break; } }
  s.Rate = 1; var L = new List<string>(); var done = new ManualResetEvent(false);
  s.SpeakProgress += (o, e) => { lock (L) L.Add(e.AudioPosition.TotalSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture) + "\t" + e.CharacterPosition + "\t" + e.CharacterCount); };
  s.SpeakCompleted += (o, e) => done.Set();
  s.SetOutputToWaveFile(wav); s.SpeakAsync(texto); done.WaitOne(); s.SetOutputToNull(); return String.Join("\n", L); } }
"@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Speech
$t = [IO.File]::ReadAllText('%TXT%', [Text.Encoding]::UTF8)
[IO.File]::WriteAllText('%JS%', [Voz]::Habla($t, '%WAV%'), [Text.Encoding]::UTF8)
'''.replace('%TXT%', str(txt)).replace('%JS%', str(js)).replace('%WAV%', str(wav))
    subprocess.run(['powershell', '-NoProfile', '-Command', ps], check=True)
    pal = []
    for ln in js.read_text(encoding='utf-8-sig').splitlines():
        a, pos, n = ln.split('\t'); w = texto[int(pos):int(pos) + int(n)]
        pal.append({'w': w, 's': float(a), 'e': None})
    # los tiempos de SAPI se adelantan al audio: si hay Whisper, se alinea con lo que suena de verdad
    try: return alinear(proy, texto, wav)
    except ImportError: print('aviso: sin Whisper, uso los tiempos aproximados de Windows')
    _puntuacion(texto, pal)
    guardar(proy, pal, wav, 'prueba (voz del sistema)')


def _al_guion(texto, ws):
    """Las palabras del guion (voz.txt) con los tiempos de Whisper: corrige lo mal oído («su maleca de facción» → «Súmale
    calefacción»), los números en cifra («2024» → «dos mil veinticuatro» del guion) y las palabras partidas o pegadas."""
    import difflib, unicodedata
    n = lambda w: re.sub(r'[^a-z0-9ñ]', '', unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode() or w.lower())
    toks = re.findall(r'\S+', texto)
    a, b = [n(t) for t in toks], [n(w['w']) for w in ws]
    out = [None] * len(toks)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == 'equal':
            for k in range(i2 - i1): out[i1 + k] = (ws[j1 + k]['s'], ws[j1 + k]['e'])
        elif i2 > i1 and j2 > j1:   # tramo distinto: reparte el tiempo de Whisper entre las palabras del guion
            s0, e0 = ws[j1]['s'], ws[j2 - 1]['e']; L = sum(len(toks[k]) for k in range(i1, i2)) or 1; acc = 0
            for k in range(i1, i2):
                d = (e0 - s0) * len(toks[k]) / L; out[k] = (s0 + acc, s0 + acc + d); acc += d
    # palabras del guion que Whisper no oyó: entre la anterior y la siguiente
    for k in range(len(toks)):
        if out[k] is None:
            prev = next((out[j][1] for j in range(k - 1, -1, -1) if out[j]), 0.0)
            nxt = next((out[j][0] for j in range(k + 1, len(toks)) if out[j]), prev + 0.3)
            out[k] = (prev, max(prev + 0.05, min(nxt, prev + 0.4)))
    return [{'w': toks[k], 's': out[k][0], 'e': out[k][1]} for k in range(len(toks))]


def _puntuacion(texto, pal):
    toks = re.findall(r'\S+', texto); j = 0
    for p in pal:
        k = re.sub(r'\W', '', p['w'].lower())
        while j < len(toks) and re.sub(r'\W', '', toks[j].lower()) != k: j += 1
        if j < len(toks): p['w'] = toks[j]; j += 1


def _audio16k(audio):
    """El audio a 16 kHz mono con ffmpeg (no con PyAV): algunas versiones de PyAV no encajan con faster-whisper y fallan
    al leer el archivo («metadata_errors»). ffmpeg ya es requisito de la skill."""
    import subprocess, numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(audio), '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def alinear(proy, texto, audio):
    ws = None
    pcm = _audio16k(audio)
    try:   # openai-whisper (usa la GPU si torch la ve)
        import whisper
        try: m = whisper.load_model('turbo')
        except Exception: m = whisper.load_model('small')
        r = m.transcribe(pcm, language='es', word_timestamps=True, condition_on_previous_text=False)
        ws = [{'w': w['word'].strip(), 's': w['start'], 'e': w['end']} for s in r['segments'] for w in s['words']]
    except ImportError:
        from faster_whisper import WhisperModel   # sin GPU: en la CPU
        m = WhisperModel('small', device='cpu', compute_type='int8')
        segs, _ = m.transcribe(pcm, language='es', word_timestamps=True, condition_on_previous_text=False)
        ws = [{'w': w.word.strip(), 's': w.start, 'e': w.end} for s in segs for w in s.words]
    n_txt = len(re.findall(r'\S+', texto))
    if len(ws) < 0.9 * n_txt: print(f'AVISO: Whisper solo ha oído {len(ws)} de {n_txt} palabras: revisa voz/timeline.json')
    (proy / 'voz').mkdir(exist_ok=True)
    (proy / 'voz' / 'timeline-whisper.json').write_text(json.dumps(ws, ensure_ascii=False, indent=1), encoding='utf-8')
    guardar(proy, _al_guion(texto, ws), audio, 'alineada con Whisper (palabras del guion)')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('proyecto'); ap.add_argument('--elevenlabs'); ap.add_argument('--api', action='store_true'); ap.add_argument('--alinear')
    ap.add_argument('--prueba', action='store_true'); ap.add_argument('--permitir-prueba', action='store_true'); ap.add_argument('--voz', default='Nh2zY9kknu6z4pZy6FhD'); ap.add_argument('--modelo', default='eleven_multilingual_v2')
    ap.add_argument('--estabilidad', type=float, default=0.45); ap.add_argument('--parecido', type=float, default=0.8); ap.add_argument('--estilo', type=float, default=0.25)
    a = ap.parse_args()
    proy = pathlib.Path(a.proyecto).resolve()
    texto = (proy / 'voz.txt').read_text(encoding='utf-8').strip()
    if a.elevenlabs: desde_elevenlabs(proy, a.elevenlabs)
    elif a.api: desde_api(proy, texto, a.voz, a.modelo, {'stability': a.estabilidad, 'similarity_boost': a.parecido, 'style': a.estilo, 'use_speaker_boost': True, 'speed': 1.0})
    elif a.alinear: alinear(proy, texto, a.alinear)
    elif a.prueba:
        # La voz del sistema solo sirve para ensayar el ritmo: nunca para un vídeo que se publica
        if os.environ.get('VIEGAS_SOLO_ELEVENLABS') == '1' or not a.permitir_prueba:
            sys.exit('ERROR: aquí no se usa la voz del sistema. Genera la voz con el conector de ElevenLabs '
                     '(o la API; voz David Martin Nh2zY9kknu6z4pZy6FhD, eleven_v4) y luego voz.py --alinear. '
                     'Si solo quieres ensayar el ritmo, añade --permitir-prueba.')
        if sys.platform == 'win32': prueba_windows(proy, texto)
        else:
            tmp = pathlib.Path(tempfile.gettempdir()) / 'voz-prueba.aiff'
            subprocess.run(['say', '-v', 'Monica', '-o', str(tmp), texto], check=True); alinear(proy, texto, tmp)
    else: ap.print_help()
