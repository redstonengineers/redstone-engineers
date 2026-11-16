import json,subprocess,os,importlib.util,sys
sp=importlib.util.spec_from_file_location('p','plan_imagenes.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
G=json.load(open('escenas_base.json'))
dur=620.154830
# tiempos: cada escena empieza en su inicio y acaba al empezar la siguiente
st=[g['s'] for g in G]; st[0]=0.0
en=st[1:]+[dur]
labels={k:v[2] for k,v in m.SC.items()}
# --- rótulos (HTML->PNG transparente)
node=r'''
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire('/home/user/redstone-engineers/videos-explicativos/_kit/package.json'); const { chromium } = require('playwright');
const L=JSON.parse(fs.readFileSync('labels.json','utf8'));
const br = await chromium.launch({ executablePath: process.env.CHROME_PATH }); const pg = await br.newPage({ viewport:{width:1920,height:1080} });
for (const [k,t] of Object.entries(L)){
  const fs_ = t.length>26?62:(t.length>20?72:84);
  await pg.setContent(`<body style="margin:0;background:transparent;width:1920px;height:1080px;position:relative;font-family:Arial,sans-serif"><div style="position:absolute;left:0;right:0;bottom:70px;display:flex;justify-content:center"><div style="background:#fff;border:9px solid #101820;padding:8px 44px;font-weight:900;font-size:${fs_}px;color:#101820;box-shadow:10px 10px 0 #101820;white-space:nowrap">${t}</div></div></body>`);
  await pg.screenshot({path:`ov/${String(k).padStart(2,'0')}.png`,omitBackground:true});
}
await br.close();
'''
json.dump(labels,open('labels.json','w'),ensure_ascii=False)
open('ov.mjs','w').write(node)
if not os.path.exists('ov/83.png'):
    subprocess.run(['node','ov.mjs'],check=True)
# --- clips
jobs=[]
for i,g in enumerate(G):
    sid=g['id']; img,flip,_=m.SC[sid]
    d=round(en[i]-st[i],3)
    out=f'clips/c{sid:02d}.mp4'
    vf=("hflip," if flip else "")+"scale=1920:1080:flags=lanczos"
    cmd=['ffmpeg','-loglevel','error','-y','-loop','1','-t',str(d),'-framerate','30','-i',f'img/{img}.png','-loop','1','-t',str(d),'-framerate','30','-i',f'ov/{sid:02d}.png',
         '-filter_complex',f"[0]{vf}[b];[1]format=rgba,fade=t=in:st=0.2:d=0.25:alpha=1[o];[b][o]overlay=0:0",
         '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-r','30',out]
    jobs.append((out,cmd))
from concurrent.futures import ThreadPoolExecutor
def run(j):
    out,cmd=j
    if os.path.exists(out) and os.path.getsize(out)>10000: return
    subprocess.run(cmd,check=True)
with ThreadPoolExecutor(4) as ex: list(ex.map(run,jobs))
open('clips.txt','w').write(''.join(f"file 'clips/c{g['id']:02d}.mp4'\n" for g in G))
print('clips listos',len(jobs))
