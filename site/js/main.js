/* ============================================================================
   main.js — Lógica general de la landing
   ----------------------------------------------------------------------------
   1. Catálogo de videos ambiente (AQUÍ se agrega el 3er video cuando llegue)
   2. Navegación + barra de progreso
   3. Animaciones de entrada del hero (GSAP)
   4. Revelados por scroll, parallax de imágenes y contadores (ScrollTrigger)
   5. Reproducción inteligente de los videos (solo cuando se ven en pantalla)
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
     simplemente no habrá animaciones.
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

  // ---- Parallax sutil en las fotos de los monumentos ----
  if (!reduceMovimiento) {
    gsap.utils.toArray('[data-parallax]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: { trigger: img.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  // ---- Contadores animados (75 m, 16 pétalos, 3.772 piezas…) ----
  document.querySelectorAll('[data-contador]').forEach(function (el) {
    var destino = parseFloat(el.getAttribute('data-contador'));
    var decimales = parseInt(el.getAttribute('data-decimales') || '0', 10);
    var prefijo = el.getAttribute('data-prefijo') || '';
    var sufijo = el.getAttribute('data-sufijo') || '';

    // Formato es-VE: miles con punto (3.772), decimales con coma (47,14)
    function formato(n) {
      return n.toLocaleString('es-VE', {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
      });
    }

    function pintar(valor) {
      el.textContent = prefijo + formato(valor) + sufijo;
    }

    if (reduceMovimiento) { pintar(destino); return; }

    var estado = { valor: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: function () {
        gsap.to(estado, {
          valor: destino,
          duration: 1.6,
          ease: 'power2.out',
          onUpdate: function () { pintar(estado.valor); },
          onComplete: function () { pintar(destino); }
        });
      }
    });
  });
})();
