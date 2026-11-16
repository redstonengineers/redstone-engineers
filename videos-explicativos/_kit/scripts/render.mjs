// render.mjs · videos-explicativos-claude
// Fotografía escena.html fotograma a fotograma (window.seek) con Chrome sin ventana, mezcla la voz, la música y los
// efectos (mezcla.py) y deja el MP4 vertical. Se ejecuta con la carpeta del proyecto como argumento.
//
//   node render.mjs <proyecto> video [--calidad previa|final] [--hilos 4]
//        previa = 540×960 a 30 fps (rápida, para revisar) · final = 1080×1920 a 60 fps
//   node render.mjs <proyecto> frame <segundos> <salida.png>
//   node render.mjs <proyecto> hoja [n=12]        → resultados/hoja.jpg con n fotogramas repartidos y su segundo
//   node render.mjs <proyecto> gancho              → resultados/gancho.jpg con los fotogramas de 0 · 0,5 · 1 · 2 · 3 s
//   node render.mjs <proyecto> comprobar          → anclas que faltan, duración, eventos de sonido
// Se para (código 3) si falta alguna palabra ancla: nunca se renderiza un vídeo con un gráfico perdido.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PROY = path.resolve(args[0] || '.');
const MODO = args[1] || 'video';
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const CAL = opt('calidad', 'previa'), HILOS = +opt('hilos', Math.max(2, Math.min(6, os.cpus().length >> 1)));
// formato: se lee de escena.html (window.FORMATO = { w: 1920, h: 1080 }); sin él, vertical 1080×1920
let FW = 1080, FH = 1920;
try { const m = fs.readFileSync(path.join(PROY, 'escena.html'), 'utf8').match(/FORMATO\s*=\s*\{\s*w:\s*(\d+)\s*,\s*h:\s*(\d+)/); if (m) { FW = +m[1]; FH = +m[2]; } } catch {}
const HORIZ = FW > FH, TW = HORIZ ? 400 : 270, TH = Math.round(TW * FH / FW);   // miniaturas de las hojas
const ESC = CAL === 'final' ? 1 : 0.5, FPS = +opt('fps', CAL === 'final' ? (HORIZ ? 30 : 60) : 30);
// desenfoque de movimiento real: N subfotogramas por fotograma (obturador de 180°) promediados. final = 4, previa = 1
const MB = Math.max(1, +opt('mb', CAL === 'final' ? 3 : 1));

let chromium;
for (const b of [PROY, path.dirname(PROY), path.join(os.homedir(), 'Documents', 'Videos explicativos'), path.join(os.homedir(), 'Documentos', 'Videos explicativos'),
  path.join(os.homedir(), 'Documents', 'Motion Graphics'), SKILL]) {
  try { ({ chromium } = createRequire(path.join(b, 'package.json'))('playwright')); break; } catch {}
}
if (!chromium) { console.error('Falta Playwright. Ejecuta: python <skill>/scripts/preparar.py --instalar'); process.exit(1); }
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find((p) => fs.existsSync(p));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
// sirve el proyecto; /motor/ sale de la skill si el proyecto no tiene su copia
const servidor = () => new Promise((ok) => {
  const s = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    let p = path.join(PROY, u);
    if (!fs.existsSync(p) && u.startsWith('/motor/')) p = path.join(SKILL, u);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
  s.listen(0, () => ok(s));
});

async function abrir(br, port) {
  const pg = await br.newPage({ viewport: { width: FW, height: FH }, deviceScaleFactor: ESC });
  const errores = []; pg.on('pageerror', (e) => errores.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await pg.goto(`http://127.0.0.1:${port}/escena.html`);
  await pg.waitForFunction(() => window.__listo || window.__error, null, { timeout: 60000 }).catch(() => {});
  const info = await pg.evaluate(() => ({ dur: window.__dur, eventos: window.__eventos || [], avisos: window.__avisos || [], dudas: window.__dudas || [], listo: !!window.__listo }));
  if (!info.listo) { console.error('La escena no arrancó:\n  ' + errores.join('\n  ')); process.exit(2); }
  return { pg, info, errores };
}

const codec = () => (spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=256x256:d=0.1', '-c:v', 'h264_nvenc', '-f', 'null', '-']).status === 0
  ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '18', '-b:v', '0'] : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17']);

async function trozo(br, port, f0, f1, salida, cv) {
  const { pg } = await abrir(br, port);
  const vf = MB > 1 ? ['-vf', `tmix=frames=${MB},select='eq(mod(n,${MB}),${MB - 1})',setpts=N/(${FPS}*TB)`, '-fps_mode', 'passthrough'] : ['-r', String(FPS)];
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * MB), '-i', '-', ...vf, ...cv, '-pix_fmt', 'yuv420p', salida]);
  for (let i = f0; i < f1; i++) {
    for (let k = 0; k < MB; k++) {
      const t = i / FPS + (MB > 1 ? ((k - (MB - 1)) / MB) * (0.5 / FPS) : 0);   // los subfotogramas acaban en el instante del fotograma
      await pg.evaluate((x) => window.seek(Math.max(0, x)), t);
      const b = await pg.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once('drain', r));
    }
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await pg.close();
}

(async () => {
  const srv = await servidor(), port = srv.address().port;
  const br = await chromium.launch({ executablePath: chrome, args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const out = path.join(PROY, 'resultados'); fs.mkdirSync(out, { recursive: true });
  const { pg, info } = await abrir(br, port);
  if (info.avisos.length) { console.error('✗ ' + info.avisos.join('\n✗ ')); if (MODO !== 'frame') { await br.close(); srv.close(); process.exit(3); } }
  if (info.dudas.length) console.log('⚠ ' + [...new Set(info.dudas)].join(' | '));
  if (MODO === 'comprobar') { console.log(`✓ ${info.dur.toFixed(2)} s · ${info.eventos.length} sonidos · 0 anclas perdidas`); }
  else if (MODO === 'frame') { await pg.evaluate((t) => window.seek(t), +args[2]); await pg.screenshot({ path: args[3] }); console.log('✓ ' + args[3]); }
  else if (MODO === 'hoja') {
    const n = +(args[2] || 12), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoja-'));
    for (let i = 0; i < n; i++) { const t = (info.dur * (i + 0.5)) / n; await pg.evaluate((x) => window.seek(x), t); await pg.screenshot({ path: path.join(dir, `${String(i).padStart(2, '0')}.png`) });
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, `${String(i).padStart(2, '0')}.png`), '-vf', `scale=${TW}:${TH},drawtext=text='${t.toFixed(1)} s':x=10:y=10:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6`, path.join(dir, `m${String(i).padStart(2, '0')}.png`)]); }
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'm%02d.png'), '-vf', `tile=${Math.min(HORIZ ? 4 : 6, n)}x${Math.ceil(n / (HORIZ ? 4 : 6))}`, '-frames:v', '1', path.join(out, 'hoja.jpg')]);
    console.log('✓ resultados/hoja.jpg');
  } else if (MODO === 'gancho') {
    const ts = [0, 0.5, 1, 2, 3].filter((t) => t < info.dur), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gancho-'));
    for (let i = 0; i < ts.length; i++) { await pg.evaluate((x) => window.seek(x), ts[i]); const f = path.join(dir, `${i}.png`); await pg.screenshot({ path: f });
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-vf', `scale=${HORIZ ? 640 : 432}:${HORIZ ? 360 : 768},drawtext=text='${ts[i].toFixed(1)} s':x=12:y=12:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.6`, path.join(dir, `m${i}.png`)]); }
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'm%d.png'), '-vf', `tile=${ts.length}x1`, '-frames:v', '1', path.join(out, 'gancho.jpg')]);
    console.log('✓ resultados/gancho.jpg · revísalo con la lista de referencias/ganchos.md antes del render final');
  } else {
    await pg.close();
    const total = Math.round(info.dur * FPS), cv = codec(), t0 = Date.now();
    // render REANUDABLE: tramos de ~15 s guardados en resultados/partes-<calidad>; si el proceso muere, al relanzar se saltan los ya hechos
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-')), pdir = path.join(out, 'partes-' + CAL + '-' + FPS + 'fps-' + MB); fs.mkdirSync(pdir, { recursive: true });
    const tam = FPS * 15, n = Math.ceil(total / tam), partes = Array.from({ length: n }, (_, k) => path.join(pdir, `parte-${String(k).padStart(3, '0')}.mp4`));
    const hechas = partes.filter((p) => fs.existsSync(p)).length;
    console.log(`→ ${total} fotogramas · ${FPS} fps · ${Math.round(FW * ESC)}×${Math.round(FH * ESC)} · ${HILOS} hilos · desenfoque ×${MB} · ${n} tramos (${hechas} ya hechos)`);
    let sig = 0, listos = hechas;
    await Promise.all(Array.from({ length: Math.max(1, Math.min(HILOS, n)) }, async () => {
      for (;;) { const k = sig++; if (k >= n) return; if (fs.existsSync(partes[k])) continue;
        const tmp = partes[k].replace('.mp4', '.tmp.mp4'); await trozo(br, port, k * tam, Math.min(total, (k + 1) * tam), tmp, cv); fs.renameSync(tmp, partes[k]);
        console.log(`  tramo ${++listos}/${n}`); } }));
    fs.writeFileSync(path.join(dir, 'lista.txt'), partes.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
    const muda = path.join(dir, 'muda.mp4');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'lista.txt'), '-c', 'copy', muda]);
    // audio: voz + música + efectos, a −14 LUFS
    fs.writeFileSync(path.join(PROY, 'voz', 'eventos.json'), JSON.stringify({ dur: info.dur, eventos: info.eventos }, null, 1));
    const py = process.platform === 'win32' ? 'python' : 'python3';
    const mz = spawnSync(py, [path.join(SKILL, 'scripts', 'mezcla.py'), PROY], { stdio: 'inherit' });
    if (mz.status !== 0) { console.error('✗ falló la mezcla'); process.exit(4); }
    const final = path.join(out, CAL === 'final' ? 'video-final.mp4' : 'video-previa.mp4');
    // 04-11: los trozos unidos dejaban tiempos irregulares (el vídeo salía unas décimas más corto y la voz se desfasaba al final):
    // se reencuadra cada fotograma a FPS exactos y el audio se alarga con silencio para que mande el vídeo
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', muda, '-i', path.join(PROY, 'voz', 'mezcla.wav'), '-map', '0:v', '-map', '1:a', '-vf', `setpts=N/(${FPS}*TB)`,
      '-fps_mode', 'cfr', '-r', String(FPS), ...cv, '-pix_fmt', 'yuv420p', '-af', 'apad', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final]);
    const nf = parseInt(spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', final], { encoding: 'utf8' }).stdout, 10);
    if (Math.abs(nf - total) > 1) { console.error(`✗ el vídeo tiene ${nf} fotogramas y debían ser ${total}`); fs.renameSync(final, final.replace('.mp4', '.INCOMPLETO.mp4')); process.exit(5); }
    console.log(`✓ ${path.relative(PROY, final)} · ${info.dur.toFixed(1)} s · ${nf} fotogramas · ${((Date.now() - t0) / 1000).toFixed(0)} s de render`);
  }
  await br.close(); srv.close();
})();
