/* ============================================================================
   flor3d.js — La Flor de Venezuela REAL en 3D (Three.js)
   ----------------------------------------------------------------------------
   Fiel a la foto aérea de referencia (monumento de Fruto Vivas):
     · 16 PÉTALOS BLANCOS tipo VELA/LONA (mate, nada de cromo): anchos en la
       base, afinando a puntas suaves y redondeadas, con curvatura de tela
       que cae hacia afuera-abajo cuando la flor está ABIERTA.
     · Debajo de los pétalos: EDIFICIO CIRCULAR DE VIDRIO con resplandor
       cálido interior (como el pabellón real).
     · Pétalos montados en brazos alrededor de una columna central clara,
       sobre plataforma circular.

   Contrato (igual que obelisco3d.js y manto3d.js):
     · Módulo ES: importa 'three' y OrbitControls (importmap en index.html).
     · Canvas #flor3d-canvas dentro de #flor3d-escena; sin WebGL muestra
       #flor3d-error y no revienta.
     · Expone window.__flor3d = { estado, TOTAL_PETALOS, setApertura,
       update(p, dt), resize }.
     · Los pétalos los mueve setApertura (main.js la llama con el scroll);
       update(p) SOLO mueve la cámara (órbita lenta con el scroll).
     · Botones #btn-abrir / #btn-cerrar y checkbox #chk-auto con el mismo
       comportamiento de siempre (modo manual vs. ciclo automático).
   ============================================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

if (window.__3dDiag) window.__3dDiag.marks.flor = 'init';

/* ------------------------- 1. CONFIGURACIÓN ------------------------- */
const ID_CONTENEDOR = 'flor3d-escena';
const ID_CANVAS = 'flor3d-canvas';
const ID_ERROR = 'flor3d-error';
const TOTAL_PETALOS = 16;          // como la Flor de Venezuela real
const ANGULO_CERRADO = -1.25;      // radianes: pétalos hacia arriba (capullo)
const ANGULO_ABIERTO = 0.55;       // radianes: desplegados cayendo afuera-abajo

// Estado de la animación (los botones de la página lo modifican)
const estado = {
  apertura: 0,        // 0 = cerrada, 1 = abierta (valor actual, suavizado)
  objetivo: 0,        // hacia dónde queremos ir
  automatico: true,   // si es true, se abre/cierra sola cada cierto tiempo
  visible: true,      // false cuando la sección sale de la pantalla (pausa)
  relojAuto: 0,       // acumulador para el ciclo automático
};

const contenedor = document.getElementById(ID_CONTENEDOR);
const canvas = document.getElementById(ID_CANVAS);

function mostrarError() {
  const d = document.getElementById(ID_ERROR);
  if (d) d.classList.replace('hidden', 'flex');
}
if (!contenedor || !canvas) {
  mostrarError();
  throw new Error('[flor3d] No se encontró el contenedor o el canvas.');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  mostrarError();
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
if (window.__3dDiag) window.__3dDiag.marks.flor = 'renderer-ok';
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

/* ------------------------- 2. ESCENA BASE ------------------------- */
const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0x3a2418, 20, 60);

const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
camara.position.set(0, 4.6, 11);

const controles = new OrbitControls(camara, renderer.domElement);
controles.target.set(0, 3.2, 0);
controles.enableDamping = true;
controles.dampingFactor = 0.06;
controles.minDistance = 5;
controles.maxDistance = 20;
controles.maxPolarAngle = 1.45;
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
crearCielo(160);

const sol = new THREE.Mesh(
  new THREE.CircleGeometry(5, 40),
  new THREE.MeshBasicMaterial({ color: 0xffc37a, fog: false })
);
sol.position.set(-20, 7, -85);
sol.lookAt(0, 7, 0);
escena.add(sol);

/* ------------------------- 4. LUCES CREPUSCULARES ------------------------- */
escena.add(new THREE.HemisphereLight(0x6f5fb0, 0x0a0a12, 0.55));

const solPoniente = new THREE.DirectionalLight(0xffb066, 2.0);
solPoniente.position.set(-6, 8, 4);
escena.add(solPoniente);

const contraluz = new THREE.DirectionalLight(0x7c5cff, 0.6);
contraluz.position.set(6, 4, -6);
escena.add(contraluz);

const corazon = new THREE.PointLight(0xffc37a, 26, 14, 2);
corazon.position.set(0, 3.4, 0);
escena.add(corazon);

/* ------------------------- 5. SUELO Y PARTÍCULAS ------------------------- */
const suelo = new THREE.Mesh(
  new THREE.CircleGeometry(45, 48),
  new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 0.95 })
);
suelo.rotation.x = -Math.PI / 2;
escena.add(suelo);

// Anillo de asfalto alrededor del monumento (la avenida de la foto aérea)
const avenida = new THREE.Mesh(
  new THREE.RingGeometry(6.2, 10.5, 64),
  new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.95 })
);
avenida.rotation.x = -Math.PI / 2;
avenida.position.y = 0.01;
escena.add(avenida);

// Polvo de luz flotando
const N_PARTICULAS = 300;
const posParticulas = new Float32Array(N_PARTICULAS * 3);
const velParticulas = new Float32Array(N_PARTICULAS);
for (let i = 0; i < N_PARTICULAS; i++) {
  const r = 3 + Math.random() * 11;
  const a = Math.random() * Math.PI * 2;
  posParticulas[i * 3] = Math.cos(a) * r;
  posParticulas[i * 3 + 1] = Math.random() * 9;
  posParticulas[i * 3 + 2] = Math.sin(a) * r;
  velParticulas[i] = 0.12 + Math.random() * 0.25;
}
const geoParticulas = new THREE.BufferGeometry();
geoParticulas.setAttribute('position', new THREE.BufferAttribute(posParticulas, 3));
const particulas = new THREE.Points(geoParticulas, new THREE.PointsMaterial({
  color: 0xffcf8f, size: 0.055, transparent: true, opacity: 0.65,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
escena.add(particulas);

/* ------------------------- 6. LA FLOR DE VENEZUELA ------------------------- */
const flor = new THREE.Group();
escena.add(flor);

const aceroClaro = new THREE.MeshStandardMaterial({
  color: 0xd8d4cc, metalness: 0.55, roughness: 0.5,
});

// — Plataforma circular —
const plataforma = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 0.35, 56), aceroClaro);
plataforma.position.y = 0.175;
flor.add(plataforma);

const anillo = new THREE.Mesh(
  new THREE.RingGeometry(4.0, 4.2, 72),
  new THREE.MeshBasicMaterial({ color: 0xf2a33c, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
);
anillo.rotation.x = -Math.PI / 2;
anillo.position.y = 0.36;
flor.add(anillo);

// — EDIFICIO CIRCULAR DE VIDRIO bajo los pétalos (el pabellón real) —
const vidrio = new THREE.MeshStandardMaterial({
  color: 0x9fc4d8, transparent: true, opacity: 0.32,
  roughness: 0.12, metalness: 0.15, side: THREE.DoubleSide,
});
const pabellon = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 1.6, 48, 1, true), vidrio);
pabellon.position.y = 0.35 + 0.8;
flor.add(pabellon);

// Resplandor cálido interior del pabellón
const interior = new THREE.Mesh(
  new THREE.CylinderGeometry(2.78, 2.78, 1.5, 48),
  new THREE.MeshStandardMaterial({
    color: 0x2a1c10, emissive: 0xffb45e, emissiveIntensity: 1.1, roughness: 0.8,
  })
);
interior.position.y = 0.35 + 0.78;
flor.add(interior);

// Montantes verticales del muro de vidrio
const montantes = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.09, 1.6, 0.09), aceroClaro, 24
);
{
  const d = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    d.position.set(Math.cos(a) * 3.0, 0.35 + 0.8, Math.sin(a) * 3.0);
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    montantes.setMatrixAt(i, d.matrix);
  }
}
flor.add(montantes);

// — Columna central clara (el "tallo" estructural) —
const ALT_COLUMNA = 3.0;
const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, ALT_COLUMNA, 24), aceroClaro);
columna.position.y = 0.35 + ALT_COLUMNA / 2;
flor.add(columna);

// — Núcleo superior (de donde nacen los brazos) —
const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), aceroClaro);
nucleo.scale.y = 0.7;
nucleo.position.y = 0.35 + ALT_COLUMNA;
flor.add(nucleo);

// — Corazón luminoso: óculo cálido en el centro de la flor —
const oculo = new THREE.Mesh(
  new THREE.CircleGeometry(0.5, 32),
  new THREE.MeshStandardMaterial({
    color: 0xffd9a0, emissive: 0xff9a2e, emissiveIntensity: 2.2, side: THREE.DoubleSide,
  })
);
oculo.rotation.x = -Math.PI / 2;
oculo.position.y = 0.35 + ALT_COLUMNA + 0.42;
flor.add(oculo);

/* ----- 6.1 Geometría del pétalo de VELA (una sola, reutilizada 16 veces) -----
   Ancho en la base, afinando a punta SUAVE y redondeada; curvatura de tela:
   la punta cae hacia abajo (flor abierta que se despliega). Material BLANCO
   mate, como la lona real — nada de cromo. */
function crearGeometriaPetalo() {
  const LARGO = 4.0, ANCHO_BASE = 2.3, GROSOR = 0.05;

  const s = new THREE.Shape();
  s.moveTo(-ANCHO_BASE / 2, 0);
  s.lineTo(ANCHO_BASE / 2, 0);
  // Lados que se afinan con curva suave hacia la punta redondeada
  s.quadraticCurveTo(ANCHO_BASE * 0.32, LARGO * 0.55, 0.42, LARGO * 0.86);
  s.quadraticCurveTo(0.22, LARGO * 1.0, 0, LARGO);          // punta redondeada
  s.quadraticCurveTo(-0.22, LARGO * 1.0, -0.42, LARGO * 0.86);
  s.quadraticCurveTo(-ANCHO_BASE * 0.32, LARGO * 0.55, -ANCHO_BASE / 2, 0);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: GROSOR, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015,
    bevelSegments: 1, curveSegments: 12, steps: 10,
  });
  geo.translate(0, 0, -GROSOR / 2);
  geo.rotateX(Math.PI / 2); // el largo queda en +Z (hacia afuera), el grosor en Y

  // Curvatura de lona: la base sube un poco y la punta CAE (flor abierta),
  // con un leve acanalado central como tela tensada.
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp(v.z / LARGO, 0, 1);
    const centro = 1 - Math.min(1, Math.abs(v.x) / (ANCHO_BASE / 2));
    v.y += 0.28 * Math.sin(t * Math.PI)   // lomo suave al medio
         - 0.85 * t * t                    // la punta cae hacia afuera-abajo
         + 0.14 * centro * Math.sin(t * Math.PI); // acanalado de tela
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const geoPetalo = crearGeometriaPetalo();
const matLona = new THREE.MeshStandardMaterial({
  color: 0xf3efe4,            // blanco lona, mate
  roughness: 0.92,
  metalness: 0.0,
  emissive: 0x2a1e10,
  emissiveIntensity: 0.35,    // el atardecer la tiñe cálida
  side: THREE.DoubleSide,
});

// ----- 6.2 Los 16 pétalos: soporte (reparto radial) + brazo + bisagra -----
const bisagras = [];
const Y_BISAGRA = 0.35 + ALT_COLUMNA - 0.15;
const R_BISAGRA = 1.1;
for (let i = 0; i < TOTAL_PETALOS; i++) {
  const soporte = new THREE.Group();
  soporte.rotation.y = (i / TOTAL_PETALOS) * Math.PI * 2;

  // Brazo: del centro de la columna hasta la bisagra
  const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, R_BISAGRA, 8), aceroClaro);
  brazo.rotation.z = Math.PI / 2;
  brazo.position.set(R_BISAGRA / 2, Y_BISAGRA, 0);
  soporte.add(brazo);

  const bisagra = new THREE.Group();
  bisagra.position.set(0, Y_BISAGRA, R_BISAGRA);
  bisagra.rotation.x = ANGULO_CERRADO; // empieza cerrada (capullo)

  bisagra.add(new THREE.Mesh(geoPetalo, matLona));
  soporte.add(bisagra);
  flor.add(soporte);
  bisagras.push(bisagra);
}

/* ------------------------- 7. CONTROLES DE LA PÁGINA ------------------------- */
const btnAbrir = document.getElementById('btn-abrir');
const btnCerrar = document.getElementById('btn-cerrar');
const chkAuto = document.getElementById('chk-auto');

function modoManual(objetivo) {
  estado.automatico = false;
  if (chkAuto) chkAuto.checked = false;
  estado.objetivo = objetivo;
}
if (btnAbrir) btnAbrir.addEventListener('click', () => modoManual(1));
if (btnCerrar) btnCerrar.addEventListener('click', () => modoManual(0));
if (chkAuto) chkAuto.addEventListener('change', () => {
  estado.automatico = chkAuto.checked;
  estado.relojAuto = 0;
});

/* ------- 7.1 Control externo de la apertura (para el scroll de la escena) ----
   setApertura(v): 0 = cerrada (capullo), 1 = abierta (flor desplegada).
   main.js la llama en cada tick del scrub (0→1→0). Apaga el modo automático
   para que no pelee con el scroll. */
function setApertura(v) {
  estado.automatico = false;
  if (chkAuto) chkAuto.checked = false;
  const n = Math.min(1, Math.max(0, v));
  estado.objetivo = n;
  estado.apertura = n;
}

/* ------------------------- 8. CONTROL POR SCROLL + LOOP ------------------------- */
const reloj = new THREE.Clock();
let ultimaP = 0;

// update(p): main.js la llama con el scrub del scroll. SOLO mueve la cámara:
// órbita lenta (azimut = base + p·1.2), radio 12→9, altura 5.2→3.8,
// mirando a y 3.4→2.8. Los pétalos los sigue moviendo setApertura.
function update(p) {
  ultimaP = THREE.MathUtils.clamp(p || 0, 0, 1);
}

function aplicarPoseCamara(pe, t) {
  const az = t * 0.05 + pe * 1.2;
  const radio = THREE.MathUtils.lerp(12, 9, pe);
  const y = THREE.MathUtils.lerp(5.2, 3.8, pe);
  const lookY = THREE.MathUtils.lerp(3.4, 2.8, pe);
  camara.position.set(radio * Math.sin(az), y, radio * Math.cos(az));
  controles.target.set(0, lookY, 0);
}

function tick() {
  requestAnimationFrame(tick);
  if (!estado.visible || document.hidden) return;

  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = reloj.elapsedTime;

  // Ciclo automático: se abre y se cierra sola cada ~7 segundos
  if (estado.automatico) {
    estado.relojAuto += dt;
    if (estado.relojAuto > 7) {
      estado.relojAuto = 0;
      estado.objetivo = estado.objetivo > 0.5 ? 0 : 1;
    }
  }

  // La apertura real persigue al objetivo con suavidad
  estado.apertura += (estado.objetivo - estado.apertura) * Math.min(1, dt * 2.2);

  // Cada pétalo abre con leve desfase → orgánico, no robótico
  for (let i = 0; i < TOTAL_PETALOS; i++) {
    const desfase = (i / TOTAL_PETALOS) * 0.28;
    const a = THREE.MathUtils.smootherstep(
      THREE.MathUtils.clamp(estado.apertura * 1.28 - desfase, 0, 1), 0, 1
    );
    bisagras[i].rotation.x = THREE.MathUtils.lerp(ANGULO_CERRADO, ANGULO_ABIERTO, a)
      + Math.sin(t * 1.4 + i * 0.7) * 0.012; // "respiración" de lona
  }

  // Las partículas ascienden y reaparecen abajo
  const p = geoParticulas.attributes.position;
  for (let i = 0; i < N_PARTICULAS; i++) {
    let y = p.getY(i) + velParticulas[i] * dt;
    if (y > 9) y = 0;
    p.setY(i, y);
  }
  p.needsUpdate = true;

  // El anillo de la base pulsa; el óculo "respira" luz
  anillo.material.opacity = 0.4 + Math.sin(t * 2) * 0.18;
  oculo.material.emissiveIntensity = 2.2 + Math.sin(t * 2.4) * 0.5;
  corazon.intensity = 26 + Math.sin(t * 1.7) * 6;

  aplicarPoseCamara(THREE.MathUtils.smootherstep(ultimaP, 0, 1), t);

  controles.update();
  renderer.render(escena, camara);
  if (window.__3dDiag && !window.__3dDiag.marks.florFirstFrame) { window.__3dDiag.marks.florFirstFrame = 'first-frame'; }
  if (window.__3dDiag) window.__3dDiag.marks.florFrames = (window.__3dDiag.marks.florFrames || 0) + 1;
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

new IntersectionObserver((entradas) => {
  estado.visible = entradas[0].isIntersecting;
}, { threshold: 0.05 }).observe(contenedor);

// API pública: la página (botones, scroll) y la consola usan esto.
window.__flor3d = { estado, TOTAL_PETALOS, setApertura, update, resize };

tick();
