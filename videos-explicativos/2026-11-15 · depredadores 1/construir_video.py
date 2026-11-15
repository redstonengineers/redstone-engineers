"""Vídeo completo · depredadores 1 · previa MUDA con subtítulos (clips y fotos reales, sin zoom, sin IA).
Uso: python construir_video.py <carpeta_activos> [salida.mp4]
Cada sección de voz.txt (intro, «Número ocho»…«Número uno», cierre) usa sus propios activos, repartidos en tomas de ~5 s.
Tiempos estimados a 2,5 pal/s; con la voz real se reescalan."""
import pathlib, re, subprocess, sys
A = pathlib.Path(sys.argv[1]); OUT = sys.argv[2] if len(sys.argv) > 2 else 'depredadores1_previa.mp4'
WPS, TOMA = 2.5, 5.0
W = {  # sección → activos (nombre sin extensión: .mp4/.webm = vídeo, .png = foto), por orden de aparición
 'intro': ['358356', 'c3', '2358366', '213424'],
 8: ['358356', '205225', '210430', '358356', '213762'],
 7: ['c3', '10212431', 'c2', '2064539'],
 6: ['217806', '2323344', '163056', '217806'],
 5: ['7602108', '492547', '3439675'],
 4: ['c0', '2358366', '213424', 'c1', '3344', '2434070', '8023068'],
 3: ['167283', '10532631', '590367', '167283'],
 2: ['307555', '10327323', '10065939', '307555'],
 1: ['892669', '213424', '2358366'],
 'cierre': ['358356', 'c3', '167283', '307555', 'c0'],
}
NUM = {'ocho': 8, 'siete': 7, 'seis': 6, 'cinco': 5, 'cuatro': 4, 'tres': 3, 'dos': 2, 'uno': 1}
ps = [p.strip() for p in open('voz.txt', encoding='utf-8') if p.strip()]
secs = {}; cur = 'intro'
for i, p in enumerate(ps):
    m = re.match(r'Número (\w+)\.', p)
    if m and m.group(1) in NUM: cur = NUM[m.group(1)]
    if i >= len(ps) - 2: cur = 'cierre'
    secs.setdefault(cur, []).append(p)
def hallar(n):
    for e in ('mp4', 'webm', 'png'):
        if (A / f'{n}.{e}').exists(): return A / f'{n}.{e}', e
def t(s): ms = round(s * 1000); return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)], capture_output=True, text=True).stdout)
tmp = pathlib.Path('_tmp'); tmp.mkdir(exist_ok=True)
srt, partes, n, cur_t, usados = [], [], 1, 0.0, {}
for clave in ['intro', 8, 7, 6, 5, 4, 3, 2, 1, 'cierre']:
    texto = ' '.join(secs[clave]); pal = texto.split(); d = len(pal) / WPS
    # subtítulos: frases cortas (≤9 palabras), cortando en puntuación cuando se puede
    trozos, c = [], []
    for w in pal:
        c.append(w)
        if len(c) >= 9 or (w[-1] in '.?!' and len(c) >= 4): trozos.append(c); c = []
    if c: trozos.append(c)
    tt = cur_t
    for tr in trozos:
        dd = d * len(tr) / len(pal); srt.append(f"{n}\n{t(tt)} --> {t(tt+dd)}\n{' '.join(tr)}\n"); n += 1; tt += dd
    act = [a for a in (hallar(x) for x in W[clave]) if a]
    k = max(1, round(d / TOMA)); dt = d / k
    for j in range(k):
        f, e = act[j % len(act)]; v = usados.get(f, 0); usados[f] = v + 1
        s = f'{tmp}/s{len(partes):03}.mp4'
        if e == 'png':
            ent = ['-loop', '1', '-i', str(f)]
        else:
            L = dur(f); ini = (v * TOMA) % max(0.1, L - dt) if L > dt else 0
            ent = ['-ss', f'{ini:.2f}', '-i', str(f)]
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *ent, '-t', f'{dt:.3f}', '-an', '-vf',
            'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30,setsar=1,eq=saturation=0.95:contrast=1.04,vignette=PI/6',
            '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', s], check=True)
        partes.append(s)
    cur_t += d
open('depredadores1.srt', 'w', encoding='utf-8').write('\n'.join(srt))
open(tmp / 'lista.txt', 'w').write(''.join(f"file '{pathlib.Path(p).name}'\n" for p in partes))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-i', str(tmp / 'lista.txt'), '-c', 'copy', str(tmp / 'sin_subs.mp4')], check=True)
est = 'FontName=DejaVu Sans,Bold=1,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=36'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(tmp / 'sin_subs.mp4'), '-vf', f"subtitles=depredadores1.srt:force_style='{est}'", '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', OUT], check=True)
print('tomas', len(partes), '· duración estimada', round(cur_t / 60, 1), 'min')
