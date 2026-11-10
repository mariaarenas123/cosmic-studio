/* ==========================================================================
   Cosmic Studio · Visores que estiran la página (marco alto)
   Algunos visores (por ejemplo el enlace de Claude en computador) muestran la
   página dentro de un marco tan alto como todo el contenido: la página nunca
   hace scroll por sí misma, lo hace la ventana de afuera. Así, "position:
   sticky/fixed" y los eventos de scroll no sirven.

   Solución: una columna de sensores invisibles (franjas de 24 px) observadas
   con IntersectionObserver. Las franjas que se ven dicen qué parte de la
   página está en pantalla. Con eso se publica:
     window.__vista = { top, alto }   (en píxeles de la página)
     --alto-vista                     (variable CSS con el alto visible)
   y se avisa con el evento "vista". escena.js y secciones.js lo usan para
   mover la escena 3D y la barra superior.
   ========================================================================== */
(function () {
  'use strict';
  const raiz = document.documentElement;
  window.__vista = { top: 0, alto: 800, lista: false };
  if (!raiz.classList.contains('marco-alto')) return;

  const PASO = 24;
  const UMBRALES = Array.from({ length: 13 }, (_, i) => i / 12);
  const visibles = new Map();
  let io = null, altoDoc = 0, pendiente = false;

  const capa = document.createElement('div');
  capa.setAttribute('aria-hidden', 'true');
  capa.style.cssText = 'position:absolute;left:0;top:0;width:1px;pointer-events:none;opacity:0;z-index:-1';
  document.body.appendChild(capa);

  function calcular() {
    if (!visibles.size) return;
    let arriba = Infinity, abajo = -Infinity;
    visibles.forEach(([t, b]) => { if (t < arriba) arriba = t; if (b > abajo) abajo = b; });
    const alto = Math.max(200, abajo - arriba);
    const v = window.__vista;
    const cambioAlto = Math.abs(alto - v.alto) > 2;
    v.top = arriba; v.alto = alto; v.lista = true;
    if (cambioAlto) raiz.style.setProperty('--alto-vista', Math.round(alto) + 'px');
    window.dispatchEvent(new Event('vista'));
  }

  function construir() {
    pendiente = false;
    const nuevoAlto = Math.max(document.body.scrollHeight, raiz.scrollHeight);
    if (Math.abs(nuevoAlto - altoDoc) < 4 && io) return;
    altoDoc = nuevoAlto;
    if (io) io.disconnect();
    visibles.clear();
    capa.textContent = '';
    capa.style.height = altoDoc + 'px';
    io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        const i = +e.target.dataset.i;
        const r = e.intersectionRect, b = e.boundingClientRect;
        if (e.isIntersecting && r.height > 0) {
          const t = i * PASO + (r.top - b.top);
          visibles.set(i, [t, t + r.height]);
        } else visibles.delete(i);
      });
      calcular();
    }, { threshold: UMBRALES });
    const n = Math.ceil(altoDoc / PASO);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div');
      s.dataset.i = i;
      s.style.cssText = 'position:absolute;left:0;width:1px;top:' + (i * PASO) + 'px;height:' + PASO + 'px';
      frag.appendChild(s);
    }
    capa.appendChild(frag);
    Array.from(capa.children).forEach((s) => io.observe(s));
  }
  function programar() { if (!pendiente) { pendiente = true; setTimeout(construir, 150); } }

  construir();
  if ('ResizeObserver' in window) new ResizeObserver(programar).observe(document.body);
  window.addEventListener('load', programar);
})();
