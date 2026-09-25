/* ============================================================================
   obelisco3d.js — El Obelisco de Barquisimeto en 3D (Three.js)
   ----------------------------------------------------------------------------
   ¿Qué hace este archivo?
     1. Modela el Obelisco con código: torre de concreto de sección CUADRADA
        que se afina hacia arriba, basamento escalonado de 3 niveles, franjas
        verticales de ventanas con luz cálida, losa-mirador cerca de la
        cúspide, remate piramidal y reloj.
     2. Lo viste de atardecer: cielo crepuscular, sol bajo, niebla cálida,
        plaza oscura y un baño de luz verde como el de la foto nocturna real.
     3. La cámara la dirige el scroll (main.js llama a update(p)): empieza
        en CONTRAPICADA baja (monumental) y sube orbitando levemente.
     4. Cuida el rendimiento: pixel ratio limitado, tono cinematográfico y
        pausa del render cuando la sección no está en pantalla.

   Contrato (igual que flor3d.js y manto3d.js):
     · Módulo ES que importa 'three' y OrbitControls (importmap en index.html).
     · Busca su canvas #obelisco-canvas dentro de #obelisco3d-escena.
       Sin WebGL muestra #obelisco3d-error y no revienta la página.
     · Expone window.__obelisco3d = { update(p, dt), resize }.
     · update(p): p = progreso del scroll 0..1. La pose se deriva de p
       de forma idempotente (sin acumular). dt se ignora: el micro-movimiento
       usa el reloj propio del módulo.
     · Rende rAF propio que SOLO dibuja cuando el contenedor es visible
       y el documento está visible.
   ============================================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------- 1. CONFIGURACIÓN ------------------------- */
const ID_CONTENEDOR = 'obelisco3d-escena';
const ID_CANVAS = 'obelisco-canvas';
const ID_ERROR = 'obelisco3d-error';

const contenedor = document.getElementById(ID_CONTENEDOR);
const canvas = document.getElementById(ID_CANVAS);

function mostrarError() {
  const d = document.getElementById(ID_ERROR);
  if (d) d.classList.replace('hidden', 'flex');
}
if (!contenedor || !canvas) {
  mostrarError();
  throw new Error('[obelisco3d] No se encontró el contenedor o el canvas.');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  // Sin WebGL no hay 3D: mostramos el mensaje de respaldo del HTML.
  mostrarError();
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping; // look cinematográfico
renderer.toneMappingExposure = 1.1;

/* ------------------------- 2. ESCENA BASE ------------------------- */
const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0x3a2418, 30, 120); // el horizonte naranja se traga la distancia

const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
camara.position.set(0, 2, 26);

const controles = new OrbitControls(camara, renderer.domElement);
controles.target.set(0, 10, 0);
controles.enableDamping = true;
controles.dampingFactor = 0.06;
controles.minDistance = 8;
controles.maxDistance = 60;
controles.maxPolarAngle = 1.52; // no deja pasar la cámara bajo la plaza
controles.autoRotate = false;   // la cámara la dirige el scroll

/* ------------------------- 3. CIELO CREPUSCULAR ------------------------- */
// Domo invertido con degradado: noche cerrada arriba, naranja quemado al horizonte.
function crearCielo(radio) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      arriba: { value: new THREE.Color(0x0b0b1a) },
      horizonte: { value: new THREE.Color(0xff9a56) },
      abajo: { value: new THREE.Color(0x07070d) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 arriba; uniform vec3 horizonte; uniform vec3 abajo;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = h >= 0.0
          ? mix(horizonte, arriba, smoothstep(0.0, 0.55, h))
          : mix(horizonte, abajo, smoothstep(0.0, -0.25, h));
        // Resplandor del sol bajo, hacia -Z
        float sol = pow(max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), vec3(0.0, 0.0, -1.0))), 6.0)
                  * (1.0 - smoothstep(0.0, 0.35, abs(h)));
        col += vec3(1.0, 0.55, 0.25) * sol * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(radio, 32, 20), mat);
  escena.add(cielo);
  return cielo;
}
crearCielo(220);

// Sol: disco emisivo bajo en el horizonte (no lo afecta la niebla)
const sol = new THREE.Mesh(
  new THREE.CircleGeometry(7, 40),
  new THREE.MeshBasicMaterial({ color: 0xffc37a, fog: false })
);
sol.position.set(-28, 9, -120);
sol.lookAt(0, 9, 0);
escena.add(sol);

/* ------------------------- 4. LUCES ------------------------- */
escena.add(new THREE.HemisphereLight(0x5a5a8a, 0x141010, 0.5)); // cielo azulado / suelo oscuro

const poniente = new THREE.DirectionalLight(0xff9a56, 2.2); // sol de atardecer
poniente.position.set(-18, 14, -30);
escena.add(poniente);

const relleno = new THREE.DirectionalLight(0x8a7bb0, 0.45); // relleno frío frontal
relleno.position.set(10, 12, 28);
escena.add(relleno);

// Baño verde nocturno como el de la foto real del Obelisco
const verdeNocturno = new THREE.PointLight(0x35d97a, 90, 55, 2);
verdeNocturno.position.set(7, 5, 11);
escena.add(verdeNocturno);

/* ------------------------- 5. PLAZA Y LUCES DE CIUDAD ------------------------- */
const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(60, 64),
  new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.95 })
);
plaza.rotation.x = -Math.PI / 2;
escena.add(plaza);

// Puntitos de luz de la ciudad alrededor (como las avenidas de la foto)
const geoLuzCiudad = new THREE.SphereGeometry(0.22, 8, 8);
const matLuzCiudad = new THREE.MeshBasicMaterial({ color: 0xffa64d });
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2 + 0.2;
  const r = 30 + (i % 3) * 5;
  const luz = new THREE.Mesh(geoLuzCiudad, matLuzCiudad);
  luz.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
  escena.add(luz);
}

/* ------------------------- 6. EL OBELISCO ------------------------- */
const RADIO_INF = 2.6;   // "radio" (centro→vértice) en la base de la torre
const RADIO_SUP = 1.6;   // "radio" en la cúspide: se afina hacia arriba
const ALT_BASE = 3.6;    // la torre nace sobre el basamento
const ALT_TORRE = 30;    // altura de la torre

const obelisco = new THREE.Group();
escena.add(obelisco);

const concreto = new THREE.MeshStandardMaterial({
  color: 0xb9b3a6, roughness: 0.85, metalness: 0.05,
});

// — Basamento escalonado: 3 niveles cuadrados —
[[9.5, 1.2, 0.6], [7.2, 1.2, 1.8], [5.6, 1.2, 3.0]].forEach(([lado, alto, y]) => {
  const nivel = new THREE.Mesh(new THREE.BoxGeometry(lado, alto, lado), concreto);
  nivel.position.y = y;
  obelisco.add(nivel);
});

// — Torre: prisma de 4 lados (CylinderGeometry con 4 segmentos), rotada para
//   que las caras planas miren a los ejes (como el Obelisco real) —
const torre = new THREE.Mesh(
  new THREE.CylinderGeometry(RADIO_SUP, RADIO_INF, ALT_TORRE, 4, 1),
  concreto
);
torre.rotation.y = -Math.PI / 4;
torre.position.y = ALT_BASE + ALT_TORRE / 2;
obelisco.add(torre);

// — Franjas verticales de ventanas con luz cálida en las 4 caras —
//   El apotema (centro→cara) se interpola con la altura porque la torre se afina.
const geoVentana = new THREE.PlaneGeometry(0.55, 0.95);
const matVentana = new THREE.MeshStandardMaterial({
  color: 0x201408, emissive: 0xffb85c, emissiveIntensity: 2.4,
});
for (let cara = 0; cara < 4; cara++) {
  const a = (cara * Math.PI) / 2; // caras hacia ±X, ±Z
  for (let k = 0; k < 6; k++) {
    const y = 8 + k * 3.6;
    const r = THREE.MathUtils.lerp(RADIO_INF, RADIO_SUP, (y - ALT_BASE) / ALT_TORRE) * Math.SQRT1_2 + 0.05;
    const ventana = new THREE.Mesh(geoVentana, matVentana);
    ventana.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    ventana.lookAt(Math.cos(a) * (r + 5), y, Math.sin(a) * (r + 5));
    obelisco.add(ventana);
  }
}

// — Reloj cerca de la cúspide (como el de la foto) —
const yReloj = 30.2;
const rReloj = THREE.MathUtils.lerp(RADIO_INF, RADIO_SUP, (yReloj - ALT_BASE) / ALT_TORRE) * Math.SQRT1_2 + 0.06;
const relojCara = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.78, 32),
  new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffe0b0, emissiveIntensity: 1.8, side: THREE.DoubleSide })
);
relojCara.position.set(0, yReloj, rReloj);
obelisco.add(relojCara);

// — Losa-mirador: un poco más ancha, cerca de la cúspide —
const mirador = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 4.6), concreto);
mirador.position.y = 31.6;
obelisco.add(mirador);

// — Remate piramidal pequeño (cono de 4 lados) —
const remate = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.0, 4), concreto);
remate.rotation.y = -Math.PI / 4;
remate.position.y = ALT_BASE + ALT_TORRE + 1.0;
obelisco.add(remate);

/* ------------------------- 7. CONTROL POR SCROLL + LOOP ------------------------- */
const reloj = new THREE.Clock();
let ultimaP = 0;   // último progreso de scroll recibido (0..1)
let visible = true;

// update(p): main.js la llama con el scrub del scroll. La pose de la cámara
// se deriva SOLO de p (idempotente): empieza en contrapicada baja y monumental
// (y≈2, radio≈26, mirando a y≈10) y sube orbitando (y≈24, radio≈20,
// azimut −0.5→0.6, mirando a y≈20).
function update(p) {
  ultimaP = THREE.MathUtils.clamp(p || 0, 0, 1);
}

function aplicarPoseCamara(pe, t) {
  const az = THREE.MathUtils.lerp(-0.5, 0.6, pe);
  const radio = THREE.MathUtils.lerp(26, 20, pe);
  const y = THREE.MathUtils.lerp(2, 24, pe) + Math.sin(t * 0.5) * 0.15; // respiración leve
  const lookY = THREE.MathUtils.lerp(10, 20, pe);
  camara.position.set(radio * Math.sin(az), y, radio * Math.cos(az));
  controles.target.set(0, lookY, 0);
}

function tick() {
  requestAnimationFrame(tick);
  // Pausa total cuando la sección no está en pantalla (rendimiento)
  if (!visible || document.hidden) return;

  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = reloj.elapsedTime;
  void dt;

  aplicarPoseCamara(THREE.MathUtils.smootherstep(ultimaP, 0, 1), t);

  // Micro-movimiento: el baño verde "respira" como la iluminación real
  verdeNocturno.intensity = 90 + Math.sin(t * 1.1) * 12;

  controles.update();
  renderer.render(escena, camara);
}

/* ------------------------- 8. TAMAÑO Y VISIBILIDAD ------------------------- */
function resize() {
  const w = contenedor.clientWidth;
  const h = contenedor.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camara.aspect = w / h;
  camara.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Pausar cuando la sección sale de la pantalla
new IntersectionObserver((entradas) => {
  visible = entradas[0].isIntersecting;
}, { threshold: 0.05 }).observe(contenedor);

window.__obelisco3d = { update, resize };

tick();
