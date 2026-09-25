/* ============================================================================
   flor3d.js — La Flor de Venezuela REAL en 3D (Three.js)
   ----------------------------------------------------------------------------
   Reescritura fiel al monumento de Fruto Vivas (ver foto de referencia):
     · 16 PANELES METÁLICOS trapezoidales grandes, levemente curvados,
       color acero (metalness 0.85, roughness 0.4) — NO pétalos orgánicos.
     · Paneles montados en BRAZOS alrededor de una COLUMNA CENTRAL de acero
       oscuro, sobre una PLATAFORMA circular.
     · Cerrados (apertura 0) forman un capullo vertical; abiertos (apertura 1)
       se despliegan ~75° hacia afuera.
     · Núcleo: pistilos (cilindros pequeños con puntas emisivas).

   Además: cielo crepuscular, sol bajo, partículas de polvo de luz, controles
   orbitales con inercia y pausa del render fuera de pantalla.

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

/* ------------------------- 1. CONFIGURACIÓN ------------------------- */
const ID_CONTENEDOR = 'flor3d-escena';
const ID_CANVAS = 'flor3d-canvas';
const ID_ERROR = 'flor3d-error';
const TOTAL_PETALOS = 16;          // como la Flor de Venezuela real
const ANGULO_CERRADO = -1.18;      // radianes: paneles hacia arriba (capullo)
const ANGULO_ABIERTO = 0.13;       // radianes: ~75° de despliegue hacia afuera

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
  // Sin WebGL no hay 3D: mostramos el mensaje de respaldo del HTML.
  mostrarError();
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping; // look cinematográfico
renderer.toneMappingExposure = 1.1;

/* ------------------------- 2. ESCENA BASE ------------------------- */
const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0x3a2418, 18, 52); // el atardecer se traga la distancia

const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
camara.position.set(0, 4.6, 11);

// Controles: girar y acercar con inercia (la cámara la dirige el scroll)
const controles = new OrbitControls(camara, renderer.domElement);
controles.target.set(0, 3.2, 0);
controles.enableDamping = true;
controles.dampingFactor = 0.06;
controles.minDistance = 5;
controles.maxDistance = 18;
controles.maxPolarAngle = 1.45;   // no deja pasar la cámara bajo el suelo
controles.autoRotate = false;     // la cámara la dirige el scroll

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
        float sol = pow(max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), vec3(0.0, 0.0, -1.0))), 6.0)
                  * (1.0 - smoothstep(0.0, 0.35, abs(h)));
        col += vec3(1.0, 0.55, 0.25) * sol * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  escena.add(new THREE.Mesh(new THREE.SphereGeometry(radio, 32, 20), mat));
}
crearCielo(160);

// Sol: disco emisivo bajo en el horizonte
const sol = new THREE.Mesh(
  new THREE.CircleGeometry(5, 40),
  new THREE.MeshBasicMaterial({ color: 0xffc37a, fog: false })
);
sol.position.set(-20, 7, -85);
sol.lookAt(0, 7, 0);
escena.add(sol);

/* ------------------------- 4. LUCES CREPUSCULARES ------------------------- */
escena.add(new THREE.HemisphereLight(0x6f5fb0, 0x0a0a12, 0.55)); // cielo violeta / suelo oscuro

const solPoniente = new THREE.DirectionalLight(0xffb066, 2.0);  // "hora dorada"
solPoniente.position.set(-6, 8, 4);
escena.add(solPoniente);

const contraluz = new THREE.DirectionalLight(0x7c5cff, 0.6);    // filo violeta
contraluz.position.set(6, 4, -6);
escena.add(contraluz);

const corazon = new THREE.PointLight(0xffc37a, 26, 14, 2);       // brillo del centro de la flor
corazon.position.set(0, 3.4, 0);
escena.add(corazon);

/* ------------------------- 5. SUELO Y PARTÍCULAS ------------------------- */
const suelo = new THREE.Mesh(
  new THREE.CircleGeometry(40, 48),
  new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 0.95 })
);
suelo.rotation.x = -Math.PI / 2;
escena.add(suelo);

// Polvo de luz flotando (Points = la forma más barata de dibujar partículas)
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

const aceroOscuro = new THREE.MeshStandardMaterial({
  color: 0x2b2f36, metalness: 0.9, roughness: 0.45,
});

// — Plataforma circular (como la base real del monumento) —
const plataforma = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.6, 0.35, 48), aceroOscuro);
plataforma.position.y = 0.175;
flor.add(plataforma);

const anillo = new THREE.Mesh(
  new THREE.RingGeometry(3.7, 3.9, 64),
  new THREE.MeshBasicMaterial({ color: 0xf2a33c, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
);
anillo.rotation.x = -Math.PI / 2;
anillo.position.y = 0.36;
flor.add(anillo);

// — Columna central de acero oscuro (el "tallo" estructural real) —
const ALT_COLUMNA = 3.0;
const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, ALT_COLUMNA, 24), aceroOscuro);
columna.position.y = 0.35 + ALT_COLUMNA / 2;
flor.add(columna);

// — Núcleo superior (de donde nacen los brazos) —
const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), aceroOscuro);
nucleo.scale.y = 0.7;
nucleo.position.y = 0.35 + ALT_COLUMNA;
flor.add(nucleo);

// — Pistilos: cilindros pequeños con puntas emisivas —
const matPistilo = new THREE.MeshStandardMaterial({
  color: 0xffd9a0, emissive: 0xff9a2e, emissiveIntensity: 2.0,
});
const pistilos = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  const vastago = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.7, 8), aceroOscuro);
  vastago.position.set(Math.cos(a) * 0.28, 0.35 + ALT_COLUMNA + 0.35, Math.sin(a) * 0.28);
  const punta = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), matPistilo);
  punta.position.set(Math.cos(a) * 0.28, 0.35 + ALT_COLUMNA + 0.72, Math.sin(a) * 0.28);
  flor.add(vastago, punta);
  pistilos.push(punta);
}

/* ----- 6.1 Geometría del panel metálico (una sola, reutilizada 16 veces) -----
   Trapezoide extruido: angosto en la base, ancho en la punta, como los
   paneles reales. Se acuesta para apuntar hacia afuera (+Z) y se le da una
   curvatura leve de chapa metálica. */
function crearGeometriaPanel() {
  const LARGO = 3.6, ANCHO_BASE = 1.1, ANCHO_PUNTA = 1.9, GROSOR = 0.07;

  const s = new THREE.Shape();
  s.moveTo(-ANCHO_BASE / 2, 0);
  s.lineTo(ANCHO_BASE / 2, 0);
  s.lineTo(ANCHO_PUNTA / 2, LARGO);
  s.lineTo(-ANCHO_PUNTA / 2, LARGO);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: GROSOR, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02,
    bevelSegments: 1, curveSegments: 8, steps: 8,
  });
  geo.translate(0, 0, -GROSOR / 2);
  geo.rotateX(Math.PI / 2); // el largo queda en +Z (hacia afuera), el grosor en Y

  // Curvatura leve: punta algo elevada y centro acanalado → chapa metálica
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp(v.z / LARGO, 0, 1); // 0 = base, 1 = punta
    const centro = 1 - Math.min(1, Math.abs(v.x) / (ANCHO_PUNTA / 2));
    v.y += 0.38 * t * t - 0.10 * centro * t;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const geoPanel = crearGeometriaPanel();

// ----- 6.2 Los 16 paneles: soporte (reparto radial) + brazo + bisagra -----
const bisagras = [];
const Y_BISAGRA = 0.35 + ALT_COLUMNA - 0.25;
const R_BISAGRA = 1.05;
for (let i = 0; i < TOTAL_PETALOS; i++) {
  const material = new THREE.MeshStandardMaterial({
    // acero con leve variación por panel para que no se vea plano
    color: new THREE.Color().setHSL(0.58, 0.04, 0.60 + (i % 3) * 0.015),
    metalness: 0.85,
    roughness: 0.4,
    emissive: 0x1a1208,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide, // visible por dentro cuando está cerrada
  });

  const soporte = new THREE.Group();
  soporte.rotation.y = (i / TOTAL_PETALOS) * Math.PI * 2; // reparte en círculo

  // Brazo: del centro de la columna hasta la bisagra (como la estructura real)
  const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, R_BISAGRA, 8), aceroOscuro);
  brazo.rotation.z = Math.PI / 2;
  brazo.position.set(R_BISAGRA / 2, Y_BISAGRA, 0);
  soporte.add(brazo);

  const bisagra = new THREE.Group();
  bisagra.position.set(0, Y_BISAGRA, R_BISAGRA); // nace en la punta del brazo
  bisagra.rotation.x = ANGULO_CERRADO; // empieza cerrada (capullo)

  bisagra.add(new THREE.Mesh(geoPanel, material));
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
   setApertura(v) recibe un número entre 0 (cerrada) y 1 (abierta) y pone los
   paneles exactamente ahí, sin suavizado: el scroll manda directo.
   main.js la llama en cada tick del scrub de la escena "Flor" (0→1→0).
   También apaga el modo automático para que no pelee con el scroll. */
function setApertura(v) {
  estado.automatico = false;
  if (chkAuto) chkAuto.checked = false;
  const n = Math.min(1, Math.max(0, v));
  estado.objetivo = n;
  estado.apertura = n;
}

/* ------------------------- 8. CONTROL POR SCROLL + LOOP ------------------------- */
const reloj = new THREE.Clock();
let ultimaP = 0; // último progreso de scroll recibido (0..1)

// update(p): main.js la llama con el scrub del scroll. SOLO mueve la cámara:
// órbita lenta (azimut = base + p·1.2), radio 11→8.5, altura 4.6→3.4,
// mirando a y 3.2→2.6. Los paneles los sigue moviendo setApertura.
function update(p) {
  ultimaP = THREE.MathUtils.clamp(p || 0, 0, 1);
}

function aplicarPoseCamara(pe, t) {
  const az = t * 0.05 + pe * 1.2;                    // deriva lenta + avance del scroll
  const radio = THREE.MathUtils.lerp(11, 8.5, pe);
  const y = THREE.MathUtils.lerp(4.6, 3.4, pe);
  const lookY = THREE.MathUtils.lerp(3.2, 2.6, pe);
  camara.position.set(radio * Math.sin(az), y, radio * Math.cos(az));
  controles.target.set(0, lookY, 0);
}

function tick() {
  requestAnimationFrame(tick);

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

  // Cada panel abre con un leve desfase → se ve orgánico, no robótico
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
  // Los pistilos "respiran" luz
  for (const punta of pistilos) {
    punta.material.emissiveIntensity = 2.0 + Math.sin(t * 2.4) * 0.5;
  }

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
  estado.visible = entradas[0].isIntersecting;
}, { threshold: 0.05 }).observe(contenedor);

// API pública: la página (botones, scroll) y la consola usan esto.
window.__flor3d = { estado, TOTAL_PETALOS, setApertura, update, resize };

tick();
