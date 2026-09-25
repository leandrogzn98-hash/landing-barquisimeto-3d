# Landing 3D — Íconos de Barquisimeto

Landing de prueba: los tres lugares emblemáticos de Barquisimeto
(Obelisco, Flor de Venezuela y Manto de María / Divina Pastora)
presentados como íconos de la identidad barquisimetana,
con animaciones 3D (Three.js) y transiciones de scroll (GSAP).

## Estructura

```
site/
  index.html      → página principal (hero, secciones por monumento, 3D, video, footer)
  css/styles.css  → estilos propios (grano de cine, viñeta, Ken Burns, responsive)
  js/main.js      → navegación, animaciones GSAP/ScrollTrigger, tarjetas de video
  js/flor3d.js    → escena Three.js: flor de 16 pétalos que se abren/cierran
assets/
  img/            → fotos reales de los monumentos (verificadas)
  video/          → clips ambiente generados con Veo (revisar fidelidad)
Dockerfile        → despliegue como sitio estático en Railway (nginx)
```

## Desarrollo local

Sin build step. Sirve la carpeta `site/` con cualquier servidor estático,
por ejemplo:

```bash
cd site && python3 -m http.server 8000
```

Ojo: `index.html` referencia los assets como `../assets/...`,
así que para ver imágenes y videos hay que servir desde la raíz del proyecto
o usar el Dockerfile.

## Despliegue

Automático en Railway desde este repo (servicio estático con nginx).
Cada push a `main` redespliega.

## Notas

- Todo el texto está en español (es-419).
- Los datos históricos de cada monumento están en `site/index.html`; no inventar datos nuevos.
- Las fotos de `assets/img/` son reales y verificadas. Las imágenes generadas
  con IA se descartaron porque no se parecían a los monumentos reales.
- Los videos de `assets/video/` son generados con IA (Veo 3 Fast): se revisaron
  el 25 Sep 2026 y muestran los monumentos con buena fidelidad
  (Obelisco con su reloj en la redoma, Flor de 16 pétalos, Manto con las dos
  torres y la Virgen tubular).
