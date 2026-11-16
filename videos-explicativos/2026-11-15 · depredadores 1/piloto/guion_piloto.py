"""Piloto 60 s · depredadores 1. Clips reales de Pixabay (licencia Pixabay), subtítulos, sin voz (previa muda).
Uso: python guion_piloto.py <carpeta_clips>   → piloto.srt, piloto_previa.mp4, creditos.md"""
import json, subprocess, sys, pathlib
CL = pathlib.Path(sys.argv[1]); WPS = 2.5   # palabras por segundo (estimación de la voz; se recalcula con la voz real)
# (clip, inicio_s, texto)  — el texto es literal de voz.txt
E_ = [
 (358356, 2, "Hay un cazador que dispara chorros de agua contra insectos."),
 (263235, 1, "Otro que golpea tan rápido que hierve el agua a su alrededor."),
 (6681,   2, "Y otro que usa olas para tirar a su presa al mar."),
 (205225, 0, "Hoy te cuento ocho depredadores que cazan de formas que no imaginas."),
 (213762, 0, "Y hay uno en la lista que ha pasado años acusado de algo que no hace. Quédate hasta el final."),
 (358356, 9, "Empezamos con la número ocho. Número ocho. El pez arquero."),
 (205225, 3, "Vive en ríos y manglares del sudeste asiático y Australia, y su arma es la boca."),
 (210430, 3, "Cuando ve un insecto posado en una hoja por encima del agua, dispara un chorro."),
 (358356, 14, "Un chorro de agua, apuntado con una precisión que ya quisieran muchos tiradores."),
 (358356, 17, "Lo curioso no es que escupa. Es cómo lo hace."),
]
def t(s):
    ms=round(s*1000); return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"
srt=[]; cur=0; n=1; partes=[]
for i,(c,ini,txt) in enumerate(E_):
    d = max(2.0, len(txt.split())/WPS)
    # subtítulos: frases de ≤ 9 palabras repartidas por el tiempo del clip
    pal=txt.split(); trozos=[pal[k:k+9] for k in range(0,len(pal),9)]
    tt=cur
    for tr in trozos:
        dd=d*len(tr)/len(pal); srt.append(f"{n}\n{t(tt)} --> {t(tt+dd)}\n{' '.join(tr)}\n"); n+=1; tt+=dd
    out=f"seg{i}.mp4"
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(ini),'-i',str(CL/f'{c}.mp4'),'-t',f'{d:.3f}','-an',
      '-vf','scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30,setsar=1','-c:v','libx264','-crf','26','-preset','fast','-pix_fmt','yuv420p',out],check=True)
    partes.append(out); cur+=d
open('piloto.srt','w',encoding='utf-8').write('\n'.join(srt))
open('lista.txt','w').write(''.join(f"file '{p}'\n" for p in partes))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-i','lista.txt','-c','copy','sin_subs.mp4'],check=True)
est="FontName=DejaVu Sans,Bold=1,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=36"
subprocess.run(['ffmpeg','-v','error','-y','-i','sin_subs.mp4','-vf',f"subtitles=piloto.srt:force_style='{est}'",'-c:v','libx264','-crf','26','-pix_fmt','yuv420p','piloto_previa.mp4'],check=True)
print('duración estimada', round(cur,1),'s')
