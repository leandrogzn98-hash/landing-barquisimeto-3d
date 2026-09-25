/* ============================================================================
   main.js — Lógica general de la landing
   ----------------------------------------------------------------------------
   1. Catálogo de videos ambiente
   2. Navegación + barra de progreso
   3. Tarjetas de video generadas desde el catálogo + reproducción inteligente
   4. Animaciones GSAP: entrada del hero y revelados por scroll
   5. Escenas fijadas por monumento (Obelisco / Flor / Manto) con scrub
   ============================================================================ */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     1. CATÁLOGO DE VIDEOS AMBIENTE
     --------------------------------------------------------------------------
     ★ SLOT PARA EL TERCER VIDEO ★
     Cuando llegue el archivo del tercer video (el que falta de Veo):
       1. Cópialo a ../assets/video/
       2. Descomenta el tercer objeto de abajo y escribe su nombre de archivo,
          su título y su descripción.
     No hay que tocar el HTML: las tarjetas se generan solas desde este arreglo.
  -------------------------------------------------------------------------- */
  var VIDEOS_AMBIENTE = [
    {
      src: '../assets/video/video-obelisco.mp4',
      titulo: 'Órbita sobre el Obelisco',
      descripcion: 'Vuelo de dron alrededor del monumento al atardecer.'
    },
    {
      src: '../assets/video/video-flor.mp4',
      titulo: 'Flor de Venezuela de noche',
      descripcion: 'Los 16 pétalos metálicos iluminados.'
    },
    {
      src: '../assets/video/video-manto.mp4',
      titulo: 'Manto de María al anochecer',
      descripcion: 'La Virgen cinética entre las dos torres.'
    }
  ];

  var reduceMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------------------------
     2. NAVEGACIÓN + BARRA DE PROGRESO
  -------------------------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var barra = document.getElementById('barra-progreso');

  function alHacerScroll() {
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('scrolled', y > 40);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? y / max : 0;
    barra.style.transform = 'scaleX(' + p + ')';
  }
  window.addEventListener('scroll', alHacerScroll, { passive: true });
  alHacerScroll();

  // Año dinámico en el pie de página
  document.getElementById('anio').textContent = new Date().getFullYear();

  /* --------------------------------------------------------------------------
     3. TARJETAS DE VIDEO (generadas desde VIDEOS_AMBIENTE)
  -------------------------------------------------------------------------- */
  var grid = document.getElementById('video-grid');

  VIDEOS_AMBIENTE.forEach(function (v) {
    var figura = document.createElement('figure');
    figura.className = 'video-card';
    figura.setAttribute('data-reveal', '');

    var video = document.createElement('video');
    video.src = v.src;
    video.muted = true;          // sin sonido: es "ambiente"
    video.loop = true;
    video.playsInline = true;    // iOS: reproducir dentro de la página
    video.preload = 'none';      // no descargar hasta que se vea (rendimiento)
    video.setAttribute('aria-label', v.titulo);

    // Clic = pausar / reanudar manualmente
    video.addEventListener('click', function () {
      if (video.paused) { video.play(); } else { video.pause(); }
    });

    var pie = document.createElement('figcaption');
    var h3 = document.createElement('h3');
    h3.className = 'font-display text-xl';
    h3.textContent = v.titulo;
    var p = document.createElement('p');
    p.className = 'text-sm text-hueso/50';
    p.textContent = v.descripcion;
    pie.appendChild(h3);
    pie.appendChild(p);

    figura.appendChild(video);
    figura.appendChild(pie);
    grid.appendChild(figura);
  });

  // Reproducir solo el video que está en pantalla (ahorra batería y datos)
  var observadorVideos = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      var video = e.target;
      if (e.intersectionRatio >= 0.4) {
        video.play().catch(function () { /* autoplay bloqueado: no pasa nada */ });
      } else {
        video.pause();
      }
    });
  }, { threshold: [0, 0.4, 1] });

  grid.querySelectorAll('video').forEach(function (video) {
    observadorVideos.observe(video);
  });

  /* --------------------------------------------------------------------------
     4. ANIMACIONES GSAP
     Si GSAP no cargó (sin conexión al CDN), la página sigue legible:
     simplemente no habrá animaciones ni escenas fijadas.
  -------------------------------------------------------------------------- */
  if (!window.gsap) { return; }
  gsap.registerPlugin(ScrollTrigger);

  // ---- Entrada del hero (líneas del titular + elementos suaves) ----
  if (!reduceMovimiento) {
    var tlHero = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tlHero
      .from('.hero-line', { yPercent: 110, duration: 1.1, stagger: 0.12 }, 0.2)
      .from('.hero-fade', { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.12 }, 0.6);
  }

  // ---- Revelado genérico: todo lo marcado con [data-reveal] ----
  gsap.utils.toArray('[data-reveal]').forEach(function (el) {
    if (reduceMovimiento) { return; }
    gsap.from(el, {
      y: 36,
      autoAlpha: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  /* --------------------------------------------------------------------------
     5. ESCENAS FIJADAS (una por monumento)
     --------------------------------------------------------------------------
     Patrón por escena:
       · ScrollTrigger fija el ".escena-stage" (100vh) en pantalla
         (pin, sin espacio extra: las tarjetas desfilan POR ENCIMA).
       · Otro ScrollTrigger con scrub anima el escenario según el avance:
         Obelisco = la foto baja/achica y el sol se desplaza;
         Flor     = los pétalos se abren (0→1) y se cierran (1→0);
         Manto    = la foto hace zoom de acercamiento (close-up).
     Con "reducir movimiento" no se fija ni se anima nada: el contenido
     queda apilado en flujo normal y todo sigue legible.
  -------------------------------------------------------------------------- */
  if (reduceMovimiento) { return; }

  // Fija un escenario en pantalla mientras su sección hace scroll.
  function fijarEscena(idSeccion, idStage) {
    ScrollTrigger.create({
      trigger: idSeccion,
      start: 'top top',
      end: 'bottom bottom',
      pin: idStage,
      pinSpacing: false,   // las tarjetas suben POR ENCIMA del escenario
      anticipatePin: 1     // evita saltos al fijar/liberar
    });
  }

  /* ---- 5.1 OBELISCO: el guardián y el sol ----
     Al avanzar el scroll: la foto desciende un poco y se achica,
     el sol se desplaza hacia abajo detrás, y la pista "Sigue bajando"
     se desvanece al empezar. */
  fijarEscena('#escena-obelisco', '#obelisco-stage');
  gsap.timeline({
    scrollTrigger: {
      trigger: '#escena-obelisco',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1             // la animación sigue al scroll, sin retardos
    }
  })
    .to('#obelisco-marco', {
      yPercent: 16,        // desciende…
      scale: 0.88,         // …y se achica levemente
      rotation: 1.2,       // mecida sutil, como si respirara
      ease: 'none',
      duration: 0.85
    }, 0)
    .to('#obelisco-sol', {
      yPercent: 34,        // el sol "baja" en el cielo
      scale: 1.18,
      ease: 'none',
      duration: 0.85
    }, 0)
    .to('.hint-obelisco', { autoAlpha: 0, duration: 0.08, ease: 'none' }, 0)
    // Al final, el contenido se disuelve en el atardecer para que el
    // mensaje de cierre quede limpio sobre el cielo (sin traslapes).
    .to('#obelisco-contenido', {
      autoAlpha: 0,
      yPercent: -6,
      ease: 'none',
      duration: 0.2
    }, 0.8);

  /* ---- 5.2 FLOR: el scroll abre y cierra los pétalos ----
     progreso 0 → 0.5 : apertura 0 → 1 (se abre)
     progreso 0.5 → 1 : apertura 1 → 0 (se cierra)
     Se llama a window.__flor3d.setApertura(), que expone flor3d.js.
     (El módulo 3D carga diferido: por eso se verifica que exista.) */
  fijarEscena('#escena-flor', '#flor-stage');
  ScrollTrigger.create({
    trigger: '#escena-flor',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    onUpdate: function (st) {
      var p = st.progress;
      var apertura = p < 0.5 ? p * 2 : (1 - p) * 2; // 0→1→0
      if (window.__flor3d && typeof window.__flor3d.setApertura === 'function') {
        window.__flor3d.setApertura(apertura);
      }
    }
  });

  // Al final de la escena, el título se disuelve y el canvas se atenúa
  // para que el mensaje de cierre quede limpio sobre el fondo estrellado.
  gsap.timeline({
    scrollTrigger: {
      trigger: '#escena-flor',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1
    }
  })
    .to('#flor-contenido', {
      autoAlpha: 0,
      yPercent: -6,
      ease: 'none',
      duration: 0.2
    }, 0.8)
    .to('#flor3d-escena', {
      opacity: 0.3,
      ease: 'none',
      duration: 0.2
    }, 0.8);

  /* ---- 5.3 MANTO: close-up progresivo ----
     La foto escala de 1 a 1.8 con un leve paneo: es como si la cámara
     se acercara a la Virgen mientras lees. */
  fijarEscena('#escena-manto', '#manto-stage');
  gsap.timeline({
    scrollTrigger: {
      trigger: '#escena-manto',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1
    }
  })
    .to('#manto-foto', {
      scale: 1.8,          // close-up
      xPercent: -3,        // paneo leve a la izquierda…
      yPercent: 5,         // …y hacia abajo, siguiendo a la Virgen
      ease: 'none',
      duration: 0.85
    }, 0)
    .to('.hint-manto', { autoAlpha: 0, duration: 0.08, ease: 'none' }, 0)
    // Al final, el título se disuelve y la foto se atenúa para que el
    // mensaje de cierre quede limpio (sin traslapes).
    .to('#manto-contenido', {
      autoAlpha: 0,
      yPercent: -6,
      ease: 'none',
      duration: 0.2
    }, 0.8)
    .to('#manto-foto', {
      opacity: 0.35,
      ease: 'none',
      duration: 0.2
    }, 0.8);

  // Recalcular los puntos de fijado cuando todo (incluidas imágenes) cargue
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
