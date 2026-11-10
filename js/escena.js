/* ==========================================================================
   Cosmic Studio · Escena 3D continua con Three.js
   Parte 1 (0–40 %)   sistema solar + título, la cámara avanza hacia el Sol
   Parte 2 (40–55 %)  destello del Sol y viaje a la velocidad de la luz
   Parte 3 (55–100 %) las estrellas frenan y aparecen Tierra, Marte y Saturno (botones desde el 70 %)
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const raiz = document.documentElement;
const calma = raiz.classList.contains('is-calma');               // menos movimiento
const marcoAlto = raiz.classList.contains('marco-alto');         // visor que estira la página (ver js/marco.js)
const movil = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

/* ---------- Texturas (Solar System Scope, CC BY 4.0) en la carpeta /textures ---------- */
const CARPETA = 'textures/';
const ARCHIVOS = {
  sol: '2k_sun.jpg',
  mercurio: '2k_mercury.jpg',
  venus: '2k_venus_surface.jpg',
  tierra: '2k_earth_daymap.jpg',
  nubes: '2k_earth_clouds.jpg',
  marte: '2k_mars.jpg',
  jupiter: '2k_jupiter.jpg',
  saturno: '2k_saturn.jpg',
  anillo: '2k_saturn_ring_alpha.png',
  urano: '2k_uranus.jpg',
  neptuno: '2k_neptune.jpg',
  viaLactea: '2k_stars_milky_way.jpg'
};

/* ---------- Tramos del scroll ---------- */
const P = {
  finTitulo: 0.08,
  flashSube: 0.34, flashPico: 0.415, flashBaja: 0.50,
  warpEntra: 0.405, warpLleno: 0.44,
  frenaIni: 0.55, frenaFin: 0.70,      // las estrellas frenan y llegan los planetas
  botones: 0.70                         // desde aquí los planetas son botones
};

/* ---------- Utilidades ---------- */
const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mezclar = (a, b, t) => a + (b - a) * t;
const tramo = (p, a, b) => limitar((p - a) / (b - a));
const suave = (t) => t * t * (3 - 2 * t);
const salida = (t) => 1 - Math.pow(1 - t, 3);                     // ease-out
const entrada = (t) => t * t;

/* ==========================================================================
   1. ELEMENTOS DE LA PÁGINA
   ========================================================================== */
const viaje = document.getElementById('inicio');
const escena = document.getElementById('escena');
const lienzo = document.getElementById('lienzo');
const parte1 = document.getElementById('parte1');
const marca = document.getElementById('marca');
const grupoEnlaces = document.getElementById('planetas');
const enlaces = Array.from(grupoEnlaces.querySelectorAll('.planeta'));
const carga = document.getElementById('carga');
const barra = document.getElementById('carga-barra');

const destello = document.createElement('div');
destello.setAttribute('aria-hidden', 'true');
Object.assign(destello.style, {
  position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0',
  background: 'radial-gradient(circle at 50% 52%, #ffffff 0%, #fff7e6 28%, #f6dfae 58%, rgba(233,194,122,0.85) 100%)',
  mixBlendMode: 'screen'
});
escena.insertBefore(destello, parte1);

let lenis = null;
let terminado = false;

function quitarCarga(sinWebgl) {
  if (terminado) return;
  terminado = true;
  window.__escenaLista = true;
  if (sinWebgl) raiz.classList.add('sin-webgl');
  carga.classList.add('is-lista');
  raiz.classList.remove('is-cargando');
  raiz.classList.add('is-entra');
  if (lenis) lenis.start();
}

/* ==========================================================================
   2. RENDERER, CÁMARA Y POSTPROCESO
   ========================================================================== */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  grupoEnlaces.classList.add('is-activa');
  quitarCarga(true);
  throw e;
}
const DPR_MAX = movil ? 1.5 : 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
renderer.setClearColor(0x03040a, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const mundo = new THREE.Scene();
mundo.background = new THREE.Color(0x03040a);
const FOV = 45;
const camara = new THREE.PerspectiveCamera(FOV, 1, 0.05, 3000);

const objetivo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: movil ? 0 : 4 });
const composer = new EffectComposer(renderer, objetivo);
composer.addPass(new RenderPass(mundo, camara));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.65, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());

/* ==========================================================================
   3. CARGA DE TEXTURAS (con texturas generadas si falta algún archivo)
   ========================================================================== */
function cargarImagen(url) {
  return new Promise((listo) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => listo(img);
    img.onerror = () => listo(null);
    img.src = url;
  });
}
// En móvil las texturas se reducen a 1k antes de subirlas a la GPU
function reducir(img) {
  if (!movil || img.width <= 1024) return img;
  const c = document.createElement('canvas');
  c.width = 1024; c.height = Math.max(1, Math.round(img.height * 1024 / img.width));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
function hacerTextura(fuente, color = true) {
  const t = new THREE.Texture(fuente);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropia;
  t.needsUpdate = true;
  return t;
}

/* --- Texturas generadas (respaldo mientras no estén los archivos reales) --- */
function hash(x, y, z, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function ruido(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => hash(xi + a, yi + b, zi + d, s);
  const x00 = mezclar(c(0, 0, 0), c(1, 0, 0), u), x10 = mezclar(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = mezclar(c(0, 0, 1), c(1, 0, 1), u), x11 = mezclar(c(0, 1, 1), c(1, 1, 1), u);
  return mezclar(mezclar(x00, x10, v), mezclar(x01, x11, v), w);
}
function fbm(x, y, z, s, oct = 5) {
  let a = 0.5, f = 1, suma = 0, norma = 0;
  for (let i = 0; i < oct; i++) { suma += a * ruido(x * f, y * f, z * f, s + i); norma += a; a *= 0.5; f *= 2.03; }
  return suma / norma;
}
function pintarEsfera(ancho, fn) {
  const alto = ancho / 2;
  const c = document.createElement('canvas'); c.width = ancho; c.height = alto;
  const g = c.getContext('2d'); const datos = g.createImageData(ancho, alto); const d = datos.data;
  for (let y = 0; y < alto; y++) {
    const lat = (0.5 - (y + 0.5) / alto) * Math.PI, ny = Math.sin(lat), r = Math.cos(lat);
    for (let x = 0; x < ancho; x++) {
      const lon = (x + 0.5) / ancho * Math.PI * 2;
      const col = fn(r * Math.cos(lon), ny, r * Math.sin(lon), lat);
      const k = (y * ancho + x) * 4;
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = col.length > 3 ? col[3] : 255;
    }
  }
  g.putImageData(datos, 0, 0);
  return c;
}
const mezclaColor = (a, b, t) => [mezclar(a[0], b[0], t), mezclar(a[1], b[1], t), mezclar(a[2], b[2], t)];
function generada(clave) {
  const A = movil ? 256 : 512, a = 256;
  switch (clave) {
    case 'sol': return pintarEsfera(a, (x, y, z) => { const n = fbm(x * 6, y * 6, z * 6, 1, 4); return mezclaColor([255, 196, 120], [255, 240, 200], n); });
    case 'mercurio': return pintarEsfera(a, (x, y, z) => { const n = fbm(x * 4, y * 4, z * 4, 2); const v = 95 + n * 90; return [v, v * 0.96, v * 0.92]; });
    case 'venus': return pintarEsfera(a, (x, y, z) => { const n = fbm(x * 2, y * 6, z * 2, 3, 4); return mezclaColor([200, 160, 100], [240, 215, 165], n); });
    case 'tierra': return pintarEsfera(A, (x, y, z, lat) => {
      const n = fbm(x * 1.7 + 3, y * 1.7, z * 1.7, 4, 6), m = fbm(x * 6, y * 6, z * 6, 9, 4);
      if (Math.abs(lat) > 1.28 + (m - 0.5) * 0.3) return [232, 238, 244];
      if (n < 0.52) return mezclaColor([8, 30, 78], [26, 74, 132], limitar((n - 0.3) / 0.22));
      const seco = Math.abs(lat) < 0.55 && m > 0.55;
      return seco ? mezclaColor([170, 140, 95], [196, 170, 120], m) : mezclaColor([38, 72, 34], [112, 104, 64], m);
    });
    case 'nubes': return pintarEsfera(A, (x, y, z) => { const n = fbm(x * 2.6 + 11, y * 3.2, z * 2.6, 13, 5); const v = 255 * limitar((n - 0.47) / 0.24); return [v, v, v]; });
    case 'marte': return pintarEsfera(A, (x, y, z, lat) => {
      const n = fbm(x * 2, y * 2, z * 2, 21, 6), oscuro = fbm(x * 1.2 + 7, y * 1.2, z * 1.2, 27, 4);
      if (Math.abs(lat) > 1.36 + (n - 0.5) * 0.2) return [236, 230, 222];
      let c = mezclaColor([140, 62, 32], [206, 118, 70], n);
      if (oscuro > 0.57) c = c.map((v) => v * 0.62);
      return c;
    });
    case 'jupiter': return pintarEsfera(a, (x, y, z, lat) => { const b = Math.sin(lat * 18 + fbm(x * 3, y * 3, z * 3, 31) * 4); return mezclaColor([150, 108, 76], [232, 214, 186], b * 0.5 + 0.5); });
    case 'saturno': return pintarEsfera(A, (x, y, z, lat) => { const b = Math.sin(lat * 14 + fbm(x * 2, y * 2, z * 2, 41) * 1.6); return mezclaColor([186, 158, 110], [232, 214, 168], b * 0.5 + 0.5); });
    case 'urano': return pintarEsfera(a, (x, y, z, lat) => mezclaColor([140, 200, 214], [176, 226, 234], Math.sin(lat * 6) * 0.5 + 0.5));
    case 'neptuno': return pintarEsfera(a, (x, y, z, lat) => mezclaColor([40, 72, 170], [80, 120, 214], Math.sin(lat * 9 + fbm(x * 3, y * 3, z * 3, 51) * 2) * 0.5 + 0.5));
    case 'anillo': {
      const c = document.createElement('canvas'); c.width = 512; c.height = 4;
      const g = c.getContext('2d'); const datos = g.createImageData(512, 4);
      for (let i = 0; i < 512; i++) {
        const t = i / 511, n = fbm(t * 40, 0, 0, 61, 4);
        let al = 0.25 + 0.7 * n;
        if (t > 0.54 && t < 0.6) al *= 0.08;                    // división de Cassini
        al *= limitar(t / 0.06) * limitar((1 - t) / 0.04);
        const v = 0.78 + 0.22 * n;
        for (let j = 0; j < 4; j++) { const k = (j * 512 + i) * 4; datos.data[k] = 214 * v; datos.data[k + 1] = 196 * v; datos.data[k + 2] = 160 * v; datos.data[k + 3] = 255 * al; }
      }
      g.putImageData(datos, 0, 0);
      return c;
    }
    default: return null;                                      // sin Vía Láctea generada
  }
}

async function cargarTexturas(alAvanzar) {
  const claves = Object.keys(ARCHIVOS);
  let hechas = 0;
  const lista = await Promise.all(claves.map(async (clave) => {
    const img = await cargarImagen(CARPETA + ARCHIVOS[clave]);
    let tex = null;
    if (img) tex = hacerTextura(reducir(img), clave !== 'nubes');
    else { const c = generada(clave); if (c) tex = hacerTextura(c, clave !== 'nubes'); }
    hechas++; alAvanzar(hechas / claves.length);
    return [clave, tex];
  }));
  return Object.fromEntries(lista);
}

/* ==========================================================================
   4. PIEZAS DE LA ESCENA
   ========================================================================== */

/* --- Halo radial (Sol y halo dorado del hover) --- */
function texturaHalo(paradas) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  paradas.forEach(([t, col]) => gr.addColorStop(t, col));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const haloSuave = texturaHalo([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,250,235,0.85)'], [0.42, 'rgba(255,214,150,0.28)'], [0.7, 'rgba(255,190,110,0.07)'], [1, 'rgba(255,180,100,0)']]);
const haloOro = texturaHalo([[0, 'rgba(255,214,150,0)'], [0.36, 'rgba(255,214,150,0)'], [0.48, 'rgba(255,206,130,0.55)'], [0.62, 'rgba(255,196,110,0.18)'], [1, 'rgba(255,190,100,0)']]);

/* --- Campo de estrellas: el mismo en las 3 partes; en el viaje se estira en líneas --- */
const TUNEL = /* glsl */`
  uniform float uWarp; uniform float uTravel;
  vec3 tunel(vec3 p, float seed){
    vec2 d = p.xy; float l = length(d);
    vec2 dir = l > 0.0001 ? d / l : vec2(1.0, 0.0);
    float radio = 2.5 + 90.0 * pow(fract(seed * 7.13), 1.4);
    float z = -mix(620.0, 1.0, fract(seed * 3.71 + uTravel));
    return vec3(dir * radio, z);
  }
`;
function crearCielo(n) {
  const R = 500;
  const pos = new Float32Array(n * 3), tam = new Float32Array(n), bri = new Float32Array(n), col = new Float32Array(n * 3), sem = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(th) * R, u * R, s * Math.sin(th) * R], i * 3);
    tam[i] = 0.6 + Math.pow(Math.random(), 5) * 2.6;
    bri[i] = 0.22 + Math.pow(Math.random(), 2.2) * 0.85;
    const r = Math.random();
    col.set(r < 0.12 ? [0.72, 0.82, 1] : r < 0.2 ? [1, 0.86, 0.68] : [1, 1, 1], i * 3);
    sem[i] = Math.random();
  }
  const comunes = { uWarp: { value: 0 }, uTravel: { value: 0 }, uTiempo: { value: 0 }, uPixel: { value: 1 }, uEstela: { value: 0 }, uOpacidad: { value: 1 } };

  // Puntos (reposo)
  const gp = new THREE.BufferGeometry();
  gp.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  gp.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
  gp.setAttribute('aBri', new THREE.BufferAttribute(bri, 1));
  gp.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  gp.setAttribute('aSem', new THREE.BufferAttribute(sem, 1));
  const puntos = new THREE.Points(gp, new THREE.ShaderMaterial({
    uniforms: comunes, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aTam; attribute float aBri; attribute vec3 aCol; attribute float aSem;
      uniform float uTiempo; uniform float uPixel; uniform float uOpacidad;
      varying vec3 vCol; varying float vA;
      ${TUNEL}
      void main(){
        vec3 p = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vec3 t = tunel(p, aSem);
        float frente = step(p.z, 0.0);
        float lejos = smoothstep(620.0, 420.0, -t.z);
        vec3 q = mix(p, t, uWarp);
        gl_Position = projectionMatrix * vec4(q, 1.0);
        float brillo = 0.82 + 0.18 * sin(uTiempo * (0.6 + aSem) + aSem * 40.0);
        vA = aBri * brillo * mix(1.0, frente * lejos, uWarp) * uOpacidad;
        vCol = aCol * (0.8 + aTam * 0.45);
        gl_PointSize = aTam * uPixel * (1.0 - 0.35 * uWarp);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol * vA * a, 1.0);
      }`
  }));

  // Líneas (estelas del viaje): 2 vértices por estrella
  const pos2 = new Float32Array(n * 6), bri2 = new Float32Array(n * 2), sem2 = new Float32Array(n * 2), fin = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos2.set(pos.subarray(i * 3, i * 3 + 3), i * 6); pos2.set(pos.subarray(i * 3, i * 3 + 3), i * 6 + 3);
    bri2[i * 2] = bri2[i * 2 + 1] = bri[i];
    sem2[i * 2] = sem2[i * 2 + 1] = sem[i];
    fin[i * 2] = 0; fin[i * 2 + 1] = 1;
  }
  const gl = new THREE.BufferGeometry();
  gl.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  gl.setAttribute('aBri', new THREE.BufferAttribute(bri2, 1));
  gl.setAttribute('aSem', new THREE.BufferAttribute(sem2, 1));
  gl.setAttribute('aFin', new THREE.BufferAttribute(fin, 1));
  const lineas = new THREE.LineSegments(gl, new THREE.ShaderMaterial({
    uniforms: comunes, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aBri; attribute float aSem; attribute float aFin;
      uniform float uEstela;
      varying vec3 vCol; varying float vA;
      ${TUNEL}
      void main(){
        vec3 p = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vec3 t = tunel(p, aSem);
        float frente = step(p.z, 0.0);
        float lejos = smoothstep(620.0, 420.0, -t.z);
        vec3 q = mix(p, t, uWarp);
        q.z -= aFin * uEstela * (0.35 + 0.65 * fract(aSem * 13.7));
        gl_Position = projectionMatrix * vec4(q, 1.0);
        vA = (0.35 + aBri) * frente * lejos * uWarp * clamp(uEstela / 25.0, 0.0, 1.0) * (1.0 - 0.9 * aFin);
        vCol = mix(vec3(1.25, 1.25, 1.3), vec3(0.5, 0.68, 1.15), aFin);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main(){ gl_FragColor = vec4(vCol * vA, 1.0); }`
  }));
  lineas.frustumCulled = puntos.frustumCulled = false;
  lineas.renderOrder = puntos.renderOrder = -1;
  return { puntos, lineas, u: comunes };
}

/* --- Atmósfera: brillo fresnel en el borde, solo del lado iluminado --- */
function crearAtmosfera(radio, color, intensidad, potencia = 3.2) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(...color) }, uLuz: { value: new THREE.Vector3() }, uI: { value: intensidad }, uPot: { value: potencia }, uEncendido: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vW;
      void main(){
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform vec3 uLuz; uniform float uI; uniform float uPot; uniform float uEncendido;
      varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float f = pow(1.0 - max(dot(normalize(vN), V), 0.0), uPot);
        vec3 L = normalize(uLuz - vW);
        float lado = smoothstep(-0.3, 0.55, dot(normalize(vN), L));
        gl_FragColor = vec4(uColor * f * lado * uI * uEncendido, 1.0);
      }`
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radio, 64, 32), mat);
}

/* --- Anillos de Saturno con la sombra del planeta --- */
function crearAnillo(mapa, interior, exterior) {
  const geo = new THREE.RingGeometry(interior, exterior, 160, 1);
  const p = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - interior) / (exterior - interior), 0.5); }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMapa: { value: mapa }, uLuz: { value: new THREE.Vector3() }, uCentro: { value: new THREE.Vector3() }, uRadio: { value: 1 }, uColorLuz: { value: new THREE.Color(1, 0.96, 0.9) }, uEncendido: { value: 1 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMapa; uniform vec3 uLuz; uniform vec3 uCentro; uniform float uRadio; uniform vec3 uColorLuz; uniform float uEncendido;
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){
        vec4 t = texture2D(uMapa, vec2(vUv.x, 0.5));
        vec3 L = normalize(uLuz - vW);
        vec3 oc = vW - uCentro;
        float b = dot(oc, L);
        float h = b * b - (dot(oc, oc) - uRadio * uRadio);
        float sombra = (b < 0.0) ? smoothstep(-0.04, 0.12, h / (uRadio * uRadio)) : 0.0;
        float luz = (0.3 + 0.7 * abs(dot(vN, L))) * (1.0 - 0.94 * sombra);
        gl_FragColor = vec4(t.rgb * uColorLuz * luz * uEncendido, t.a);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;      // al plano del ecuador
  return m;
}

/* ==========================================================================
   5. CONSTRUCCIÓN DEL MUNDO
   ========================================================================== */
const luzSol = new THREE.PointLight(0xfff2de, 3.4, 0, 0);   // la única fuente de luz
mundo.add(luzSol);

const cielo = new THREE.Group(); mundo.add(cielo);           // sigue a la cámara (estrellas "en el infinito")
const estrellas = crearCielo(movil ? 3500 : 7000);
cielo.add(estrellas.puntos, estrellas.lineas);
let viaLactea = null;

const sistema = new THREE.Group(); mundo.add(sistema);
const destinos = new THREE.Group(); mundo.add(destinos);
const orbitantes = [];
const girantes = [];
const anillos = [];
const atmosferas = [];
const productos = [];   // los 3 planetas-botón

const g2r = THREE.MathUtils.degToRad;

function construir(T) {
  // Vía Láctea muy tenue
  if (T.viaLactea) {
    viaLactea = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.MeshBasicMaterial({
      map: T.viaLactea, side: THREE.BackSide, transparent: true, opacity: 0.16, depthWrite: false, color: new THREE.Color(0.7, 0.72, 0.85)
    }));
    viaLactea.renderOrder = -2;
    viaLactea.rotation.set(0.5, 0, 0.9);
    cielo.add(viaLactea);
  }

  /* --- Sol: luz blanca y dorada con halo, no una bola de fuego --- */
  const sol = new THREE.Mesh(new THREE.SphereGeometry(2, 64, 32), new THREE.MeshBasicMaterial({ map: T.sol, color: new THREE.Color(4.2, 3.6, 2.7) }));
  sistema.add(sol);
  const halo1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloSuave, color: new THREE.Color(2.6, 2.3, 1.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo1.scale.setScalar(9);
  const halo2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloSuave, color: new THREE.Color(1.1, 0.78, 0.42), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }));
  halo2.scale.setScalar(24);
  sistema.add(halo1, halo2);

  /* --- Los 8 planetas pequeños en sus órbitas --- */
  const DATOS = [
    // clave, radio de órbita, tamaño, inclinación (°), ángulo inicial
    ['mercurio', 4.4, 0.17, 0, 0.8],
    ['venus', 6.0, 0.3, 177, 2.4],
    ['tierra', 7.8, 0.32, 23.4, 4.1],
    ['marte', 9.6, 0.25, 25.2, 5.6],
    ['jupiter', 13.2, 0.85, 3.1, 1.6],
    ['saturno', 17.0, 0.7, 26.7, 3.2],
    ['urano', 20.6, 0.46, 97.8, 0.3],
    ['neptuno', 23.6, 0.44, 28.3, 2.0]
  ];
  const matOrbita = new THREE.LineBasicMaterial({ color: 0x9aa3b8, transparent: true, opacity: 0.2, depthWrite: false });
  DATOS.forEach(([clave, r, tam, incl, ang]) => {
    const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    sistema.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matOrbita));

    const pivote = new THREE.Group(); pivote.rotation.y = ang; sistema.add(pivote);
    const sitio = new THREE.Group(); sitio.position.x = r; pivote.add(sitio);
    const eje = new THREE.Group(); eje.rotation.z = g2r(incl); sitio.add(eje);
    const malla = new THREE.Mesh(new THREE.SphereGeometry(tam, 40, 24), new THREE.MeshStandardMaterial({ map: T[clave], roughness: 1, metalness: 0 }));
    eje.add(malla);
    orbitantes.push({ pivote, w: 0.55 / Math.pow(r, 1.5) * 1.6 });
    girantes.push({ malla, w: 0.25 });
    if (clave === 'saturno') {
      const an = crearAnillo(T.anillo, tam * 1.24, tam * 2.27); eje.add(an);
      anillos.push({ an, malla, radio: tam });
    }
    if (clave === 'tierra') { const at = crearAtmosfera(tam * 1.08, [0.35, 0.6, 1], 1.2); sitio.add(at); atmosferas.push(at); }
  });

  /* --- Los 3 planetas-producto --- */
  const PRODUCTOS = {
    tierra:  { radio: 1.0,  incl: 23.4, giro: 0.10, atm: [0.32, 0.58, 1.0], atmI: 1.5, atmPot: 2.6 },
    marte:   { radio: 0.9,  incl: 25.2, giro: 0.09, atm: [1.0, 0.58, 0.38], atmI: 0.5, atmPot: 3.4 },
    saturno: { radio: 0.92, incl: 26.7, giro: 0.13, atm: [1.0, 0.88, 0.66], atmI: 0.35, atmPot: 3.6, anillo: [1.24, 2.27] }
  };
  enlaces.forEach((a, i) => {
    const clave = a.dataset.planeta, d = PRODUCTOS[clave];
    const base = new THREE.Group(); destinos.add(base);
    const escala = new THREE.Group(); base.add(escala);
    const eje = new THREE.Group();
    eje.rotation.set(clave === 'saturno' ? 0.3 : 0.12, 0, -g2r(d.incl));
    escala.add(eje);
    const malla = new THREE.Mesh(new THREE.SphereGeometry(d.radio, movil ? 64 : 96, movil ? 32 : 48),
      new THREE.MeshStandardMaterial({ map: T[clave], roughness: clave === 'tierra' ? 0.8 : 1, metalness: 0 }));
    malla.userData.indice = i;
    malla.rotation.y = i * 1.7;
    eje.add(malla);
    let nubes = null;
    if (clave === 'tierra' && T.nubes) {
      nubes = new THREE.Mesh(new THREE.SphereGeometry(d.radio * 1.012, movil ? 64 : 96, movil ? 32 : 48),
        new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: T.nubes, transparent: true, depthWrite: false, roughness: 1, metalness: 0 }));
      eje.add(nubes);
    }
    const at = crearAtmosfera(d.radio * (clave === 'tierra' ? 1.07 : 1.04), d.atm, d.atmI, d.atmPot);
    escala.add(at); atmosferas.push(at);
    let anillo = null;
    if (d.anillo) {
      anillo = crearAnillo(T.anillo, d.radio * d.anillo[0], d.radio * d.anillo[1]);
      anillo.userData.indice = i;
      eje.add(anillo);
      anillos.push({ an: anillo, malla, radio: d.radio });
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloOro, color: new THREE.Color(1.6, 1.25, 0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    const alcance = d.anillo ? d.radio * d.anillo[1] : d.radio;
    halo.scale.setScalar(alcance * (d.anillo ? 2.6 : 3.4));
    halo.position.z = -d.radio * 0.6;
    base.add(halo);
    productos.push({ a, clave, base, escala, malla, nubes, anillo, halo, radio: d.radio, alcance, giro: d.giro, hover: 0, angulo: malla.rotation.y });
  });
}

/* ==========================================================================
   6. MEDIDAS, ENCUADRE Y DISTRIBUCIÓN (fila en horizontal, columna en vertical)
   ========================================================================== */
let W = 1, H = 1, vertical = false;
const encuadre3 = { dist: 10, mira: 0 };
function medir() {
  W = escena.clientWidth || innerWidth; H = escena.clientHeight || innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H, false);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  bloom.resolution.set(W * (movil ? 0.5 : 1), H * (movil ? 0.5 : 1));
  estrellas.u.uPixel.value = dpr;
  camara.aspect = W / H;
  vertical = W / H < 0.8;

  const tan = Math.tan(g2r(FOV / 2)), asp = W / H;
  if (vertical) {
    const sep = 3.6;
    productos.forEach((pl, i) => pl.base.position.set(0, sep * (1 - i), 0));
    const medioAncho = 2.15 + 0.5, medioAlto = sep + 1.0 + 1.35;
    encuadre3.dist = Math.max(medioAncho / (tan * asp), medioAlto / tan);
    encuadre3.mira = -0.35;
  } else {
    const sep = 3.9;
    productos.forEach((pl, i) => pl.base.position.set(sep * (i - 1), 0, 0));
    const medioAncho = sep + 2.15 + 0.4, medioAlto = 2.6;
    encuadre3.dist = Math.max(medioAncho / (tan * asp), medioAlto / tan);
    encuadre3.mira = -0.42;
  }
  sucio = true;
}

/* ==========================================================================
   7. ESTADO SEGÚN EL PROGRESO DEL SCROLL
   ========================================================================== */
const posCam = new THREE.Vector3(), mira = new THREE.Vector3();
let viajeTiempo = 0;                     // avance extra del túnel con el tiempo (si se detiene en el viaje)
let estadoActiva = null;

function velocidadLuz(p) {
  if (p < P.frenaIni) return entrada(tramo(p, P.warpEntra, P.warpLleno + 0.02));
  return Math.pow(1 - tramo(p, P.frenaIni, P.frenaFin), 2);
}
function recorrido(p) {                  // integral aproximada de la velocidad (para rebobinar igual al subir)
  const a = tramo(p, P.warpEntra, P.frenaIni) * (P.frenaIni - P.warpEntra);
  const t = tramo(p, P.frenaIni, P.frenaFin);
  return (a + (P.frenaFin - P.frenaIni) * (1 - Math.pow(1 - t, 3)) / 3) * 5.5;
}

function aplicar(p, dt) {
  const enSistema = p < P.flashPico;
  sistema.visible = enSistema;
  destinos.visible = p >= P.frenaIni;

  // --- Destello del Sol ---
  const flash = p < P.flashPico ? entrada(tramo(p, P.flashSube, P.flashPico)) : 1 - salida(tramo(p, P.flashPico, P.flashBaja));
  destello.style.opacity = (flash * 0.97).toFixed(3);

  // --- Velocidad de la luz ---
  const warp = suave(tramo(p, P.warpEntra, P.warpLleno)) * (1 - suave(tramo(p, P.frenaIni, P.frenaFin + 0.02)));
  const vel = velocidadLuz(p);
  if (!calma) viajeTiempo += dt * vel * 0.32;
  estrellas.u.uWarp.value = warp;
  estrellas.u.uTravel.value = recorrido(p) + viajeTiempo;
  estrellas.u.uEstela.value = vel * (movil ? 120 : 160);
  if (viaLactea) viaLactea.material.opacity = 0.16 * (1 - warp);

  // --- Cámara ---
  let fov = FOV + 13 * warp * vel;
  if (enSistema) {
    const t = tramo(p, 0, P.flashPico);
    const e = Math.pow(t, 1.7);                                // avanza despacio y luego entra al Sol
    const asp = W / H;
    const d0 = 54 * Math.pow(Math.max(1, 1.05 / asp), 0.6);
    const dist = Math.exp(mezclar(Math.log(d0), Math.log(3.6), e));
    const elev = mezclar(0.5, 0.1, suave(t)), az = mezclar(-0.12, 0.3, suave(t));
    posCam.set(Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
    mira.set(0, mezclar(dist * 0.1, 0, suave(t)), 0);
    luzSol.position.set(0, 0, 0);
    luzSol.intensity = 3.4;
  } else {
    const llegada = salida(tramo(p, P.frenaIni, P.frenaFin));
    const deriva = suave(tramo(p, P.frenaFin, 1));
    const dist = encuadre3.dist * (1 + 7 * (1 - llegada)) * (1 - 0.025 * deriva);
    posCam.set(0, encuadre3.mira + dist * 0.05, dist);
    mira.set(0, encuadre3.mira, 0);
    luzSol.position.set(-90, 40, 70);
    luzSol.intensity = 3.6 * suave(tramo(p, P.frenaIni, P.frenaFin - 0.01));
  }
  camara.position.copy(posCam);
  camara.lookAt(mira);
  if (Math.abs(camara.fov - fov) > 0.001) { camara.fov = fov; }
  camara.updateProjectionMatrix();
  cielo.position.copy(camara.position);

  // --- Brillo general ---
  renderer.toneMappingExposure = 1 + 1.4 * flash;
  bloom.strength = (enSistema ? 0.6 : 0.5) + 2.2 * flash + 0.5 * warp * vel;

  // --- Luz compartida por atmósferas y anillos ---
  const encendido = enSistema ? 1 : luzSol.intensity / 3.6;
  atmosferas.forEach((at) => { at.material.uniforms.uLuz.value.copy(luzSol.position); at.material.uniforms.uEncendido.value = encendido; });

  // --- Capa del título ---
  const k = tramo(p, 0, P.finTitulo);
  if (!calma) {
    parte1.style.opacity = (1 - k).toFixed(3);
    parte1.style.transform = 'translate3d(0,' + (-k * H * 0.16).toFixed(1) + 'px,0)';
    parte1.style.visibility = k >= 1 ? 'hidden' : '';
  }
  const fondoViaje = marcoAlto ? viaje.offsetTop + viaje.offsetHeight - window.__vista.top : viaje.getBoundingClientRect().bottom;
  marca.classList.toggle('is-visible', (!calma && p > 0.07) || fondoViaje < H * 0.5);

  // --- Botones desde el 70 % ---
  const activa = calma || p >= P.botones - 0.003;
  if (activa !== estadoActiva) {
    estadoActiva = activa;
    grupoEnlaces.classList.toggle('is-activa', activa);
    if (!activa) { indiceRayo = -1; }
  }
}

/* ==========================================================================
   8. HOVER (raycasting + foco de teclado) Y ENLACES PROYECTADOS
   ========================================================================== */
const rayo = new THREE.Raycaster();
const puntero = new THREE.Vector2(9, 9);
let hayPuntero = false, indiceRayo = -1, indiceFoco = -1;
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  const r = escena.getBoundingClientRect();
  puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  hayPuntero = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { hayPuntero = false; indiceRayo = -1; });
function lanzarRayo() {
  if (!hayPuntero || !estadoActiva || !destinos.visible) { indiceRayo = -1; return; }
  rayo.setFromCamera(puntero, camara);
  const objetos = [];
  productos.forEach((pl) => { objetos.push(pl.malla); if (pl.anillo) objetos.push(pl.anillo); });
  const hit = rayo.intersectObjects(objetos, false)[0];
  indiceRayo = hit ? hit.object.userData.indice : -1;
}
escena.addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  if (indiceRayo >= 0) productos[indiceRayo].a.click();
});
escena.style.cursor = '';

const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
function colocarEnlaces() {
  const tan = Math.tan(g2r(camara.fov / 2));
  productos.forEach((pl, i) => {
    pl.base.getWorldPosition(v3);
    v3b.copy(v3).applyMatrix4(camara.matrixWorldInverse);
    const prof = -v3b.z;
    v3.project(camara);
    const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H;
    const pxPorUnidad = (H / 2) / (tan * Math.max(prof, 0.001));
    const esc = pl.escala.scale.x;
    const rCuerpo = pl.radio * esc * pxPorUnidad;
    const rZona = (pl.anillo ? pl.alcance * 0.82 : pl.radio * 1.04) * esc * pxPorUnidad;
    const d = Math.max(44, rZona * 2);
    const st = pl.a.style;
    st.width = st.height = d.toFixed(1) + 'px';
    st.transform = 'translate3d(' + (x - d / 2).toFixed(1) + 'px,' + (y - d / 2).toFixed(1) + 'px,0)';
    const bajo = pl.anillo ? rCuerpo * 1.3 : rCuerpo;          // bajo los anillos en Saturno
    st.setProperty('--bajo', (d / 2 + bajo + Math.max(12, rCuerpo * 0.16)).toFixed(1) + 'px');
    pl.a.classList.toggle('is-hover', indiceRayo === i);
  });
  escena.style.cursor = indiceRayo >= 0 ? 'pointer' : '';
}

/* ==========================================================================
   9. ANIMACIÓN CONTINUA (giros con el tiempo, no con el scroll)
   ========================================================================== */
const _c = new THREE.Vector3();
function animarTiempo(dt) {
  const lento = calma ? 0.22 : 1;
  if (sistema.visible) {
    orbitantes.forEach((o) => { o.pivote.rotation.y += o.w * dt * lento; });
    girantes.forEach((g) => { g.malla.rotation.y += g.w * dt * lento; });
  }
  if (destinos.visible) {
    productos.forEach((pl, i) => {
      const meta = (indiceRayo === i || indiceFoco === i) ? 1 : 0;
      pl.hover += (meta - pl.hover) * (1 - Math.pow(1 - 0.12, dt * 60));
      const h = suave(pl.hover);
      pl.escala.scale.setScalar(1 + 0.06 * h);
      pl.malla.rotation.y += pl.giro * (1 + 1.8 * h) * dt * lento;
      if (pl.nubes) pl.nubes.rotation.y += pl.giro * 1.35 * (1 + 1.8 * h) * dt * lento;
      pl.halo.material.opacity = 0.75 * h;
    });
  }
  anillos.forEach(({ an, malla, radio }) => {
    const u = an.material.uniforms;
    malla.getWorldPosition(_c);
    u.uCentro.value.copy(_c);
    u.uRadio.value = radio * malla.getWorldScale(v3b).x;
    u.uLuz.value.copy(luzSol.position);
    u.uEncendido.value = sistema.visible ? 1 : luzSol.intensity / 3.6;
  });
}

/* ==========================================================================
   10. SCROLL Y BUCLE PRINCIPAL
   ========================================================================== */
const progresoReal = () => {
  if (calma) return 1;
  const alto = viaje.offsetHeight - escena.offsetHeight;
  const arriba = marcoAlto ? viaje.offsetTop - window.__vista.top : viaje.getBoundingClientRect().top;
  return alto > 0 ? limitar(-arriba / alto) : 0;
};
const yDe = (p) => viaje.offsetTop + p * (viaje.offsetHeight - escena.offsetHeight);

let sucio = true, corriendo = false, antes = performance.now(), progreso = progresoReal(), cuadro = 0;
function bucle(t) {
  if (!corriendo) return;
  cuadro = requestAnimationFrame(bucle);
  if (lenis) lenis.raf(t);
  const dt = Math.min(0.05, (t - antes) / 1000); antes = t;
  if (marcoAlto) {                                    // la escena sigue a la parte visible
    const tope = limitar(window.__vista.top - viaje.offsetTop, 0, viaje.offsetHeight - escena.offsetHeight);
    escena.style.transform = 'translate3d(0,' + tope.toFixed(1) + 'px,0)';
  }
  const meta = progresoReal();
  const dif = meta - progreso;
  progreso = Math.abs(dif) < 0.00005 ? meta : progreso + dif * (1 - Math.pow(1 - 0.1, dt * 60));   // lerp suave
  estrellas.u.uTiempo.value = calma ? 0 : t / 1000;
  aplicar(progreso, dt);
  animarTiempo(dt);
  lanzarRayo();
  if (destinos.visible) colocarEnlaces();
  composer.render(dt);
}
function iniciar() { if (corriendo) return; corriendo = true; antes = performance.now(); cuadro = requestAnimationFrame(bucle); }
function detener() { corriendo = false; cancelAnimationFrame(cuadro); }
document.addEventListener('visibilitychange', () => (document.hidden ? detener() : iniciar()));

/* ==========================================================================
   11. ARRANQUE
   ========================================================================== */
if (!calma && !marcoAlto && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.stop();
}

// Enlaces internos (planetas, marca) con scroll suave y foco en el destino
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const destino = id && document.getElementById(id);
  if (!destino) return;
  ev.preventDefault();
  const enfocar = () => {
    if (id === 'inicio') return;
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1');
    destino.focus({ preventScroll: true });
  };
  if (lenis) lenis.scrollTo(id === 'inicio' ? 0 : destino, { duration: 1.6, onComplete: enfocar });
  else {
    if (id === 'inicio') window.scrollTo({ top: 0, behavior: calma ? 'auto' : 'smooth' });
    else destino.scrollIntoView({ behavior: calma ? 'auto' : 'smooth' });
    enfocar();
  }
  try { history.replaceState(null, '', '#' + id); } catch (e) {}
});

// Teclado: al enfocar un planeta antes del 70 %, la página viaja hasta los botones
enlaces.forEach((a, i) => {
  a.addEventListener('focus', () => {
    indiceFoco = i;
    if (!calma && progresoReal() < P.botones) {
      const y = yDe(0.8);
      lenis ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
    }
  });
  a.addEventListener('blur', () => { if (indiceFoco === i) indiceFoco = -1; });
});

// Visor de fotos y año
(function extras() {
  const visor = document.getElementById('visor');
  const visorImg = document.getElementById('visor-img');
  document.querySelectorAll('.obra').forEach((b) => b.addEventListener('click', () => {
    const img = b.querySelector('img');
    visorImg.src = b.dataset.grande; visorImg.alt = img.alt;
    if (visor.showModal) visor.showModal();
  }));
  document.getElementById('visor-cerrar').addEventListener('click', () => visor.close());
  visor.addEventListener('click', (e) => { if (e.target === visor) visor.close(); });
  const anio = document.getElementById('anio');
  if (anio) anio.textContent = new Date().getFullYear();
})();

(async function arrancar() {
  const T = await cargarTexturas((f) => { barra.style.transform = 'scaleX(' + f.toFixed(3) + ')'; });
  construir(T);
  medir();
  if ('ResizeObserver' in window) new ResizeObserver(medir).observe(escena);
  else window.addEventListener('resize', medir);
  progreso = progresoReal();
  aplicar(progreso, 0);
  animarTiempo(0);
  try { renderer.compile(mundo, camara); } catch (e) {}
  composer.render(0);
  setTimeout(() => quitarCarga(false), 200);
  iniciar();
})();
