/* ============================================================================
   obelisco3d.js — El Obelisco de Barquisimeto en 3D (Three.js)
   ----------------------------------------------------------------------------
   Fiel a la foto nocturna de referencia:
     · Fuste BLANCO de caras PLANAS (BoxGeometry), casi sin afinar — nada de aguja.
     · RELOJ: esfera OSCURA con manecillas, MONTADA sobre la cara frontal
       cerca de la cúspide (no un anillo alrededor de la torre).
     · Hilera de ventanitas cuadradas oscuras SOBRE el reloj.
     · Placa/puerta rectangular oscura cerca de la base, sobre la cara.
     · Cuña/rampa inclinada a un costado de la base (el diedro de la foto).
     · Remate plano + antena fina con baliza roja (como el real).
     · Iluminación nocturna VERDOSA sobre la torre blanca.
     · Entorno: glorieta circular, bokeh naranja de la ciudad, siluetas de
       edificios, estelas de luz de las avenidas y cordillera al fondo.

   La cámara la dirige el scroll (main.js llama a update(p)): contrapicada
   baja monumental → órbita elevada.

   Contrato (igual que flor3d.js y manto3d.js):
     · Módulo ES que importa 'three' y OrbitControls (importmap en index.html).
     · Canvas #obelisco-canvas dentro de #obelisco3d-escena; sin WebGL muestra
       #obelisco3d-error y no revienta la página.
     · Expone window.__obelisco3d = { update(p, dt), resize }.
     · update(p): pose de cámara derivada SOLO de p (idempotente).
     · rAF propio que SOLO dibuja cuando el contenedor es visible.
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
  mostrarError();
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

/* ------------------------- 2. ESCENA BASE (NOCHE) ------------------------- */
const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0x0c1330, 42, 175); // la noche azul se traga la distancia

const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
camara.position.set(0, 2, 26);

const controles = new OrbitControls(camara, renderer.domElement);
controles.target.set(0, 10, 0);
controles.enableDamping = true;
controles.dampingFactor = 0.06;
controles.minDistance = 8;
controles.maxDistance = 60;
controles.maxPolarAngle = 1.52;
controles.autoRotate = false;

/* ------------------------- 3. CIELO NOCTURNO ------------------------- */
// Domo invertido: azul noche arriba, resplandor naranja de la ciudad al horizonte.
function crearCielo(radio) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      arriba: { value: new THREE.Color(0x050a24) },
      horizonte: { value: new THREE.Color(0xff8a3c) },
      abajo: { value: new THREE.Color(0x04050c) },
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
          ? mix(horizonte, arriba, smoothstep(0.0, 0.5, h))
          : mix(horizonte, abajo, smoothstep(0.0, -0.25, h));
        // Resplandor urbano hacia -Z (donde está la ciudad)
        float glow = pow(max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), vec3(0.0, 0.0, -1.0))), 3.0)
                   * (1.0 - smoothstep(0.0, 0.3, abs(h)));
        col += vec3(1.0, 0.5, 0.2) * glow * 0.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(radio, 32, 20), mat);
  escena.add(cielo);
}
crearCielo(240);

/* ------------------------- 4. LUCES ------------------------- */
escena.add(new THREE.HemisphereLight(0x33406e, 0x0a0a10, 0.65)); // cielo azul / suelo oscuro

const luna = new THREE.DirectionalLight(0x8fb0ff, 0.55); // luz fría de luna
luna.position.set(12, 22, 26);
escena.add(luna);

const resplandorCiudad = new THREE.DirectionalLight(0xff8a3c, 0.5); // la ciudad calienta el horizonte
resplandorCiudad.position.set(-10, 6, -40);
escena.add(resplandorCiudad);

// Baño VERDE nocturno sobre la torre blanca (el de la foto real)
const verdeNocturno = new THREE.PointLight(0x35d97a, 130, 65, 2);
verdeNocturno.position.set(8, 9, 13);
escena.add(verdeNocturno);

/* ------------------------- 5. GLORIETA, CIUDAD Y HORIZONTE ------------------------- */
const obelisco = new THREE.Group();
escena.add(obelisco);

// — Glorieta circular escalonada (el Obelisco real está en una redoma) —
const asfalto = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.95 });
[[11, 0.35, 0.175], [8.6, 0.35, 0.5], [6.4, 0.35, 0.85]].forEach(([r, h, y]) => {
  const escalon = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.4, h, 56), asfalto);
  escalon.position.y = y;
  obelisco.add(escalon);
});

// — Estelas de luz de las avenidas (arcos emisivos a ras de suelo) —
function estela(radio, arco, color, rotY, op) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(radio, 0.16, 8, 72, arco),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op })
  );
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = rotY;
  m.position.y = 0.25;
  escena.add(m);
}
estela(20, Math.PI * 0.9, 0xffa63d, 0.4, 0.85);
estela(27, Math.PI * 0.7, 0xff5a2e, 2.6, 0.7);
estela(34, Math.PI * 0.6, 0xfff2d0, 4.2, 0.6);

// — Bokeh de la ciudad: cientos de puntitos naranjas/blancos (Points) —
{
  const N = 260;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 36 + Math.random() * 60;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 0.4 + Math.random() * 4.5;
    pos[i * 3 + 2] = Math.sin(a) * r;
    c.setHSL(0.07 + Math.random() * 0.06, 0.95, 0.55 + Math.random() * 0.25);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const bokeh = new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.7, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  escena.add(bokeh);
}

// — Siluetas de edificios lejanos —
{
  const matEdificio = new THREE.MeshStandardMaterial({ color: 0x0a0e1c, roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.15;
    const r = 78 + (i % 4) * 9;
    const w = 5 + (i % 3) * 3;
    const h = 7 + ((i * 7) % 5) * 3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), matEdificio);
    b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    b.rotation.y = a;
    escena.add(b);
  }
}

// — Cordillera al fondo (lomas oscuras aplanadas) —
{
  const matLoma = new THREE.MeshStandardMaterial({ color: 0x0a1024, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8 - 0.5) * 2.2; // arco trasero (-Z)
    const loma = new THREE.Mesh(new THREE.SphereGeometry(26, 20, 12), matLoma);
    loma.scale.set(1.6, 0.28 + (i % 3) * 0.1, 0.7);
    loma.position.set(Math.cos(a) * 165, -2, Math.sin(a) * 165);
    escena.add(loma);
  }
}

/* ------------------------- 6. EL OBELISCO ------------------------- */
const BASE_Y = 1.05;     // la torre nace sobre la glorieta
const ANCHO = 3.4;       // lado de la sección cuadrada (caras PLANAS, sin afinar)
const ALT_TORRE = 30;

const concretoBlanco = new THREE.MeshStandardMaterial({
  color: 0xe9e7e0, roughness: 0.8, metalness: 0.02,
});
const concretoGris = new THREE.MeshStandardMaterial({
  color: 0x9a978e, roughness: 0.9, metalness: 0.02,
});

// — Zócalo cuadrado de 2 niveles —
[[5.6, 1.0, BASE_Y - 0.5], [4.4, 0.9, BASE_Y + 0.15]].forEach(([lado, alto, y]) => {
  const nivel = new THREE.Mesh(new THREE.BoxGeometry(lado, alto, lado), concretoGris);
  nivel.position.y = y;
  obelisco.add(nivel);
});

// — Cuña/rampa inclinada a un costado de la base (el diedro de la foto) —
const cuna = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.28, 5.2), concretoGris);
cuna.position.set(2.6, 0.75, 1.2);
cuna.rotation.x = -0.42; // inclinada, medio enterrada
cuna.rotation.y = 0.35;
obelisco.add(cuna);

// — Fuste: prisma rectangular de caras planas, SIN afinar —
const torre = new THREE.Mesh(
  new THREE.BoxGeometry(ANCHO, ALT_TORRE, ANCHO),
  concretoBlanco
);
torre.position.y = BASE_Y + ALT_TORRE / 2;
obelisco.add(torre);

// — Remate plano + antena fina con baliza roja —
const tapa = new THREE.Mesh(new THREE.BoxGeometry(ANCHO + 0.25, 0.45, ANCHO + 0.25), concretoGris);
tapa.position.y = BASE_Y + ALT_TORRE + 0.22;
obelisco.add(tapa);
const antena = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.08, 3.2, 8),
  new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6 })
);
antena.position.y = BASE_Y + ALT_TORRE + 2.0;
obelisco.add(antena);
const baliza = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 12, 10),
  new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 3 })
);
baliza.position.y = BASE_Y + ALT_TORRE + 3.65;
obelisco.add(baliza);

const CARA = ANCHO / 2 + 0.02; // la cara frontal (+Z)
const Y_CIMA = BASE_Y + ALT_TORRE;

// — RELOJ: esfera OSCURA montada SOBRE la cara frontal, cerca de la cúspide —
{
  const relojG = new THREE.Group();
  const esfera = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 40),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 })
  );
  const aro = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.2, 40),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.35 })
  );
  relojG.add(esfera, aro);
  // 12 marcas horarias
  const matMarca = new THREE.MeshStandardMaterial({
    color: 0xffe9b8, emissive: 0xffd98a, emissiveIntensity: 1.6,
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const marca = new THREE.Mesh(new THREE.BoxGeometry(0.09, i % 3 === 0 ? 0.26 : 0.16, 0.02), matMarca);
    marca.position.set(Math.sin(a) * 0.88, Math.cos(a) * 0.88, 0.02);
    marca.rotation.z = -a;
    relojG.add(marca);
  }
  // Manecillas (hora ~10:10, como en muchas fotos del monumento)
  const matAguja = new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffd98a, emissiveIntensity: 1.2 });
  const agujaH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.02), matAguja);
  agujaH.geometry.translate(0, 0.22, 0);
  agujaH.position.z = 0.04;
  agujaH.rotation.z = 2.1;
  const agujaM = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.02), matAguja);
  agujaM.geometry.translate(0, 0.36, 0);
  agujaM.position.z = 0.06;
  agujaM.rotation.z = -1.05;
  relojG.add(agujaH, agujaM);

  relojG.position.set(0, Y_CIMA - 3.4, CARA);
  obelisco.add(relojG);
}

// — Hilera de ventanitas cuadradas oscuras SOBRE el reloj —
{
  const matVent = new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), matVent);
    v.position.set((i - 2.5) * 0.52, Y_CIMA - 1.35, CARA);
    obelisco.add(v);
  }
}

// — Placa/puerta rectangular oscura cerca de la base, sobre la cara —
{
  const puerta = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 2.3),
    new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.7 })
  );
  puerta.position.set(0, BASE_Y + 3.6, CARA);
  obelisco.add(puerta);
}

/* ------------------------- 7. CONTROL POR SCROLL + LOOP ------------------------- */
const reloj = new THREE.Clock();
let ultimaP = 0;
let visible = true;

// update(p): main.js la llama con el scrub del scroll. La pose se deriva SOLO
// de p (idempotente): contrapicada baja monumental (y≈2, radio≈26, mirando a
// y≈10) → órbita elevada (y≈24, radio≈20, azimut −0.5→0.6, mirando a y≈20).
function update(p) {
  ultimaP = THREE.MathUtils.clamp(p || 0, 0, 1);
}

function aplicarPoseCamara(pe, t) {
  const az = THREE.MathUtils.lerp(-0.5, 0.6, pe);
  const radio = THREE.MathUtils.lerp(26, 20, pe);
  const y = THREE.MathUtils.lerp(2, 24, pe) + Math.sin(t * 0.5) * 0.15;
  const lookY = THREE.MathUtils.lerp(10, 20, pe);
  camara.position.set(radio * Math.sin(az), y, radio * Math.cos(az));
  controles.target.set(0, lookY, 0);
}

function tick() {
  requestAnimationFrame(tick);
  if (!visible || document.hidden) return;

  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = reloj.elapsedTime;
  void dt;

  aplicarPoseCamara(THREE.MathUtils.smootherstep(ultimaP, 0, 1), t);

  // El baño verde "respira" como la iluminación real; la baliza parpadea
  verdeNocturno.intensity = 130 + Math.sin(t * 1.1) * 16;
  baliza.material.emissiveIntensity = (Math.sin(t * 2.6) > 0.2) ? 3.2 : 0.4;

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

new IntersectionObserver((entradas) => {
  visible = entradas[0].isIntersecting;
}, { threshold: 0.05 }).observe(contenedor);

window.__obelisco3d = { update, resize };

tick();
