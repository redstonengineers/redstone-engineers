// materiales.js · texturas, relieve y recursos llamativos (videos-explicativos-claude · Viegas Estudio)
// Se carga después de explica.js. Todo es procedural (filtros SVG): sin imágenes, mismo resultado en cada fotograma.
//
//   X.materiales(svg)  → filtros para poner en cualquier forma: filter="url(#m-madera)"
//       m-madera · m-metal (cepillado) · m-ceramica · m-hormigon · m-organico (piel, tejido, carne) · m-plastico
//       m-papel · m-cristal · m-relieve (solo volumen y brillo, sin textura) · m-tierra · m-tela
//     El color sale del propio relleno (fill): la textura y la luz se suman encima. Luz común desde arriba a la izquierda.
//   X.lupa(padre, { fuente: '#contenido', x, y, r, zoom })      lupa que amplía un detalle REAL de la escena (no un dibujo aparte)
//       .dibuja(t, { x, y, r, zoom, a })   (posición en el mundo; a = aparición 0..1)
//   X.onda(padre, { x, y, color })  .dibuja(t, t0)            onda de impacto / pulso que se expande y se desvanece
//   X.flecha(padre, { d, color, ancho })  .dibuja(t, t0, dur)  flecha curva que se dibuja con su punta
//   X.destello(el)  .dibuja(t, t0)                            banda de luz que cruza un elemento HTML (titular, tarjeta)
//   X.contador(el, { desde, hasta, decimales, sufijo })  .dibuja(t, t0, dur)   número que cuenta con frenada
(function () {
  const X = window.X, NS = 'http://www.w3.org/2000/svg';
  const LUZ = '<feDistantLight azimuth="235" elevation="42"/>';
  const tex = (id, freq, oct, seed, { contraste = 0.55, relieve = 3, brillo = 0.55, exp = 18, desenf = 4, tipo = 'fractalNoise', mezcla = 'overlay' } = {}) => `
    <filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feTurbulence type="${tipo}" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0" result="g"/>
      <feComponentTransfer in="g" result="gc"><feFuncR type="linear" slope="${contraste * 2}" intercept="${0.5 - contraste}"/><feFuncG type="linear" slope="${contraste * 2}" intercept="${0.5 - contraste}"/><feFuncB type="linear" slope="${contraste * 2}" intercept="${0.5 - contraste}"/></feComponentTransfer>
      <feBlend in="SourceGraphic" in2="gc" mode="${mezcla}" result="t"/>
      <feComposite in="t" in2="SourceAlpha" operator="in" result="tex"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="${desenf}" result="b"/>
      <feSpecularLighting in="b" surfaceScale="${relieve}" specularConstant="${brillo}" specularExponent="${exp}" lighting-color="#FFF6EA" result="s">${LUZ}</feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>
      <feDiffuseLighting in="b" surfaceScale="${relieve}" diffuseConstant="1" lighting-color="#FFFFFF" result="d">${LUZ}</feDiffuseLighting>
      <feComposite in="tex" in2="d" operator="arithmetic" k1="0.55" k2="0.55" result="lit"/>
      <feComposite in="lit" in2="s2" operator="arithmetic" k2="1" k3="1" result="fin"/>
      <feComposite in="fin" in2="SourceAlpha" operator="in"/>
    </filter>`;
  X.materiales = (svg) => {
    let d = svg.querySelector('defs'); if (!d) { d = document.createElementNS(NS, 'defs'); svg.insertBefore(d, svg.firstChild); }
    d.insertAdjacentHTML('beforeend', [
      tex('m-madera', '0.0035 0.09', 4, 3, { contraste: 0.6, relieve: 2, brillo: 0.35, exp: 14 }),
      tex('m-metal', '0.002 0.55', 2, 8, { contraste: 0.32, relieve: 2.5, brillo: 1.1, exp: 30, desenf: 3 }),
      tex('m-ceramica', '0.9', 1, 4, { contraste: 0.06, relieve: 5, brillo: 0.9, exp: 34, desenf: 8 }),
      tex('m-hormigon', '0.55', 4, 12, { contraste: 0.42, relieve: 1.5, brillo: 0.15, exp: 8 }),
      tex('m-organico', '0.018', 4, 21, { contraste: 0.3, relieve: 4, brillo: 0.7, exp: 22, desenf: 7 }),
      tex('m-plastico', '0.8', 1, 5, { contraste: 0.04, relieve: 4, brillo: 0.8, exp: 26, desenf: 7 }),
      tex('m-papel', '0.7', 3, 9, { contraste: 0.18, relieve: 1, brillo: 0.08, exp: 6 }),
      tex('m-cristal', '0.01', 2, 2, { contraste: 0.08, relieve: 6, brillo: 1.3, exp: 46, desenf: 10, mezcla: 'screen' }),
      tex('m-relieve', '0.5', 1, 1, { contraste: 0, relieve: 4, brillo: 0.7, exp: 24, desenf: 7 }),
      tex('m-tierra', '0.035', 5, 17, { contraste: 0.55, relieve: 3, brillo: 0.2, exp: 8 }),
      tex('m-tela', '0.35 0.04', 2, 6, { contraste: 0.3, relieve: 1.5, brillo: 0.15, exp: 8, tipo: 'turbulence' }),
      // sombra de contacto (debajo de los objetos) y oclusión ambiental (oscurece los bordes interiores)
      `<radialGradient id="g-contacto"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
       <filter id="m-oclusion" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur in="SourceAlpha" stdDeviation="16" result="b"/><feComposite in="SourceAlpha" in2="b" operator="arithmetic" k2="1" k3="-1" result="borde"/>
         <feFlood flood-color="#000" flood-opacity=".55"/><feComposite in2="borde" operator="in" result="sombra"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sombra"/></feMerge></filter>`,
    ].join('\n'));
  };
  // sombra de contacto: elipse difuminada bajo un objeto
  X.contacto = (padre, x, y, rx, ry = rx * 0.18, op = 1) => { const e = document.createElementNS(NS, 'ellipse');
    Object.entries({ cx: x, cy: y, rx, ry, fill: 'url(#g-contacto)', opacity: op }).forEach(([k, v]) => e.setAttribute(k, v)); padre.insertBefore(e, padre.firstChild); return e; };

  // lupa: un círculo que muestra la escena ampliada (usa <use> del grupo con todo el contenido del mundo)
  let nl = 0;
  X.lupa = (padre, { fuente = '#contenido', r = 170, zoom = 2.4, aro = '#F3EEE6' } = {}) => {
    const id = 'lupa' + ++nl, g = document.createElementNS(NS, 'g');
    g.innerHTML = `<defs><clipPath id="${id}"><circle r="${r}"/></clipPath></defs>
      <circle r="${r + 22}" fill="#000" opacity=".45" style="filter:blur(18px)" transform="translate(0 24)"/>
      <g clip-path="url(#${id})"><rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" fill="#0E0D11"/><g class="dentro"><use href="${fuente}"/></g>
        <circle r="${r}" fill="url(#g-luz)" opacity=".6"/><path d="M${-r * 0.7} ${-r * 0.35} A${r * 0.85} ${r * 0.85} 0 0 1 ${r * 0.2} ${-r * 0.8}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".35"/></g>
      <circle r="${r}" fill="none" stroke="${aro}" stroke-width="12"/><circle r="${r + 7}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3"/>
      <line x1="${r * 0.72}" y1="${r * 0.72}" x2="${r * 1.35}" y2="${r * 1.35}" stroke="${aro}" stroke-width="30" stroke-linecap="round"/>`;
    padre.appendChild(g); const dentro = g.querySelector('.dentro');
    return { el: g, dibuja(t, { x, y, mira = [x, y], z = zoom, a = 1 }) {
      const k = Math.max(0, a), s = 0.6 + 0.4 * k;
      g.setAttribute('transform', `translate(${x} ${y}) scale(${s.toFixed(4)})`); g.setAttribute('opacity', Math.min(1, k * 1.5).toFixed(3));
      dentro.setAttribute('transform', `scale(${z}) translate(${-mira[0]} ${-mira[1]})`);
    } };
  };
  // onda de impacto
  X.onda = (padre, { x, y, color = '#FF8A5B', radio = 220, ancho = 10 } = {}) => {
    const cs = [0, 1, 2].map(() => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('fill', 'none'); c.setAttribute('stroke', color); padre.appendChild(c); return c; });
    return { dibuja(t, t0) { cs.forEach((c, i) => { const u = X.seg(t, t0 + i * 0.12, t0 + i * 0.12 + 0.9), e = X.C.out(u);
      c.setAttribute('r', (radio * e).toFixed(1)); c.setAttribute('stroke-width', (ancho * (1 - u)).toFixed(2)); c.setAttribute('opacity', u <= 0 || u >= 1 ? 0 : (1 - u).toFixed(3)); }); } };
  };
  // flecha curva que se dibuja
  X.flecha = (padre, { d, color = '#FF8A5B', ancho = 9 } = {}) => {
    const g = document.createElementNS(NS, 'g'), p = document.createElementNS(NS, 'path'), h = document.createElementNS(NS, 'path');
    p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', color); p.setAttribute('stroke-width', ancho); p.setAttribute('stroke-linecap', 'round');
    h.setAttribute('d', `M${-ancho * 2.4} ${-ancho * 2} L0 0 L${-ancho * 2.4} ${ancho * 2}`); h.setAttribute('fill', 'none'); h.setAttribute('stroke', color); h.setAttribute('stroke-width', ancho); h.setAttribute('stroke-linecap', 'round'); h.setAttribute('stroke-linejoin', 'round');
    g.appendChild(p); g.appendChild(h); padre.appendChild(g); const L = p.getTotalLength(); p.style.strokeDasharray = L;
    return { el: g, dibuja(t, t0, dur = 0.7, t1 = null) {
      let u = t < t0 ? 0 : X.C.firme((t - t0) / dur); if (t1 != null) u *= 1 - X.C.inOut(X.seg(t, t1, t1 + 0.4));
      const k = X.limita(u); p.style.strokeDashoffset = (L * (1 - k)).toFixed(1);
      const a = p.getPointAtLength(L * k), b = p.getPointAtLength(Math.max(0, L * k - 2)), ang = Math.atan2(a.y - b.y, a.x - b.x) * 57.2958;
      h.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${ang.toFixed(1)})`); g.setAttribute('opacity', k <= 0.01 ? 0 : 1);
    } };
  };
  // destello: banda de luz que cruza un elemento HTML
  X.destello = (el) => {
    const b = document.createElement('div'); b.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);background-size:250% 100%;background-repeat:no-repeat;opacity:0';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; el.style.overflow = 'hidden'; el.appendChild(b);
    return { dibuja(t, t0, dur = 0.8) { const u = X.seg(t, t0, t0 + dur); b.style.opacity = u <= 0 || u >= 1 ? '0' : '1'; b.style.backgroundPosition = `${(120 - 140 * X.C.inOut(u)).toFixed(1)}% 0`; } };
  };
  // contador con frenada natural
  X.contador = (el, { desde = 0, hasta = 100, decimales = 0, sufijo = '', prefijo = '', separador = '.' } = {}) => ({ dibuja(t, t0, dur = 1.2) {
    const dest = el.querySelector('.num') || el;   // si hay un <span class="num">, solo cambia ese (conserva unidades y estilos)
    const u = t < t0 ? 0 : X.C.firme((t - t0) / dur), v = desde + (hasta - desde) * X.limita(u);
    let s = v.toFixed(decimales); const [e, d] = s.split('.'); s = e.replace(/\B(?=(\d{3})+(?!\d))/g, separador) + (d ? ',' + d : '');
    const txt = prefijo + s + sufijo; if (dest.textContent !== txt) dest.textContent = txt; } });
})();
