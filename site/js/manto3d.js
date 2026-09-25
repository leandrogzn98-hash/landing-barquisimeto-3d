/* ============================================================================
   manto3d.js — El Manto de María (Divina Pastora) en 3D (Three.js)
   ----------------------------------------------------------------------------
   Fiel a la foto de referencia del monumento real: una escultura CINÉTICA
   de miles de tubos de acero OSCUROS colgando entre dos torres, que forma
   la imagen de la Virgen de 47 × 23 m. La imagen "se arma y se desarma
   según desde dónde la mires": de frente se lee la Virgen, de lado es un
   bosque de tubos.

   Rasgos distintivos de la foto:
     · DOS TORRES de concreto GRIS, rectangulares, con leve afine y franjas
       verticales de ventanitas.
     · VIGA ROJA de acero en CELOSÍA uniendo las torres arriba (cordones +
       montantes + diagonales en zigzag bien visibles).
     · CORTINA DE TUBOS OSCUROS colgando bajo la viga: cabeza redondeada
       arriba al centro y manto acampanado que ensancha hacia abajo (los
       tubos más largos van al centro, donde el manto cae más).
     · Loma VERDE con línea de BARANDA al frente.
     · Los tubos se balancean apenas, como colgados al viento.

   ¿Cómo se logra?
     1. La silueta de la Virgen (círculo de cabeza + trapecio de manto) se
        dibuja con Canvas 2D en un lienzo oculto de 180×88 px.
     2. El brillo de cada píxel → LONGITUD del tubo que cuelga en ese punto.
     3. Los ~3.960 tubos se dibujan con UN SOLO InstancedMesh (una llamada).
     4. El balanceo se hace con dos grupos anidados en fases distintas
        (barato: no se tocan las instancias por cuadro).

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

if (window.__3dDiag) window.__3dDiag.marks.manto = 'init';

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
if (window.__3dDiag) window.__3dDiag.marks.manto = 'renderer-ok';
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

/* ------------------------- 2. ESCENA BASE ------------------------- */
const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0x3a2418, 40, 140);

const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
camara.position.set(30 * Math.sin(1.22), 12, 30 * Math.cos(1.22));

const controles = new OrbitControls(camara, renderer.domElement);
controles.target.set(0, 14, 0);
controles.enableDamping = true;
controles.dampingFactor = 0.06;
controles.minDistance = 10;
controles.maxDistance = 70;
controles.maxPolarAngle = 1.52;
controles.autoRotate = false;

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

const relleno = new THREE.DirectionalLight(0x8a7bb0, 0.35);
relleno.position.set(0, 18, 40);
escena.add(relleno);

// Resplandor cálido tras la cortina: dibuja el filo de los tubos oscuros
const filoCalido = new THREE.PointLight(0xff9a4d, 60, 40, 2);
filoCalido.position.set(0, 22, -6);
escena.add(filoCalido);

/* ------------------------- 5. SUELO, LOMA VERDE Y BARANDA ------------------------- */
const suelo = new THREE.Mesh(
  new THREE.CircleGeometry(95, 48),
  new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.95 })
);
suelo.rotation.x = -Math.PI / 2;
escena.add(suelo);

// La loma verde sobre la que se alza el monumento real
const loma = new THREE.Mesh(
  new THREE.SphereGeometry(34, 32, 16),
  new THREE.MeshStandardMaterial({ color: 0x3d6b38, roughness: 0.9 })
);
loma.scale.y = 0.07;
loma.position.y = -0.6;
escena.add(loma);

// Línea de baranda al frente de la loma (como en la foto)
{
  const matBaranda = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.7, roughness: 0.5 });
  const baranda = new THREE.Group();
  const R = 27;
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const a = Math.PI * 0.22 + (i / N) * Math.PI * 0.56; // arco frontal
    const x = Math.sin(a) * R;
    const z = Math.cos(a) * R;
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), matBaranda);
    poste.position.set(x, 1.6, z);
    baranda.add(poste);
  }
  const riel = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 6, 64, Math.PI * 0.56), matBaranda);
  riel.rotation.x = -Math.PI / 2;
  riel.rotation.z = Math.PI * 0.22;
  riel.position.y = 2.15;
  baranda.add(riel);
  escena.add(baranda);
}

/* ------------------------- 6. TORRES DE CONCRETO GRIS ------------------------- */
const ALT_TORRE = 40;
const X_TORRE = 24;
const concretoGris = new THREE.MeshStandardMaterial({ color: 0x8f8f8f, roughness: 0.9, metalness: 0.02 });

function apotemaEn(y) {
  // Las torres se afinan apenas: apotema (centro→cara) según la altura
  return THREE.MathUtils.lerp(2.1, 1.9, y / ALT_TORRE) * Math.SQRT1_2;
}

for (const lado of [-1, 1]) {
  // Prisma cuadrado de 4 lados con leve afine (rotado: caras a los ejes)
  const torre = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 1.9, ALT_TORRE, 4, 1),
    concretoGris
  );
  torre.rotation.y = -Math.PI / 4;
  torre.position.set(lado * X_TORRE, ALT_TORRE / 2, 0);
  escena.add(torre);

  // Franja vertical de ventanitas en la cara frontal (como la foto)
  const matVent = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.5 });
  for (let k = 0; k < 10; k++) {
    const y = 6 + k * 3.1;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), matVent);
    v.position.set(lado * X_TORRE, y, apotemaEn(y) + 0.03);
    escena.add(v);
  }
}

/* ------------------------- 7. VIGA ROJA EN CELOSÍA ------------------------- */
const aceroRojo = new THREE.MeshStandardMaterial({ color: 0xa52818, metalness: 0.55, roughness: 0.5 });
const viga = new THREE.Group();
const Y_VIGA_INF = 35.6;
const Y_VIGA_SUP = 38.6;
const ANCHO_VIGA = 52;

const cordonSup = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_VIGA, 1.2, 1.6), aceroRojo);
cordonSup.position.y = Y_VIGA_SUP;
const cordonInf = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_VIGA, 1.2, 1.6), aceroRojo);
cordonInf.position.y = Y_VIGA_INF;
viga.add(cordonSup, cordonInf);

// Montantes verticales + diagonales en zigzag (la celosía de la foto)
for (let x = -ANCHO_VIGA / 2 + 2; x <= ANCHO_VIGA / 2 - 2; x += 4) {
  const montante = new THREE.Mesh(new THREE.BoxGeometry(0.4, Y_VIGA_SUP - Y_VIGA_INF, 0.4), aceroRojo);
  montante.position.set(x, (Y_VIGA_SUP + Y_VIGA_INF) / 2, 0);
  viga.add(montante);
  const diagonal = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, (Y_VIGA_SUP - Y_VIGA_INF) * 1.45, 0.32),
    aceroRojo
  );
  diagonal.position.set(x + 2, (Y_VIGA_SUP + Y_VIGA_INF) / 2, 0);
  diagonal.rotation.z = (Math.round(x / 4) % 2 === 0 ? 1 : -1) * 0.62; // zigzag
  viga.add(diagonal);
}
// Postes de apoyo sobre cada torre
for (const lado of [-1, 1]) {
  const poste = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.4, 1.6), aceroRojo);
  poste.position.set(lado * X_TORRE, ALT_TORRE + 1.2, 0);
  viga.add(poste);
}
escena.add(viga);

/* ------------------------- 8. LA CORTINA DE TUBOS ------------------------- */
// 8.1 Silueta de la Virgen: CÍRCULO de cabeza arriba al centro + TRAPECIO
//     de manto que ensancha hacia abajo. Dibujada en un lienzo oculto;
//     el brillo de cada píxel → longitud del tubo en ese punto.
function crearMapaSilueta() {
  const W = 180, H = 88;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);

  // Manto: trapecio acampanado — hombros estrechos arriba, falda ancha abajo.
  // El centro es más brillante (tubos más largos: el manto cae más al centro).
  const gradManto = g.createLinearGradient(30, 0, 150, 0);
  gradManto.addColorStop(0, '#4a4a4a');
  gradManto.addColorStop(0.5, '#e8e8e8');
  gradManto.addColorStop(1, '#4a4a4a');
  g.fillStyle = gradManto;
  g.beginPath();
  g.moveTo(58, 30);          // hombro izquierdo
  g.lineTo(122, 30);         // hombro derecho
  g.quadraticCurveTo(140, 55, 152, H);  // costado derecho → falda
  g.lineTo(28, H);           // falda
  g.quadraticCurveTo(40, 55, 58, 30);   // costado izquierdo
  g.closePath();
  g.fill();

  // Pliegues del manto: franjas verticales suaves (los tubos caen en pliegues)
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (let x = 44; x < 140; x += 16) {
    g.fillRect(x, 34, 5, H - 34);
  }

  // Túnica interior, más clara al centro
  const gradTunica = g.createLinearGradient(70, 0, 110, 0);
  gradTunica.addColorStop(0, 'rgba(120,120,120,0.85)');
  gradTunica.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  gradTunica.addColorStop(1, 'rgba(120,120,120,0.85)');
  g.fillStyle = gradTunica;
  g.beginPath();
  g.moveTo(74, 34);
  g.lineTo(106, 34);
  g.lineTo(118, H);
  g.lineTo(62, H);
  g.closePath();
  g.fill();

  // Cabeza: círculo luminoso arriba al centro (sugiere el rostro, sin facciones)
  const gradCabeza = g.createRadialGradient(90, 14, 1, 90, 14, 13);
  gradCabeza.addColorStop(0, '#ffffff');
  gradCabeza.addColorStop(1, '#d8d8d8');
  g.fillStyle = gradCabeza;
  g.beginPath();
  g.arc(90, 14, 12, 0, Math.PI * 2);
  g.fill();

  // Velo sobre la cabeza: arco que baja a los hombros
  g.strokeStyle = 'rgba(200,200,200,0.8)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(90, 16, 17, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();

  return g.getImageData(0, 0, W, H);
}

// 8.2 Retícula de tubos: 90 columnas × 44 filas ≈ 3.960 (≈ las 3.772 reales).
//     Tubos OSCUROS (como la foto), colgando con la parte superior alineada;
//     la longitud varía con el brillo de la silueta. De frente se lee la
//     Virgen; de lado, un bosque de líneas verticales.
const COLS = 90, ROWS = 44;
const ANCHO_IMAGEN = 38, ALTO_IMAGEN = 22, Y_SUPERIOR = 33;

const balanceoExterno = new THREE.Group(); // balanceo lento general
const balanceoInterno = new THREE.Group();  // balanceo en contrafase (brisa)
escena.add(balanceoExterno);
balanceoExterno.add(balanceoInterno);

{
  const datos = crearMapaSilueta().data;
  const geoTubo = new THREE.CylinderGeometry(0.1, 0.1, 1, 6, 1);
  const matTubo = new THREE.MeshStandardMaterial({
    color: 0x2f3338, metalness: 0.75, roughness: 0.45, // tubos oscuros como la foto
    emissive: 0x3a2412, emissiveIntensity: 0.5,        // nunca negros del todo
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
      const L = 0.1 + brillo * 3.1; // fondo = casi nada; silueta = tubo largo
      const x = -ANCHO_IMAGEN / 2 + ((i + 0.5) / COLS) * ANCHO_IMAGEN;
      const ySup = Y_SUPERIOR - ((j + 0.5) / ROWS) * ALTO_IMAGEN;
      dummy.position.set(x, ySup - L / 2, (Math.random() - 0.5) * 0.1);
      dummy.scale.set(1, L, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      tubos.setMatrixAt(idx++, dummy.matrix);
    }
  }
  tubos.instanceMatrix.needsUpdate = true;
  balanceoInterno.add(tubos);
}

/* ------------------------- 9. CONTROL POR SCROLL + LOOP ------------------------- */
const reloj = new THREE.Clock();
let ultimaP = 0;
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

  // Balanceo: los tubos cuelgan y se mueven apenas, en dos fases distintas
  balanceoExterno.rotation.z = Math.sin(t * 0.4) * 0.006;
  balanceoInterno.rotation.x = Math.cos(t * 0.55) * 0.005;
  balanceoInterno.rotation.z = Math.sin(t * 0.47 + 1.3) * 0.004;
}

function tick() {
  requestAnimationFrame(tick);
  if (!visible || document.hidden) return;

  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = reloj.elapsedTime;
  void dt;

  aplicarPoseCamara(THREE.MathUtils.smootherstep(ultimaP, 0, 1), t);

  controles.update();
  renderer.render(escena, camara);
  if (window.__3dDiag && !window.__3dDiag.marks.mantoFirstFrame) { window.__3dDiag.marks.mantoFirstFrame = 'first-frame'; }
  if (window.__3dDiag) window.__3dDiag.marks.mantoFrames = (window.__3dDiag.marks.mantoFrames || 0) + 1;
}

/* ------------------------- 10. TAMAÑO Y VISIBILIDAD ------------------------- */
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

new IntersectionObserver((entradas) => {
  visible = entradas[0].isIntersecting;
}, { threshold: 0.05 }).observe(contenedor);

window.__manto3d = { update, resize };

tick();
