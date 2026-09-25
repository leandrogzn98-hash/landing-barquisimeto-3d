/* ============================================================================
   manto3d.js — El Manto de María (Divina Pastora) en 3D (Three.js)
   ----------------------------------------------------------------------------
   Fiel al monumento real: una escultura CINÉTICA de ~3.772 piezas de tubos
   de acero en 522 líneas verticales, suspendidas entre dos torres, que forma
   una imagen de la Virgen de 47 × 23 m. La imagen "se arma y se desarma
   según desde dónde la mires": de frente se lee la Virgen, de lado es un
   bosque de tubos.

   ¿Cómo se logra aquí?
     1. Se dibuja la silueta de la Virgen con manto (campana + óvalo de la
        cabeza) con la API de Canvas 2D en un lienzo oculto de 180×88 px.
     2. Se muestrean los píxeles: el brillo de cada punto se convierte en la
        LONGITUD de un tubo de acero que cuelga en ese punto.
     3. Los ~3.960 tubos se dibujan con UN SOLO InstancedMesh (una sola
        llamada de dibujo): barato para la GPU aunque sean miles.
     4. Dos torres de concreto enmarcan el conjunto y una viga de acero roja
        (como la real) sostiene el campo de tubos, sobre una loma verde.

   Atmósfera: cielo crepuscular, sol bajo, niebla cálida. La luz del
   atardecer recorta los tubos a contraluz en la vista frontal.

   La cámara la dirige el scroll (main.js llama a update(p)) — el momento
   estrella: p=0 → vista LATERAL (bosque abstracto, azimut ~70°);
   p=0.5 → FRONTAL (la Virgen "se arma": radio ~34, altura ~14);
   p=1 → frontal elevada con push-in (radio ~26, altura ~18).

   Contrato (igual que obelisco3d.js y flor3d.js):
     · Módulo ES: importa 'three' y OrbitControls (importmap en index.html).
     · Canvas #manto-canvas dentro de #manto3d-escena; sin WebGL muestra
       #manto3d-error y no revienta.
     · Expone window.__manto3d = { update(p, dt), resize }.
     · update(p): la pose se deriva SOLO de p (idempotente, sin acumular).
     · rAF propio que SOLO dibuja cuando el contenedor es visible.
   ============================================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------- 1. CONFIGURACIÓN ------------------------- */
const ID_CONTENEDOR = 'manto3d-escena';
const ID_CANVAS = 'manto-canvas';
const ID_ERROR = 'manto3d-error';

const contenedor = document.getElementById(ID_CONTENEDOR);
const canvas = document.getElementById(ID_CANVAS);

function mostrarError() {
  const d = document.getElementById(ID_ERROR);
  if (d) d.classList.replace('hidden', 'flex');
}
if (!contenedor || !canvas) {
  mostrarError();
  throw new Error('[manto3d] No se encontró el contenedor o el canvas.');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  mostrarError();
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

/* ------------------------- 2. ESCENA BASE ------------------------- */
const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0x3a2418, 40, 130);

const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
camara.position.set(30 * Math.sin(1.22), 12, 30 * Math.cos(1.22));

const controles = new OrbitControls(camara, renderer.domElement);
controles.target.set(0, 14, 0);
controles.enableDamping = true;
controles.dampingFactor = 0.06;
controles.minDistance = 10;
controles.maxDistance = 70;
controles.maxPolarAngle = 1.52;
controles.autoRotate = false; // la cámara la dirige el scroll

/* ------------------------- 3. CIELO CREPUSCULAR ------------------------- */
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
        float sol = pow(max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), vec3(0.0, 0.0, -1.0))), 6.0)
                  * (1.0 - smoothstep(0.0, 0.35, abs(h)));
        col += vec3(1.0, 0.55, 0.25) * sol * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  escena.add(new THREE.Mesh(new THREE.SphereGeometry(radio, 32, 20), mat));
}
crearCielo(240);

// Sol bajo hacia -Z (los tubos quedarán a contraluz desde el frente)
const sol = new THREE.Mesh(
  new THREE.CircleGeometry(6, 40),
  new THREE.MeshBasicMaterial({ color: 0xffc37a, fog: false })
);
sol.position.set(-30, 10, -110);
sol.lookAt(0, 10, 0);
escena.add(sol);

/* ------------------------- 4. LUCES ------------------------- */
escena.add(new THREE.HemisphereLight(0x5a5a8a, 0x141010, 0.5));

// Atardecer POR DETRÁS de la escultura: recorta los tubos a contraluz
const contraluz = new THREE.DirectionalLight(0xff9a56, 2.6);
contraluz.position.set(-12, 16, -34);
contraluz.target.position.set(0, 15, 0);
escena.add(contraluz, contraluz.target);

const relleno = new THREE.DirectionalLight(0x8a7bb0, 0.35); // relleno frío frontal
relleno.position.set(0, 18, 40);
escena.add(relleno);

/* ------------------------- 5. SUELO Y LOMA VERDE ------------------------- */
const suelo = new THREE.Mesh(
  new THREE.CircleGeometry(90, 48),
  new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.95 })
);
suelo.rotation.x = -Math.PI / 2;
escena.add(suelo);

// La loma verde sobre la que se alza el monumento real
const loma = new THREE.Mesh(
  new THREE.SphereGeometry(34, 32, 16),
  new THREE.MeshStandardMaterial({ color: 0x3d6b38, roughness: 0.9 })
);
loma.scale.y = 0.06;
loma.position.y = -0.5;
escena.add(loma);

/* ------------------------- 6. TORRES Y VIGA ROJA ------------------------- */
const concreto = new THREE.MeshStandardMaterial({ color: 0x35353c, roughness: 0.9 });
for (const lado of [-1, 1]) {
  const torre = new THREE.Mesh(new THREE.BoxGeometry(3.4, 38, 4.5), concreto);
  torre.position.set(lado * 23.5, 19, 0);
  escena.add(torre);
}

// Estructura superior de acero rojo (como la del monumento real)
const aceroRojo = new THREE.MeshStandardMaterial({ color: 0x7e2a1e, metalness: 0.6, roughness: 0.5 });
const viga = new THREE.Group();
const cordonSup = new THREE.Mesh(new THREE.BoxGeometry(51, 1.1, 1.4), aceroRojo);
cordonSup.position.y = 36.5;
const cordonInf = new THREE.Mesh(new THREE.BoxGeometry(51, 1.1, 1.4), aceroRojo);
cordonInf.position.y = 33.8;
viga.add(cordonSup, cordonInf);
for (let x = -24; x <= 24; x += 4) {
  const montante = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.7, 0.35), aceroRojo);
  montante.position.set(x, 35.15, 0);
  viga.add(montante);
  const diagonal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 0.3), aceroRojo);
  diagonal.position.set(x + 2, 35.15, 0);
  diagonal.rotation.z = 0.85 * (x % 8 === 0 ? 1 : -1);
  viga.add(diagonal);
}
escena.add(viga);

/* ------------------------- 7. EL CAMPO DE TUBOS ------------------------- */
// 7.1 Silueta de la Virgen con manto, dibujada en un lienzo oculto.
//     El brillo de cada píxel → longitud del tubo en ese punto.
function crearMapaSilueta() {
  const W = 180, H = 88;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);

  // Campana del manto: falda ancha abajo, hombros y cuello arriba
  const gradManto = g.createLinearGradient(0, 20, 0, H);
  gradManto.addColorStop(0, '#dedede');
  gradManto.addColorStop(0.55, '#8f8f8f');
  gradManto.addColorStop(1, '#3f3f3f');
  g.fillStyle = gradManto;
  g.beginPath();
  g.moveTo(14, H);
  g.bezierCurveTo(22, 62, 40, 48, 58, 38);    // falda izquierda → hombro izq
  g.bezierCurveTo(68, 32, 73, 28, 75, 24);    // → cuello izq
  g.lineTo(105, 24);                           // cuello
  g.bezierCurveTo(107, 28, 112, 32, 122, 38); // cuello der → hombro der
  g.bezierCurveTo(140, 48, 158, 62, 166, H);   // → falda derecha
  g.closePath();
  g.fill();

  // Túnica interior, más clara al centro
  const gradTunica = g.createLinearGradient(0, 30, 0, H);
  gradTunica.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradTunica.addColorStop(1, 'rgba(150,150,150,0.9)');
  g.fillStyle = gradTunica;
  g.beginPath();
  g.moveTo(70, H);
  g.bezierCurveTo(74, 60, 78, 45, 84, 34);
  g.lineTo(96, 34);
  g.bezierCurveTo(102, 45, 106, 60, 110, H);
  g.closePath();
  g.fill();

  // Cabeza: óvalo luminoso arriba al centro (sugiere el rostro, sin facciones)
  const gradCabeza = g.createRadialGradient(90, 13, 1, 90, 13, 12);
  gradCabeza.addColorStop(0, '#ffffff');
  gradCabeza.addColorStop(1, '#cfcfcf');
  g.fillStyle = gradCabeza;
  g.beginPath();
  g.ellipse(90, 13, 8.5, 11, 0, 0, Math.PI * 2);
  g.fill();

  return g.getImageData(0, 0, W, H);
}

// 7.2 Retícula de tubos: 90 columnas × 44 filas ≈ 3.960 (≈ las 3.772 reales).
//     Cada tubo CUELGA: la parte de arriba está alineada por filas y la
//     longitud varía con el brillo de la silueta. De frente se lee la Virgen;
//     de lado, un bosque de líneas verticales.
const COLS = 90, ROWS = 44;
const ANCHO_IMAGEN = 38, ALTO_IMAGEN = 20, Y_SUPERIOR = 30;

const campoTubos = new THREE.Group();
escena.add(campoTubos);

{
  const datos = crearMapaSilueta().data;
  const geoTubo = new THREE.CylinderGeometry(0.09, 0.09, 1, 6, 1);
  const matTubo = new THREE.MeshStandardMaterial({
    color: 0xcfd4da, metalness: 0.9, roughness: 0.35,
    emissive: 0x2a1a0c, emissiveIntensity: 0.4, // nunca quedan negros del todo
  });
  const tubos = new THREE.InstancedMesh(geoTubo, matTubo, COLS * ROWS);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const px = Math.min(179, Math.floor(((i + 0.5) / COLS) * 180));
      const py = Math.min(87, Math.floor(((j + 0.5) / ROWS) * 88));
      const o = (py * 180 + px) * 4;
      const brillo = (datos[o] + datos[o + 1] + datos[o + 2]) / (3 * 255);
      const L = 0.12 + brillo * 2.4; // fondo oscuro = casi nada; silueta = tubo largo
      const x = -ANCHO_IMAGEN / 2 + ((i + 0.5) / COLS) * ANCHO_IMAGEN;
      const ySup = Y_SUPERIOR - ((j + 0.5) / ROWS) * ALTO_IMAGEN;
      dummy.position.set(x, ySup - L / 2, (Math.random() - 0.5) * 0.08);
      dummy.scale.set(1, L, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      tubos.setMatrixAt(idx++, dummy.matrix);
    }
  }
  tubos.instanceMatrix.needsUpdate = true;
  campoTubos.add(tubos);
}

/* ------------------------- 8. CONTROL POR SCROLL + LOOP ------------------------- */
const reloj = new THREE.Clock();
let ultimaP = 0;   // último progreso de scroll recibido (0..1)
let visible = true;

// update(p): main.js la llama con el scrub del scroll. La pose se deriva
// SOLO de p (idempotente): lateral → frontal → frontal elevada con push-in.
function update(p) {
  ultimaP = THREE.MathUtils.clamp(p || 0, 0, 1);
}

const AZ_LATERAL = THREE.MathUtils.degToRad(70);

function aplicarPoseCamara(pe, t) {
  let az, radio, h, lookY;
  if (pe <= 0.5) {
    const q = THREE.MathUtils.smootherstep(pe / 0.5, 0, 1);
    az = THREE.MathUtils.lerp(AZ_LATERAL, 0, q);
    radio = THREE.MathUtils.lerp(30, 34, q);
    h = THREE.MathUtils.lerp(12, 14, q);
    lookY = THREE.MathUtils.lerp(14, 15, q);
  } else {
    const q = THREE.MathUtils.smootherstep((pe - 0.5) / 0.5, 0, 1);
    az = 0;
    radio = THREE.MathUtils.lerp(34, 26, q);
    h = THREE.MathUtils.lerp(14, 18, q);
    lookY = THREE.MathUtils.lerp(15, 16, q);
  }
  camara.position.set(radio * Math.sin(az), h, radio * Math.cos(az));
  controles.target.set(0, lookY, 0);

  // Micro-movimiento: el campo "respira" apenas, como brisa entre los tubos
  campoTubos.rotation.z = Math.sin(t * 0.35) * 0.004;
  campoTubos.rotation.x = Math.cos(t * 0.28) * 0.003;
}

function tick() {
  requestAnimationFrame(tick);
  // Pausa total cuando la sección no está en pantalla (rendimiento)
  if (!visible || document.hidden) return;

  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = reloj.elapsedTime;
  void dt;

  aplicarPoseCamara(THREE.MathUtils.smootherstep(ultimaP, 0, 1), t);

  controles.update();
  renderer.render(escena, camara);
}

/* ------------------------- 9. TAMAÑO Y VISIBILIDAD ------------------------- */
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

window.__manto3d = { update, resize };

tick();
