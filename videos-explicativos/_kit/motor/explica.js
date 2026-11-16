// explica.js · motor de los vídeos explicativos (videos-explicativos-claude · Viegas Estudio)
// Cada vídeo es UNA página HTML con un mundo SVG de 1080×1920 que se dibuja para cualquier instante t (window.seek(t)).
// Todo va anclado a las palabras de la voz (timeline.js → window.TIMELINE), nunca a segundos fijos:
//   const t0 = X.en('sifón')          → segundo en que empieza esa palabra (o frase: X.en('tubería del lavabo'))
//   const t1 = X.fin('sube directo')   → segundo en que termina la frase
// Piezas:
//   X.anima(el, t, { entra, dur, sale, durSale, desde:{x,y,s,r,o,blur}, curva })  entrada y salida con curva y desenfoque
//   X.traza(el, t, t0, dur, curva)      un trazo SVG que se dibuja (path, line, polyline, circle, rect)
//   X.camara(el, t, claves)             cámara: [{ t, x, y, z }] → centra (x,y) con zoom z; entre claves curva suave, siempre se mueve un poco
//   X.particulas(padre, op)             partículas deterministas por una ruta (agua, gas, olor, chispas…)
//   X.subtitulos(t)                     subtítulos palabra a palabra con la palabra clave resaltada
//   X.sonido(t, tipo)                   apunta un efecto (whoosh, pop, click…) para la mezcla
//   X.listo(montar)                     espera fuentes, monta y avisa al render
(function () {
  const F = window.FORMATO || { w: 1080, h: 1920 }, W = F.w, H = F.h;
  const X = (window.X = { W, H, avisos: [], eventos: [] });
  { const st = document.createElement('style'), h = W > H;
    st.textContent = `html,body,#lienzo,#mundo-svg{width:${W}px;height:${H}px}` + (h ? `
      .rejilla{-webkit-mask-image:radial-gradient(1100px 600px at 50% 45%,#000 30%,transparent 80%)}
      .titular{left:120px;right:120px;font-size:84px}
      #subs{left:160px;right:160px}.subs{font-size:58px}
      .eti{font-size:34px}.progreso{height:6px}` : '');
    document.head.appendChild(st); }
  const TL = (X.TL = window.TIMELINE || { palabras: [], dur: 10 });
  X.dur = (TL.dur || 10) + 0.8;

  // ---------- tiempo y curvas ----------
  X.limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  X.seg = (t, a, b) => X.limita((t - a) / (b - a || 1e-6));
  X.lerp = (a, b, u) => a + (b - a) * u;
  function bez(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const fx = (u) => ((ax * u + bx) * u + cx) * u, fy = (u) => ((ay * u + by) * u + cy) * u, dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
    return (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let u = x; for (let i = 0; i < 8; i++) { const d = dx(u); if (Math.abs(d) < 1e-6) break; u -= (fx(u) - x) / d; } return fy(X.limita(u)); };
  }
  X.C = {
    out: bez(0.16, 1, 0.3, 1),          // entrada rápida con frenada suave (la curva de la marca)
    in: bez(0.7, 0, 0.84, 0),           // salida: arranca suave y se va rápido
    inOut: bez(0.65, 0, 0.35, 1),       // cámara y desplazamientos
    suave: bez(0.33, 0, 0.2, 1),
    muelle: (u) => (u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(9.5 * u)),   // un rebote natural (úsalo poco)
    lineal: (u) => u,
  };
  // muelle amortiguado (respuesta real de un resorte): zeta < 1 pasa un poco y vuelve. Llega a su sitio en u = 1
  X.resorte = (zeta = 0.7) => { const w = 4.8 / zeta, wd = w * Math.sqrt(1 - zeta * zeta);
    return (u) => (u <= 0 ? 0 : u >= 1.6 ? 1 : 1 - Math.exp(-zeta * w * u) * (Math.cos(wd * u) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * u))); };
  X.C.natural = X.resorte(0.74);   // por defecto: llega, se pasa un 2-3 % y se asienta (como un objeto con peso)
  X.C.blando = X.resorte(0.55);    // más vivo: para iconos, etiquetas, cosas ligeras
  X.C.firme = X.resorte(0.9);      // casi sin rebote: tarjetas grandes, texto
  // ruido suave determinista (1D): para el pulso de cámara en mano, humo, temblores
  const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  X.ruido = (t, semilla = 0) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return X.lerp(hash(i + semilla * 57.3), hash(i + 1 + semilla * 57.3), u) * 2 - 1; };
  X.ruidoF = (t, s = 0) => 0.6 * X.ruido(t, s) + 0.3 * X.ruido(t * 2.1, s + 3) + 0.1 * X.ruido(t * 4.3, s + 7);
  const curva = (c) => (typeof c === 'function' ? c : X.C[c] || X.C.natural);

  // ---------- anclas a la voz ----------
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]/g, '');
  const P = TL.palabras.map((p) => ({ ...p, k: norm(p.w) }));
  function busca(frase, n, desde) {
    const ks = String(frase).split(/\s+/).map(norm).filter(Boolean); let c = 0;
    for (let i = 0; i < P.length; i++) {
      if (P[i].s < desde - 1e-3) continue;
      let ok = true;
      for (let j = 0; j < ks.length; j++) { const p = P[i + j]; if (!p || !(p.k === ks[j] || (ks[j].length >= 4 && p.k.startsWith(ks[j])))) { ok = false; break; } }
      if (ok && ++c === n) return [i, i + ks.length - 1];
    }
    return null;
  }
  X.dudas = [];
  const duda = (frase, n, desde) => { if (n === 1 && busca(frase, 2, desde)) X.dudas.push(`«${frase}» sale más de una vez: usa X.en('${frase}', 2) si querías la segunda`); };
  X.en = (frase, n = 1, desde = 0) => { duda(frase, n, desde); const r = busca(frase, n, desde); if (!r) { X.avisos.push(`No encuentro «${frase}» en la voz`); return null; } return P[r[0]].s; };
  X.fin = (frase, n = 1, desde = 0) => { const r = busca(frase, n, desde); if (!r) { X.avisos.push(`No encuentro «${frase}» en la voz`); return null; } return P[r[1]].e; };
  // ancla obligatoria: si falta la palabra, el render se para con el aviso (nunca se cae un gráfico en silencio)
  X.debe = (v, que) => { if (v == null) throw new Error(`Falta el ancla de «${que}»`); return v; };

  // ---------- piezas ----------
  const tf = (el, x, y, s, r) => `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`;
  const prep = (el) => { if (el.__prep) return; el.__prep = 1;
    // el transform que ya tenga (CSS translateX(-50%), atributo transform de SVG…) se conserva y la animación va encima
    const cs = getComputedStyle(el).transform; el.__base = cs && cs !== 'none' ? cs : '';
    if (el instanceof SVGElement) { if (!el.__base && el.getAttribute('transform')) el.__base = ''; el.style.transformBox = 'fill-box'; el.style.transformOrigin = el.dataset.origen || 'center'; } };
  // entrada (y salida opcional) de un elemento. Sin «entra», está siempre. desde = cómo empieza (se va igual, invertido)
  X.anima = (el, t, o) => {
    prep(el);
    const d = Object.assign({ x: 0, y: 40, s: 1, r: 0, o: 0, blur: 14 }, o.desde || {});
    const dur = o.dur ?? 0.6, durS = o.durSale ?? 0.4;
    let u = 1;
    if (o.entra != null) u = curva(o.curva || 'natural')((t - o.entra) / dur);
    if (o.entra != null && t < o.entra) u = 0;
    if (o.entra != null && o.entra <= 0) u = 1;   // entra: 0 = ya está en el primer fotograma (el gancho se ve desde el fotograma 0)
    let v = 0;
    if (o.sale != null) v = curva(o.curvaSale || 'in')(X.seg(t, o.sale, o.sale + durS));
    const k = Math.min(u, 1 - v); // 1 = en su sitio
    const vis = o.entra == null || t >= o.entra;
    const x = d.x * (1 - k), y = d.y * (1 - k) * (v > 0 ? -1 : 1), s = X.lerp(d.s, 1, k), r = d.r * (1 - k);
    const ko = X.limita(k * 1.6), op = vis ? X.lerp(d.o, 1, ko) : 0, b = d.blur * Math.max(0, 1 - X.limita(k));
    el.style.opacity = op >= 0.999 ? '' : op.toFixed(3);
    el.style.transform = Math.abs(k - 1) < 1e-4 && !o.mueve ? '' : ((el.__base ? el.__base + ' ' : '') + tf(el, x + (o.mueve?.x || 0), y + (o.mueve?.y || 0), s, r));
    el.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : '';
    return k;
  };
  // trazo que se dibuja (y opcionalmente se borra)
  X.traza = (el, t, t0, dur = 0.8, c = 'inOut', t1 = null) => {
    if (!el.__L) { el.__L = el.getTotalLength ? el.getTotalLength() : 1000; el.style.strokeDasharray = el.__L; }
    let u = t0 == null ? 1 : curva(c)(X.seg(t, t0, t0 + dur));
    if (t1 != null) u *= 1 - X.C.inOut(X.seg(t, t1, t1 + 0.5));
    el.style.strokeDashoffset = (el.__L * (1 - u)).toFixed(2);
    el.style.opacity = u <= 0.001 ? '0' : '';
    return u;
  };
  // cámara con peso: las claves marcan a dónde mira; un muelle casi crítico la lleva con inercia (arranca suave, se pasa
  // un pelo y se asienta) y un pulso de «cámara en mano» la mantiene viva. claves: [{ t, x, y, z, r?, dur? }]
  // dur = cuánto tarda en llegar (por defecto 1,1 s); la cámara empieza a moverse antes de la clave (anticipa).
  const camCache = new WeakMap();
  X.camara = (el, t, claves, { mano = 1 } = {}) => {
    let tab = camCache.get(claves);
    if (!tab) {
      const dt = 1 / 240, N = Math.ceil((X.dur + 1) / dt), pos = new Float64Array(N * 6);
      const obj = (tt) => { let b = claves[0]; for (let i = 0; i < claves.length; i++) if (tt >= claves[i].t - (claves[i].dur ?? 1.1) * 0.55) b = claves[i]; return b; };
      const c = claves[0], p = [c.x, c.y, Math.log(c.z), c.r || 0, c.rx || 0, c.ry || 0], v = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < N; i++) {
        const k = obj(i * dt), d = k.dur ?? 1.1, w = 7.2 / d, z = 0.86;
        const g = [k.x, k.y, Math.log(k.z), k.r || 0, k.rx || 0, k.ry || 0];
        for (let j = 0; j < 6; j++) { const acc = w * w * (g[j] - p[j]) - 2 * z * w * v[j]; v[j] += acc * dt; p[j] += v[j] * dt; pos[i * 6 + j] = p[j]; }
      }
      tab = { dt, N, pos }; camCache.set(claves, tab);
    }
    const i = Math.min(tab.N - 2, Math.max(0, Math.floor(t / tab.dt))), f = t / tab.dt - i, q = (j) => X.lerp(tab.pos[i * 6 + j], tab.pos[(i + 1) * 6 + j], f);
    const x = q(0) + 7 * mano * X.ruidoF(t * 0.45, 1), y = q(1) + 6 * mano * X.ruidoF(t * 0.4, 2);
    const z = Math.exp(q(2)) * (1 + 0.006 * mano * X.ruidoF(t * 0.3, 3)), r = q(3) + 0.25 * mano * X.ruidoF(t * 0.35, 4);
    el.setAttribute('transform', `translate(${W / 2},${H / 2}) rotate(${r.toFixed(3)}) scale(${z.toFixed(5)}) translate(${(-x).toFixed(2)},${(-y).toFixed(2)})`);
    // inclinación 3D: el mundo entero gira en perspectiva (claves con rx / ry en grados)
    const rx = q(4) + 0.4 * mano * X.ruidoF(t * 0.3, 6), ry = q(5) + 0.5 * mano * X.ruidoF(t * 0.33, 7), svg = el.ownerSVGElement;
    if (svg) { svg.style.transformOrigin = '50% 50%'; svg.style.transform = Math.abs(rx) + Math.abs(ry) < 0.01 ? '' : `perspective(1700px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(1.14)`; }
    X.__cam = { x, y, z, rx, ry };
    return { x, y, z };
  };
  // profundidad de campo: el fondo se desenfoca más cuanto más cerca está la cámara (zoom alto = poca profundidad de campo)
  X.desenfoqueFondo = (el, { base = 0, porZoom = 9, max = 16 } = {}) => {
    const z = (X.__cam || { z: 1 }).z, b = Math.min(max, base + Math.max(0, z - 0.9) * porZoom);
    el.style.filter = b > 0.3 ? `blur(${b.toFixed(2)}px)` : '';
  };
  // primer plano: objetos muy cerca de la cámara (muy desenfocados) que pasan por delante al moverse.
  // tipo: 'bokeh' (discos de luz) · 'polvo' · o una función (g, i, r) que dibuja la pieza en el grupo g (p. ej. un tubo, una hoja)
  X.primerPlano = (cont, { n = 7, tipo = 'bokeh', color = '#FFE3C4', semilla = 31, prof = [1.6, 2.6], blur = [16, 34], op = [0.18, 0.4], zona = 2600 } = {}) => {
    const NS = 'http://www.w3.org/2000/svg', r = X.azar(semilla);
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.cssText = `position:absolute;inset:0;width:${W}px;height:${H}px;z-index:40;pointer-events:none;overflow:visible`; cont.appendChild(svg);
    const ps = Array.from({ length: n }, (_, i) => {
      const g = document.createElementNS(NS, 'g'), d = X.lerp(prof[0], prof[1], r());
      if (typeof tipo === 'function') tipo(g, i, r);
      else { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', tipo === 'polvo' ? 8 + r() * 14 : 60 + r() * 130); c.setAttribute('fill', color); g.appendChild(c); }
      g.style.filter = `blur(${X.lerp(blur[0], blur[1], r()).toFixed(1)}px)`; g.setAttribute('opacity', X.lerp(op[0], op[1], r()).toFixed(2)); svg.appendChild(g);
      return { g, d, x: r() * zona - zona / 2 + W / 2, y: r() * zona - zona / 2 + H / 2, s: r() * 50 };
    });
    return (t) => {
      const c = X.__cam || { x: W / 2, y: H / 2, z: 1 };
      ps.forEach((p) => {
        // cuanto más cerca (d grande), más rápido cruza la pantalla; se recoloca al salir para que siempre haya alguno
        let sx = W / 2 + (p.x - c.x) * c.z * p.d + 14 * X.ruidoF(t * 0.4 + p.s, 1), sy = H / 2 + (p.y - c.y) * c.z * p.d + 10 * X.ruidoF(t * 0.35 + p.s, 2);
        const MW = W + 1200, MH = H + 1200; sx = ((sx + 600) % MW + MW) % MW - 600; sy = ((sy + 600) % MH + MH) % MH - 600;   // ventana de pantalla + margen: siempre vuelven a pasar
        p.g.setAttribute('transform', `translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${(c.z * p.d * 0.6).toFixed(3)})`);
      });
    };
  };
  // capas con profundidad: se mueven más o menos que la cámara (parallax) y se desenfocan si están lejos o muy cerca
  X.profundidad = (el, prof = 0.5, desenfoque = 0) => {
    const c = X.__cam || { x: W / 2, y: H / 2, z: 1 };
    el.setAttribute('transform', `translate(${((c.x - W / 2) * (1 - prof)).toFixed(1)},${((c.y - H / 2) * (1 - prof)).toFixed(1)})`);
    if (desenfoque) el.style.filter = `blur(${desenfoque}px)`;
  };
  // humo, vapor, olor, gas: bocanadas blandas que nacen en la ruta, crecen, se deforman y se desvanecen
  X.humo = (padre, { ruta, n = 18, vida = 2.4, tam = [26, 70], color = '#8BD96B', op = 0.55, semilla = 5, viento = [0, -20] }) => {
    const r = X.azar(semilla), NS = 'http://www.w3.org/2000/svg', id = 'hu' + semilla + Math.floor(r() * 1e6);
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="1"/><stop offset=".55" stop-color="${color}" stop-opacity=".5"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
    padre.appendChild(defs);
    const ps = Array.from({ length: n }, (_, i) => { const c = document.createElementNS(NS, 'ellipse'); c.setAttribute('fill', `url(#${id})`); padre.appendChild(c);
      return { c, f: i / n + (r() * 0.3) / n, a: X.lerp(tam[0], tam[1], r()), s: r() * 100 }; });
    return { dibuja(t, t0, t1, { hasta = 1 } = {}) {
      const A = X.C.suave(X.seg(t, t0, t0 + 0.8)) * (t1 == null ? 1 : 1 - X.C.suave(X.seg(t, t1, t1 + 0.9)));
      ps.forEach((p) => {
        if (A <= 0.001 || t < t0) { p.c.setAttribute('opacity', 0); return; }
        const edad = ((((t - t0) / vida + p.f) % 1) + 1) % 1, [x, y] = ruta(edad * hasta);
        const tx = x + 26 * X.ruidoF(t * 0.8 + p.s, 1) + viento[0] * edad, ty = y + 18 * X.ruidoF(t * 0.7 + p.s, 2) + viento[1] * edad;
        const rad = p.a * (0.45 + 0.9 * edad), o = A * op * Math.sin(Math.PI * Math.min(1, edad * 1.15));
        p.c.setAttribute('cx', tx.toFixed(1)); p.c.setAttribute('cy', ty.toFixed(1));
        p.c.setAttribute('rx', (rad * (1 + 0.25 * X.ruido(t + p.s, 5))).toFixed(1)); p.c.setAttribute('ry', (rad * 0.82).toFixed(1));
        p.c.setAttribute('opacity', Math.max(0, o).toFixed(3));
      });
    } };
  };
  // superficie de agua con olas: path cerrado desde la superficie hasta «fondo» (úsalo con un clipPath del recipiente)
  X.ola = (x0, x1, nivel, fondo, t, { amp = 6, largo = 90, vel = 1.6, pasos = 28 } = {}) => {
    let d = '';
    for (let i = 0; i <= pasos; i++) {
      const x = X.lerp(x0, x1, i / pasos), y = nivel + amp * Math.sin((x / largo) * 6.283 + t * vel) + amp * 0.5 * Math.sin((x / (largo * 0.47)) * 6.283 - t * vel * 1.7);
      d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d + ` L${x1} ${fondo} L${x0} ${fondo} Z`;
  };
  // degradados y filtros comunes para dar volumen y luz: X.defs(svg) una vez al montar
  X.defs = (svg) => {
    const NS = 'http://www.w3.org/2000/svg', d = document.createElementNS(NS, 'defs');
    d.innerHTML = `
      <linearGradient id="g-ceramica" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#E9E4DC"/><stop offset="1" stop-color="#B9B1A6"/></linearGradient>
      <linearGradient id="g-ceramica-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9A196"/><stop offset=".55" stop-color="#D8D2C8"/><stop offset="1" stop-color="#F1EDE7"/></linearGradient>
      <linearGradient id="g-cromo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7D8490"/><stop offset=".35" stop-color="#F6F8FB"/><stop offset=".55" stop-color="#B7BDC7"/><stop offset="1" stop-color="#5E646F"/></linearGradient>
      <linearGradient id="g-agua" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD3FF"/><stop offset=".35" stop-color="#3E9BF0"/><stop offset="1" stop-color="#14549E"/></linearGradient>
      <linearGradient id="g-madera" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A3B33"/><stop offset="1" stop-color="#2A211D"/></linearGradient>
      <radialGradient id="g-luz" cx=".5" cy=".25" r=".75"><stop offset="0" stop-color="#FFF1DC" stop-opacity=".28"/><stop offset="1" stop-color="#FFF1DC" stop-opacity="0"/></radialGradient>
      <filter id="f-sombra" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="16"/><feOffset dy="18"/><feComponentTransfer><feFuncA type="linear" slope=".5"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="f-sombra-s" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="6"/><feOffset dy="6"/><feComponentTransfer><feFuncA type="linear" slope=".45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="f-brillo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="f-blando" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>`;
    svg.insertBefore(d, svg.firstChild);
  };
  // grano de película y viñeta (encima de todo): textura que quita el aspecto de «vector plano»
  X.grano = (cont, fuerza = 0.08) => {
    const tiles = Array.from({ length: 4 }, (_, k) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256), r = X.azar(k + 11);
      for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255 * fuerza; }
      g.putImageData(im, 0, 0); return c.toDataURL(); });
    const v = document.createElement('div'); v.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:49;background:radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,.55) 100%)'; cont.appendChild(v);
    const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;z-index:50'; cont.appendChild(d);
    return (t) => { const u = `url(${tiles[Math.floor(t * 24) % 4]})`; if (d.style.backgroundImage !== u) d.style.backgroundImage = u; };
  };
  // números al azar con semilla (nunca Math.random: el render pide fotogramas en cualquier orden)
  X.azar = (semilla = 1) => { let s = semilla >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  // partículas por una ruta: ruta(u) → [x, y] con u de 0 a 1. Aparecen entre t0 y t1 (con fundido) y recorren la ruta en «vuelta» s
  X.particulas = (padre, { n = 20, ruta, vuelta = 2.5, tam = [8, 18], color = '#7BD88F', op = 0.8, semilla = 3, jitter = 18, clase = '' }) => {
    const r = X.azar(semilla), NS = 'http://www.w3.org/2000/svg';
    const ps = Array.from({ length: n }, () => {
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', X.lerp(tam[0], tam[1], r())); c.setAttribute('fill', color); if (clase) c.setAttribute('class', clase);
      padre.appendChild(c); return { c, f: r(), jx: (r() - 0.5) * 2 * jitter, jy: (r() - 0.5) * 2 * jitter, w: 0.6 + r() * 0.8 };
    });
    return { dibuja(t, t0, t1, { hasta = 1 } = {}) {
      const a = X.C.suave(X.seg(t, t0, t0 + 0.6)) * (t1 == null ? 1 : 1 - X.C.suave(X.seg(t, t1, t1 + 0.6)));
      ps.forEach((p) => {
        const u = ((t - t0) / vuelta * p.w + p.f) % 1;
        const uu = u * hasta, [x, y] = ruta(uu);
        const wob = Math.sin(t * 3 + p.f * 20);
        p.c.setAttribute('cx', (x + p.jx + wob * 5).toFixed(1)); p.c.setAttribute('cy', (y + p.jy).toFixed(1));
        const fade = Math.min(1, u * 6, (1 - u) * 4);
        p.c.setAttribute('opacity', t < t0 ? 0 : (a * op * fade).toFixed(3));
      });
    } };
  };

  // ---------- subtítulos palabra a palabra ----------
  // trozos de hasta «max» palabras; se corta en puntuación o en pausas de más de 0,35 s. La palabra clave (CLAVES) va en acento.
  X.subtitulos = (cont, { max = 3, claves = [], y = 1430 } = {}) => {
    const K = new Set(claves.map(norm));
    const trozos = []; let cur = [];
    P.forEach((p, i) => {
      cur.push(p);
      const sig = P[i + 1], fin = /[.,;:!?…]$/.test(p.w) || !sig || sig.s - p.e > 0.35 || cur.length >= max;
      if (fin) { trozos.push(cur); cur = []; }
    });
    cont.style.top = y + 'px';
    const caja = document.createElement('div'); caja.className = 'subs'; cont.appendChild(caja);
    let ult = -1;
    return { dibuja(t) {
      let i = trozos.findIndex((tr, j) => t >= tr[0].s - 0.05 && t < (trozos[j + 1] ? trozos[j + 1][0].s - 0.05 : tr[tr.length - 1].e + 0.6));
      if (i !== ult) {
        ult = i; caja.innerHTML = '';
        if (i >= 0) trozos[i].forEach((p) => { const s = document.createElement('span'); s.textContent = p.w.replace(/[.,;:…]$/, ''); s.dataset.s = p.s; if (K.has(p.k)) s.className = 'clave'; caja.appendChild(s); caja.appendChild(document.createTextNode(' ')); });
      }
      caja.querySelectorAll('span').forEach((s) => {
        const u = t < +s.dataset.s - 0.05 ? 0 : X.C.blando((t - (+s.dataset.s - 0.05)) / 0.32);
        s.style.opacity = X.limita(u * 1.8).toFixed(3); s.style.transform = Math.abs(u - 1) < 1e-3 ? '' : `translateY(${(22 * (1 - u)).toFixed(1)}px) scale(${(0.86 + 0.14 * u).toFixed(3)})`;
      });
    } };
  };

  // ---------- sonido ----------
  // tipos: whoosh · swoosh · pop · click · notificacion · teclado · feedback · dinero (carpetas de musica/sfx)
  X.sonido = (t, tipo = 'whoosh', ganancia = 1) => { if (t != null) X.eventos.push({ t: +t.toFixed(3), tipo, ganancia }); };

  // ---------- montaje ----------
  X.listo = async (montar) => {
    try { await document.fonts.ready; } catch {}
    await new Promise((r) => setTimeout(r, 300));
    const dibuja = await montar();
    window.seek = (t) => { dibuja(t); return true; };
    window.__dur = X.dur; window.__eventos = X.eventos; window.__avisos = X.avisos; window.__dudas = X.dudas;
    window.seek(0);
    if (X.avisos.length) console.warn('[explica] ' + X.avisos.join(' · '));
    // vista previa en el navegador: ?ver reproduce en bucle con la voz
    if (location.search.includes('ver')) {
      const au = new Audio('voz/voz.wav'); const t0 = performance.now(); au.play().catch(() => {});
      const loop = () => { const t = (performance.now() - t0) / 1000 % X.dur; window.seek(t); requestAnimationFrame(loop); }; loop();
    }
    window.__listo = true;
  };
})();
