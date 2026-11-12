"""preparar.py · comprueba (y con permiso instala) lo que necesita videos-explicativos-claude

  python preparar.py            → lista de lo que hay y lo que falta, en claro
  python preparar.py --instalar → instala lo que falta (winget en Windows, Homebrew en Mac, npm y pip)
Carpeta de trabajo: Documentos/Videos explicativos (ahí se instala Playwright una vez).
"""
import importlib.util, os, pathlib, shutil, subprocess, sys

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
WIN, MAC = sys.platform == 'win32', sys.platform == 'darwin'
DOCS = pathlib.Path.home() / ('Documents' if (pathlib.Path.home() / 'Documents').exists() else 'Documentos')
TRABAJO = DOCS / 'Videos explicativos'
CHROME = [r'C:/Program Files/Google/Chrome/Application/chrome.exe', r'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
          os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Google/Chrome/Application/chrome.exe'), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']

def hay(m): return importlib.util.find_spec(m) is not None
items = [
    ('Node.js', 'mueve y fotografía las animaciones', bool(shutil.which('node')), 'OpenJS.NodeJS.LTS', 'node'),
    ('ffmpeg', 'convierte los fotogramas en MP4 y mezcla el audio', bool(shutil.which('ffmpeg') and shutil.which('ffprobe')), 'Gyan.FFmpeg', 'ffmpeg'),
    ('Google Chrome', 'dibuja cada fotograma', any(os.path.exists(c) for c in CHROME), 'Google.Chrome', None),
    ('Playwright', 'controla Chrome sin ventana', (TRABAJO / 'node_modules' / 'playwright').exists(), None, None),
    ('numpy + scipy', 'generan la música propia', hay('numpy') and hay('scipy'), None, None),
]
opc = [('Whisper', 'saca los tiempos de una voz que no los trae (tu voz grabada, la voz de prueba)', hay('whisper') or hay('faster_whisper'))]

print('Equipo para vídeos explicativos:\n')
for n, para, ok, *_ in items: print(f"  {'✓' if ok else '✗'} {n} — {para}")
for n, para, ok in opc: print(f"  {'✓' if ok else '·'} {n} (opcional) — {para}")
falta = [i for i in items if not i[2]]
if not falta: print('\nTodo listo.'); sys.exit(0)
if '--instalar' not in sys.argv:
    print('\nFalta: ' + ', '.join(i[0] for i in falta) + '. Pide permiso y ejecuta: python preparar.py --instalar'); sys.exit(1)
TRABAJO.mkdir(parents=True, exist_ok=True)
for n, _, ok, winget, brew in falta:
    print(f'→ instalando {n}…')
    if n == 'Playwright': subprocess.run(['npm', 'i', 'playwright', '--no-audit', '--no-fund'], cwd=TRABAJO, shell=WIN)
    elif n == 'numpy + scipy': subprocess.run([sys.executable, '-m', 'pip', 'install', 'numpy', 'scipy'])
    elif WIN and winget: subprocess.run(['winget', 'install', '-e', '--id', winget, '--accept-source-agreements', '--accept-package-agreements'])
    elif MAC and brew: subprocess.run(['brew', 'install', brew])
    elif MAC and n == 'Google Chrome': subprocess.run(['brew', 'install', '--cask', 'google-chrome'])
print('\nHecho. Si acabas de instalar Node o ffmpeg, abre una sesión nueva para que se vean.')
