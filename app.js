(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('year').textContent = new Date().getFullYear();

  // Aparición suave de secciones
  const els = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(e => e.classList.add('in'));
  } else {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .15 });
    els.forEach(e => io.observe(e));
  }

  // Momento único: el cúmulo 3D del hero sigue al puntero
  const stage = document.querySelector('.stage');
  const scene = document.querySelector('.scene');
  if (!stage || !scene || reduce) return;
  let rx = -22, ry = 32, tx = rx, ty = ry, raf = 0;
  const tick = () => {
    rx += (tx - rx) * .08; ry += (ty - ry) * .08;
    scene.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    raf = (Math.abs(tx - rx) + Math.abs(ty - ry) > .05) ? requestAnimationFrame(tick) : 0;
  };
  window.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    ty = 32 + ((e.clientX - r.left) / r.width - .5) * 90;
    tx = -22 - ((e.clientY - r.top) / r.height - .5) * 60;
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
})();
