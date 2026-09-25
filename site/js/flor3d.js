/* ============================================================================
   flor3d.js — La Flor de Venezuela en 3D interactivo (Three.js)
   ----------------------------------------------------------------------------
   ¿Qué hace este archivo?
     1. Crea una escena 3D nocturna con la flor como protagonista.
     2. Modela los 16 pétalos con código (geometría extruida + curvatura),
        cada uno con su "bisagra" para abrirse y cerrarse.
     3. Añade tallo, corola, base, partículas flotantes y luces crepusculares.
     4. Permite girar con el ratón/dedos (OrbitControls) y abrir/cerrar
        los pétalos con los botones de la página o en modo automático.
     5. Cuida el rendimiento: limita la resolución, y pausa el render
        cuando la sección no está en pantalla.

   Se carga como módulo ES (ver el <script type="importmap"> en index.html).
   ============================================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------- 1. CONFIGURACIÓN ------------------------- */
const ID_CONTENEDOR = 'flor3d-escena';
const ID_CANVAS = 'flor3d-canvas';
const TOTAL_PETALOS = 16;          // como la Flor de Venezuela real
const ANGULO_CERRADO = -1.18;      // radianes: pétalos hacia arriba (capullo)
const ANGULO_ABIERTO = 0.10;       // radianes: pétalos desplegados

// Estado de la animación (los botones de la página lo modifican)
const estado = {
  apertura: 0,        // 0 = cerrada, 1 = abierta (valor actual, suavizado)
  objetivo: 0,        // hacia dónde queremos ir
  automatico: true,   // si es true, se abre/cierra sola cada cierto tiempo
  visible: true,      // false cuando la sección sale de la pantalla (pausa)
  relojAuto: 0,       // acumulador para el ciclo automático
};

/* ------------------------- 2. ESCENA BASE ------------------------- */
const contenedor = document.getElementById(ID_CONTENEDOR);
const canvas = document.getElementById(ID_CANVAS);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  // Sin WebGL no hay 3D: mostramos el mensaje de respaldo del HTML.
  document.getElementById('flor3d-error').classList.replace('hidden', 'flex');
  throw e;
}
// Rendimiento: no renderizar a más del doble de píxeles de la pantalla.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; // look cinematográfico
renderer.toneMappingExposure = 1.1;

const escena = new THREE.Scene();
escena.background = new THREE.Color(0x05060a);
escena.fog = new THREE.Fog(0x05060a, 18, 46); // la distancia se pierde en la noche

const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
camara.position.set(0, 4.6, 10.5);

// Controles: girar, acercar y paneo suave con inercia
const controles = new OrbitControls(camara, renderer.domElement);
controles.target.set(0, 1.6, 0);
controles.enableDamping = true;
controles.dampingFactor = 0.06;
controles.minDistance = 5;
controles.maxDistance = 18;
controles.maxPolarAngle = 1.45;   // no deja pasar la cámara bajo el suelo
controles.autoRotate = true;      // vitrina giratoria…
controles.autoRotateSpeed = 0.7;
controles.addEventListener('start', () => { controles.autoRotate = false; }); // …hasta que el usuario toma el control

/* ------------------------- 3. LUCES CREPUSCULARES ------------------------- */
escena.add(new THREE.HemisphereLight(0x6f5fb0, 0x0a0a12, 0.55)); // cielo violeta / suelo oscuro

const solPoniente = new THREE.DirectionalLight(0xffb066, 2.0);  // "hora dorada"
solPoniente.position.set(-6, 8, 4);
escena.add(solPoniente);

const contraluz = new THREE.DirectionalLight(0x7c5cff, 0.6);    // filo violeta
contraluz.position.set(6, 4, -6);
escena.add(contraluz);

const corazon = new THREE.PointLight(0xffc37a, 26, 14, 2);       // brillo del centro de la flor
corazon.position.set(0, 2.3, 0);
escena.add(corazon);

/* ------------------------- 4. SUELO Y PARTÍCULAS ------------------------- */
const suelo = new THREE.Mesh(
  new THREE.CircleGeometry(34, 48),
  new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 0.95 })
);
suelo.rotation.x = -Math.PI / 2;
escena.add(suelo);

const rejilla = new THREE.GridHelper(44, 44, 0x3a2a18, 0x171208);
rejilla.position.y = 0.01;
rejilla.material.transparent = true;
rejilla.material.opacity = 0.35;
escena.add(rejilla);

// Polvo de luz flotando (Points = la forma más barata de dibujar partículas)
const N_PARTICULAS = 380;
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

/* ------------------------- 5. LA FLOR ------------------------- */
const flor = new THREE.Group();
escena.add(flor);

const metalOscuro = new THREE.MeshStandardMaterial({
  color: 0x2b2f36, metalness: 0.9, roughness: 0.45,
});

// — Tallo y base —
const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.3, 24), metalOscuro);
tallo.position.y = 0.65;
flor.add(tallo);

const base = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.4, 0.28, 48), metalOscuro);
base.position.y = 0.14;
flor.add(base);

const anillo = new THREE.Mesh(
  new THREE.RingGeometry(3.55, 3.75, 64),
  new THREE.MeshBasicMaterial({ color: 0xf2a33c, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
);
anillo.rotation.x = -Math.PI / 2;
anillo.position.y = 0.29;
flor.add(anillo);

// — Corola central (de donde nacen los pétalos) —
const corola = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), metalOscuro);
corola.scale.y = 0.7;
corola.position.y = 1.35;
flor.add(corola);

// — Pistilo luminoso —
const pistilo = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 24, 18),
  new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff9a2e, emissiveIntensity: 2.2 })
);
pistilo.position.y = 1.85;
flor.add(pistilo);

/* ----- 5.1 Geometría del pétalo (una sola, reutilizada 16 veces) -----
   Se dibuja el contorno 2D de un pétalo, se extruye (se le da grosor),
   se acuesta para que apunte hacia afuera (+Z) y se le da curvatura
   de "cuchara" moviendo sus vértices. */
function crearGeometriaPetalo() {
  const LONGITUD = 3.4, ANCHO = 1.25, GROSOR = 0.08;

  const contorno = new THREE.Shape();
  contorno.moveTo(0, 0);
  contorno.bezierCurveTo(ANCHO * 0.62, LONGITUD * 0.10, ANCHO * 0.70, LONGITUD * 0.48, ANCHO * 0.30, LONGITUD * 0.80);
  contorno.quadraticCurveTo(ANCHO * 0.14, LONGITUD * 0.96, 0, LONGITUD);
  contorno.quadraticCurveTo(-ANCHO * 0.14, LONGITUD * 0.96, -ANCHO * 0.30, LONGITUD * 0.80);
  contorno.bezierCurveTo(-ANCHO * 0.70, LONGITUD * 0.48, -ANCHO * 0.62, LONGITUD * 0.10, 0, 0);

  const geo = new THREE.ExtrudeGeometry(contorno, {
    depth: GROSOR, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03,
    bevelSegments: 2, curveSegments: 24, steps: 6,
  });
  geo.translate(0, 0, -GROSOR / 2);
  geo.rotateX(Math.PI / 2); // el largo queda en +Z (hacia afuera), el grosor en Y

  // Curvatura: punta elevada y bordes algo caídos → forma de cuchara
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp(v.z / LONGITUD, 0, 1); // 0 = base, 1 = punta
    const borde = Math.abs(Math.sin((v.x / ANCHO) * Math.PI * 0.5)); // 0 centro → ~1 bordes
    v.y += 0.55 * t * t - 0.30 * borde * t;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const geoPetalo = crearGeometriaPetalo();

// ----- 5.2 Los 16 pétalos: soporte (reparto radial) + bisagra (apertura) -----
const bisagras = [];
for (let i = 0; i < TOTAL_PETALOS; i++) {
  const material = new THREE.MeshStandardMaterial({
    // cobre metálico con leve variación por pétalo para que no se vea plano
    color: new THREE.Color().setHSL(0.075 + (i % 2) * 0.012, 0.58, 0.40 + (i % 3) * 0.02),
    metalness: 0.85,
    roughness: 0.32,
    emissive: 0x2a1503,
    emissiveIntensity: 0.8,
    side: THREE.DoubleSide, // visible por dentro cuando está cerrada
  });

  const soporte = new THREE.Group();
  soporte.rotation.y = (i / TOTAL_PETALOS) * Math.PI * 2; // reparte en círculo

  const bisagra = new THREE.Group();
  bisagra.position.set(0, 1.35, 0.45); // nace del borde de la corola
  bisagra.rotation.x = ANGULO_CERRADO; // empieza cerrada (capullo)

  bisagra.add(new THREE.Mesh(geoPetalo, material));
  soporte.add(bisagra);
  flor.add(soporte);
  bisagras.push(bisagra);
}

/* ------------------------- 6. CONTROLES DE LA PÁGINA ------------------------- */
const btnAbrir = document.getElementById('btn-abrir');
const btnCerrar = document.getElementById('btn-cerrar');
const chkAuto = document.getElementById('chk-auto');

function modoManual(objetivo) {
  estado.automatico = false;
  chkAuto.checked = false;
  estado.objetivo = objetivo;
}
btnAbrir.addEventListener('click', () => modoManual(1));
btnCerrar.addEventListener('click', () => modoManual(0));
chkAuto.addEventListener('change', () => {
  estado.automatico = chkAuto.checked;
  estado.relojAuto = 0;
});

/* ------------------------- 7. RENDER LOOP ------------------------- */
const reloj = new THREE.Clock();

function animar() {
  requestAnimationFrame(animar);

  // Pausa total cuando la sección no está en pantalla (rendimiento)
  if (!estado.visible || document.hidden) return;

  const dt = Math.min(reloj.getDelta(), 0.05); // dt acotado: evita saltos
  const t = reloj.elapsedTime;

  // Ciclo automático: se abre y se cierra sola cada ~7 segundos
  if (estado.automatico) {
    estado.relojAuto += dt;
    if (estado.relojAuto > 7) {
      estado.relojAuto = 0;
      estado.objetivo = estado.objetivo > 0.5 ? 0 : 1;
    }
  }

  // La apertura real persigue al objetivo con suavidad (sin tirones)
  estado.apertura += (estado.objetivo - estado.apertura) * Math.min(1, dt * 2.2);

  // Cada pétalo abre con un leve desfase → se ve orgánico, no robótico
  for (let i = 0; i < TOTAL_PETALOS; i++) {
    const desfase = (i / TOTAL_PETALOS) * 0.28;
    const a = THREE.MathUtils.smootherstep(
      THREE.MathUtils.clamp(estado.apertura * 1.28 - desfase, 0, 1), 0, 1
    );
    bisagras[i].rotation.x = THREE.MathUtils.lerp(ANGULO_CERRADO, ANGULO_ABIERTO, a)
      + Math.sin(t * 1.4 + i * 0.7) * 0.012; // "respiración" sutil
  }

  // Las partículas ascienden y reaparecen abajo
  const p = geoParticulas.attributes.position;
  for (let i = 0; i < N_PARTICULAS; i++) {
    let y = p.getY(i) + velParticulas[i] * dt;
    if (y > 9) y = 0;
    p.setY(i, y);
  }
  p.needsUpdate = true;

  // El anillo de la base pulsa suavemente
  anillo.material.opacity = 0.4 + Math.sin(t * 2) * 0.18;
  // El pistilo "respira" luz
  pistilo.material.emissiveIntensity = 2.0 + Math.sin(t * 2.4) * 0.5;

  controles.update();
  renderer.render(escena, camara);
}

/* ------------------------- 8. TAMAÑO Y VISIBILIDAD ------------------------- */
function ajustarTamano() {
  const w = contenedor.clientWidth;
  const h = contenedor.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camara.aspect = w / h;
  camara.updateProjectionMatrix();
}
window.addEventListener('resize', ajustarTamano);
ajustarTamano();

// Pausar cuando la sección sale de la pantalla
new IntersectionObserver((entradas) => {
  estado.visible = entradas[0].isIntersecting;
}, { threshold: 0.05 }).observe(contenedor);

/* ------- 8.1 Control externo de la apertura (para el scroll de la escena) ----
   setApertura(v) recibe un número entre 0 (cerrada) y 1 (abierta) y pone los
   pétalos exactamente ahí, sin suavizado: el scroll manda directo.
   main.js la llama en cada tick del scrub de la escena "Flor" (0→1→0).
   También apaga el modo automático para que no pelee con el scroll. */
function setApertura(v) {
  estado.automatico = false;
  if (chkAuto) chkAuto.checked = false;
  const n = Math.min(1, Math.max(0, v));
  estado.objetivo = n;
  estado.apertura = n;
}

// Utilidad para depurar/aprender desde la consola del navegador:
window.__flor3d = { estado, TOTAL_PETALOS, setApertura };

animar();
