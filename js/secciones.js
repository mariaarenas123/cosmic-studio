/* ==========================================================================
   Cosmic Studio · Secciones
   1. Menú superior (se oculta mientras se ven los planetas)
   2. Carrusel lateral infinito de la sección 1 (1.1 → 1.2 → 1.3 → 1.1…)
   3. Demostración del chatbot: cambia entre página web y WhatsApp cada 30 s
   ========================================================================== */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. MENÚ SUPERIOR ---------- */
  const barra = document.querySelector('.barra');
  const viaje = document.getElementById('inicio');
  const escena = document.getElementById('escena');
  const enlacesMenu = Array.from(document.querySelectorAll('.menu__enlace'));

  // Tramos de la apertura (iguales a escena.js): título hasta 7 %, planetas desde ~60 %
  const FIN_TITULO = 0.07, PLANETAS = 0.6;

  const marcoAlto = raiz.classList.contains('marco-alto');
  // Parte visible de la página: normal (scroll de la ventana) o medida por js/marco.js
  const vista = () => marcoAlto ? window.__vista : { top: window.scrollY, alto: window.innerHeight };
  const arribaDe = (el) => el.getBoundingClientRect().top + (marcoAlto ? 0 : window.scrollY);

  function menuVisible(v) {
    const arriba = arribaDe(viaje) - v.top;                    // borde superior del viaje respecto a la pantalla
    const abajo = arriba + viaje.offsetHeight;
    if (abajo <= v.alto * 0.5) return true;                     // ya salimos de la apertura
    const quieta = raiz.classList.contains('is-calma') || raiz.classList.contains('sin-webgl');
    if (quieta) return false;                                   // la apertura quieta muestra los planetas
    const alto = viaje.offsetHeight - escena.offsetHeight;
    const p = alto > 0 ? -arriba / alto : 0;
    return p > FIN_TITULO && p < PLANETAS;                      // visible durante el viaje, oculto en título y planetas
  }

  // Sección actual resaltada en el menú (la que ocupa el centro de la pantalla)
  const secciones = enlacesMenu.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
  function marcarActual(v) {
    const centro = v.top + v.alto / 2;
    enlacesMenu.forEach((a, i) => {
      const s = secciones[i];
      if (!s) return;
      const t = arribaDe(s);
      const dentro = centro >= t && centro < t + s.offsetHeight;
      if (dentro) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }

  let pendiente = false;
  function revisar() {
    pendiente = false;
    const v = vista();
    if (marcoAlto) barra.style.transform = 'translate3d(0,' + v.top.toFixed(1) + 'px,0)';
    barra.classList.toggle('con-menu', menuVisible(v));
    marcarActual(v);
  }
  function alMover() { if (!pendiente) { pendiente = true; requestAnimationFrame(revisar); } }
  window.addEventListener('scroll', alMover, { passive: true });
  window.addEventListener('resize', alMover);
  window.addEventListener('vista', alMover);
  revisar();

  /* ---------- 2. CARRUSEL INFINITO (sección 1) ---------- */
  (function carrusel() {
    const pista = document.getElementById('carrusel-pista');
    if (!pista) return;
    const reales = Array.from(pista.children);
    const total = reales.length;
    const puntos = Array.from(document.querySelectorAll('#carrusel-puntos button'));

    // Copias en los extremos para que el bucle no tenga saltos visibles
    const copiaFin = reales[total - 1].cloneNode(true);
    const copiaIni = reales[0].cloneNode(true);
    [copiaFin, copiaIni].forEach((c) => {
      c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', ''); c.removeAttribute('aria-label');
      c.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));   // sin ids repetidos
    });
    pista.insertBefore(copiaFin, reales[0]);
    pista.appendChild(copiaIni);

    let indice = 1;            // posición en la pista (0 y total+1 son copias)
    let moviendo = false, seguro = 0;

    const real = () => ((indice - 1) % total + total) % total;
    function pintar(animar, desplazamiento) {
      pista.classList.toggle('anima', animar && !sinMovimiento);
      const extra = desplazamiento ? ' translate3d(' + desplazamiento + 'px,0,0)' : '';
      pista.style.transform = 'translate3d(' + (-indice * 100) + '%,0,0)' + extra;
    }
    function estado() {
      const r = real();
      puntos.forEach((b, i) => b.setAttribute('aria-current', i === r ? 'true' : 'false'));
      reales.forEach((d, i) => { if (i === r) d.removeAttribute('inert'); else d.setAttribute('inert', ''); });
    }
    function normalizar() {
      if (indice === 0) { indice = total; pintar(false); }
      else if (indice === total + 1) { indice = 1; pintar(false); }
      moviendo = false;
    }
    function ir(nuevo) {
      if (moviendo) return;
      indice = nuevo;
      estado();
      if (sinMovimiento) { pintar(false); normalizar(); return; }
      moviendo = true;
      pintar(true);
      clearTimeout(seguro);
      seguro = setTimeout(normalizar, 1200);                    // por si no llega el fin de la transición
    }
    pista.addEventListener('transitionend', (e) => { if (e.target === pista) { clearTimeout(seguro); normalizar(); } });

    document.getElementById('carrusel-ant').addEventListener('click', () => ir(indice - 1));
    document.getElementById('carrusel-sig').addEventListener('click', () => ir(indice + 1));
    const verEstilos = document.getElementById('ver-estilos');
    if (verEstilos) verEstilos.addEventListener('click', () => ir(indice + 1));
    puntos.forEach((b, i) => b.addEventListener('click', () => ir(i + 1)));
    document.getElementById('carrusel').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(indice - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(indice + 1); }
    });

    // Deslizar con el dedo
    let x0 = null, dx = 0, ancho = 1;
    pista.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || moviendo) return;
      x0 = e.clientX; dx = 0; ancho = pista.clientWidth || 1;
    });
    pista.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      if (Math.abs(dx) > 8) pintar(false, dx);
    });
    const soltar = () => {
      if (x0 === null) return;
      x0 = null;
      if (Math.abs(dx) > Math.min(60, ancho * 0.15)) ir(indice + (dx < 0 ? 1 : -1));
      else pintar(true);
      dx = 0;
    };
    pista.addEventListener('pointerup', soltar);
    pista.addEventListener('pointercancel', soltar);

    pintar(false);
    estado();
  })();

  /* ---------- 3. DEMO DEL CHATBOT (cambia cada 30 s) ---------- */
  (function demo() {
    const pantallas = Array.from(document.querySelectorAll('.demo__pantalla'));
    const botones = Array.from(document.querySelectorAll('.demo__control button'));
    if (!pantallas.length) return;
    const CADA = 30000;
    let actual = 0, reloj = 0;
    function mostrar(i) {
      actual = i;
      pantallas.forEach((p, j) => p.classList.toggle('is-activa', j === i));
      botones.forEach((b, j) => b.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
    }
    function programar() {
      clearInterval(reloj);
      reloj = setInterval(() => mostrar((actual + 1) % pantallas.length), CADA);
    }
    botones.forEach((b, i) => b.addEventListener('click', () => { mostrar(i); programar(); }));
    mostrar(0);
    programar();
  })();

  /* ---------- 4. VIDEOS: solo suena uno a la vez ---------- */
  const videos = Array.from(document.querySelectorAll('.video-pieza'));
  videos.forEach((v) => v.addEventListener('play', () => videos.forEach((o) => { if (o !== v) o.pause(); })));
})();
