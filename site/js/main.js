/* ============================================================================
   main.js — Lógica general de la landing (edición "aires de Awwwards")
   ----------------------------------------------------------------------------
   1. Catálogo de videos ambiente
   2. Scroll suave con inercia (Lenis) + integración GSAP
   3. Navegación (se oculta al bajar) + barra de progreso
   4. Tarjetas de video generadas desde el catálogo + reproducción inteligente
   5. Preloader cinematográfico + entrada del hero (split por caracteres)
   6. Motor de splits (chars/words) + revelados por scroll
   7. Cursor personalizado + botones magnéticos
   8. Escenas de video fijadas (Obelisco / Flor / Manto): el scroll dirige el clip
   9. Sonido ambiente generativo (Web Audio, inspirado en el golpe larense)
   10. Anclas con scroll suave
   ============================================================================ */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     1. CATÁLOGO DE VIDEOS AMBIENTE
  -------------------------------------------------------------------------- */
  var VIDEOS_AMBIENTE = [
    {
      src: '../assets/video/video-obelisco.mp4?v=20260925b',
      titulo: 'Órbita sobre el Obelisco',
      descripcion: 'Vuelo de dron alrededor del monumento al atardecer.'
    },
    {
      src: '../assets/video/video-flor.mp4?v=20260925b',
      titulo: 'Flor de Venezuela al atardecer',
      descripcion: 'Órbita aérea sobre los pétalos blancos.'
    },
    {
      src: '../assets/video/video-manto.mp4?v=20260925b',
      titulo: 'Manto de María al anochecer',
      descripcion: 'La Virgen cinética entre las dos torres.'
    }
  ];

  var reduceMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var punteroFino = window.matchMedia('(pointer: fine)').matches;

  /* --------------------------------------------------------------------------
     2. LENIS: scroll suave con inercia
     Sin Lenis (o con "reducir movimiento") la página usa el scroll nativo.
  -------------------------------------------------------------------------- */
  var lenis = null;
  if (!reduceMovimiento && window.Lenis && window.gsap) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (tiempo) { lenis.raf(tiempo * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // El preloader bloquea el scroll hasta que termina la entrada.
  function bloquearScroll(si) {
    if (lenis) { si ? lenis.stop() : lenis.start(); }
    document.documentElement.style.overflow = si ? 'hidden' : '';
  }

  /* --------------------------------------------------------------------------
     3. NAVEGACIÓN + BARRA DE PROGRESO
     La barra se oculta al bajar (para no tapar el 3D) y reaparece al subir.
  -------------------------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var barra = document.getElementById('barra-progreso');
  var ultimoY = 0;

  function alHacerScroll() {
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('scrolled', y > 40);
    if (!reduceMovimiento) {
      if (y > 500 && y > ultimoY + 4) { nav.classList.add('oculta'); }
      else if (y < ultimoY - 4) { nav.classList.remove('oculta'); }
    }
    ultimoY = y;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    barra.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
  }
  if (lenis) { lenis.on('scroll', alHacerScroll); }
  else { window.addEventListener('scroll', alHacerScroll, { passive: true }); }
  alHacerScroll();

  document.getElementById('anio').textContent = new Date().getFullYear();

  /* --------------------------------------------------------------------------
     4. TARJETAS DE VIDEO (generadas desde VIDEOS_AMBIENTE)
  -------------------------------------------------------------------------- */
  var grid = document.getElementById('video-grid');

  VIDEOS_AMBIENTE.forEach(function (v) {
    var figura = document.createElement('figure');
    figura.className = 'video-card';
    figura.setAttribute('data-reveal', '');

    var video = document.createElement('video');
    video.src = v.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('aria-label', v.titulo);

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
     5 y 6. ANIMACIONES GSAP + SPLITS
     Si GSAP no cargó, la página sigue legible: se oculta el preloader
     y no hay animaciones ni escenas fijadas.
  -------------------------------------------------------------------------- */
  var preloader = document.getElementById('preloader');

  if (!window.gsap) {
    preloader.style.display = 'none';
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ---- 6. Motor de splits: divide un titular en chars o words ----
     Recursivo: respeta las etiquetas internas (<span class="italic">…).
     Cada unidad queda en .char-wrap > .char (máscara + letra) para
     animarlas con yPercent sin romper el flujo del texto. */
  function dividirTexto(el, modo) {
    if (el.hasAttribute('data-split-done')) { return; }
    el.setAttribute('data-split-done', '');
    Array.prototype.slice.call(el.childNodes).forEach(function (nodo) {
      if (nodo.nodeType === 3) {
        var frag = document.createDocumentFragment();
        var partes = modo === 'chars'
          ? nodo.textContent.split('')
          : nodo.textContent.split(/(\s+)/);
        partes.forEach(function (parte) {
          if (!parte) { return; }
          if (/^\s+$/.test(parte)) {
            // En modo chars los nodos de puro espacio entre bloques se
            // omiten (evitan huecos verticales); en words van como espacio.
            if (modo === 'words') { frag.appendChild(document.createTextNode(' ')); }
            return;
          }
          var wrap = document.createElement('span');
          wrap.className = modo === 'chars' ? 'char-wrap' : 'word-wrap';
          var inner = document.createElement('span');
          inner.className = modo === 'chars' ? 'char' : 'word';
          inner.textContent = parte;
          wrap.appendChild(inner);
          frag.appendChild(wrap);
        });
        el.replaceChild(frag, nodo);
      } else if (nodo.nodeType === 1) {
        dividirTexto(nodo, modo);
      }
    });
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

  // ---- Titulares con data-split="words": entran palabra por palabra ----
  if (!reduceMovimiento) {
    gsap.utils.toArray('[data-split="words"]').forEach(function (el) {
      dividirTexto(el, 'words');
      gsap.from(el.querySelectorAll('.word'), {
        yPercent: 120,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.035,
        scrollTrigger: { trigger: el, start: 'top 86%' }
      });
    });
  }

  /* ---- 5. Preloader + entrada del hero ----
     Contador 0→100, cortina que se levanta y coreografía del hero:
     el titular entra letra por letra (data-split="chars"). */
  function animarHero() {
    dividirTexto(document.querySelector('#inicio h1'), 'chars');
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('#inicio .char', { yPercent: 120, duration: 1.15, stagger: 0.028 }, 0)
      .from('.hero-fade', { y: 26, autoAlpha: 0, duration: 0.9, stagger: 0.1 }, 0.55)
      .from('#nav', { y: -24, autoAlpha: 0, duration: 0.8 }, 0.75)
      .from('#btn-sonido', { scale: 0, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.6)' }, 1.05);
  }

  if (reduceMovimiento) {
    preloader.style.display = 'none';
  } else {
    bloquearScroll(true);
    var numEl = document.getElementById('preloader-contador');
    var carga = { v: 0 };
    gsap.timeline()
      .to(carga, {
        v: 100,
        duration: 1.6,
        ease: 'power2.inOut',
        onUpdate: function () {
          var n = Math.round(carga.v);
          numEl.textContent = n;
          preloader.style.setProperty('--carga', (n / 100).toFixed(3));
        }
      })
      .to(preloader, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '+=0.15')
      .add(function () {
        preloader.style.display = 'none';
        bloquearScroll(false);
        ScrollTrigger.refresh();
      })
      .add(animarHero, '-=0.55');
  }

  /* --------------------------------------------------------------------------
     7. CURSOR PERSONALIZADO + BOTONES MAGNÉTICOS
     Solo con puntero fino (mouse) y sin "reducir movimiento".
  -------------------------------------------------------------------------- */
  if (punteroFino && !reduceMovimiento) {
    document.documentElement.classList.add('cursor-on');
    var punto = document.getElementById('cursor-punto');
    var anillo = document.getElementById('cursor-anillo');
    var mx = -100, my = -100, ax = -100, ay = -100, visto = false;

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!visto) {
        visto = true;
        punto.style.opacity = '1';
        anillo.style.opacity = '1';
        ax = mx; ay = my;
      }
      punto.style.transform = 'translate(' + (mx - 3) + 'px,' + (my - 3) + 'px)';
    });

    gsap.ticker.add(function () {
      ax += (mx - ax) * 0.16;
      ay += (my - ay) * 0.16;
      var mitad = anillo.classList.contains('grande') ? 32 : 17;
      anillo.style.transform = 'translate(' + (ax - mitad) + 'px,' + (ay - mitad) + 'px)';
    });

    // El anillo crece sobre elementos interactivos (delegación de eventos).
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('a, button, input, video')) { anillo.classList.add('grande'); }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a, button, input, video')) { anillo.classList.remove('grande'); }
    });

    // Botones magnéticos: siguen sutilmente al cursor y vuelven con rebote.
    document.querySelectorAll('.btn-primary, .btn-ghost').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (e.clientX - (r.left + r.width / 2)) * 0.3,
          y: (e.clientY - (r.top + r.height / 2)) * 0.3,
          duration: 0.4,
          ease: 'power3.out'
        });
      });
      btn.addEventListener('mouseleave', function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  /* --------------------------------------------------------------------------
     8. ESCENAS DE VIDEO FIJADAS (una por monumento)
     --------------------------------------------------------------------------
     Patrón por escena (aire Abeto: el scroll es el timeline):
       · ScrollTrigger fija el ".escena-stage" (100vh) en pantalla
         (pin, sin espacio extra: las tarjetas desfilan POR ENCIMA).
       · En escritorio, otro ScrollTrigger con scrub fija video.currentTime
         según el progreso: el scroll AVANZA el clip como si dirigiera la
         cámara. Los videos nunca se reproducen solos en la escena.
       · En táctil (hover: none) el scrub no es fiable: el video se
         reproduce solo (silencio, loop) mientras su escena está visible.
       · Los videos llevan póster del primer fotograma: evita el flash
         negro antes de que carguen.
     Con "reducir movimiento" no se fija ni se anima nada: el contenido
     queda apilado en flujo normal, los videos muestran su primer
     fotograma y todo sigue legible.
  -------------------------------------------------------------------------- */
  if (!reduceMovimiento) {

    // En pantallas táctiles el "scrub" cuadro a cuadro no es fiable
    // (el navegador puede no pintar los saltos de currentTime en un video
    // pausado): ahí el video se reproduce solo al entrar en escena.
    // En escritorio (hover + puntero fino) el scroll dirige el clip.
    var esTactil = window.matchMedia('(hover: none)').matches;

    // Fija un escenario en pantalla mientras su sección hace scroll.
    function fijarEscena(idSeccion, idStage) {
      ScrollTrigger.create({
        trigger: idSeccion,
        start: 'top top',
        end: 'bottom bottom',
        pin: idStage,
        pinSpacing: false,   // las tarjetas suben POR ENCIMA del escenario
        anticipatePin: 1
      });
    }

    // Disuelve el contenido superpuesto al final de cada escena para que
    // el mensaje de cierre quede limpio sobre el video (sin traslapes).
    function disolverAlFinal(idSeccion, idContenido, idVideoEscena) {
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: idSeccion,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1
        }
      });
      tl.to(idContenido, { autoAlpha: 0, yPercent: -6, ease: 'none', duration: 0.2 }, 0.8);
      if (idVideoEscena) {
        tl.to(idVideoEscena, { opacity: 0.3, ease: 'none', duration: 0.2 }, 0.8);
      }
      return tl;
    }

    // Modo táctil: reproduce el video (en silencio, en loop) mientras su
    // escena está en pantalla. No depende del scrub ni del fijado.
    function reproducirAlVer(idSeccion, idVideo) {
      var seccion = document.querySelector(idSeccion);
      var video = document.getElementById(idVideo);
      if (!seccion || !video) { return; }
      video.loop = true;
      var io = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          try {
            if (e.intersectionRatio >= 0.2) {
              video.play().catch(function () { /* autoplay bloqueado: noop */ });
            } else {
              video.pause();
            }
          } catch (err) { /* noop */ }
        });
      }, { threshold: [0, 0.2, 1] });
      io.observe(seccion);
    }

    // El scroll dirige el video: progreso 0→1 mapea a tiempo 0→duración.
    // Se evita fijar exactamente la duración (algunos navegadores
    // congelan el último fotograma en negro al llegar al final).
    function videoDirigidoPorScroll(idSeccion, idVideo) {
      var video = document.getElementById(idVideo);
      if (!video) { return; }
      var duracion = 0;
      function leerDuracion() {
        if (video.duration && isFinite(video.duration)) { duracion = video.duration; }
      }
      video.addEventListener('loadedmetadata', leerDuracion);
      leerDuracion();
      // Pinta el primer fotograma en cuanto hay datos (sin reproducir).
      video.addEventListener('loadeddata', function () {
        try { if (video.currentTime < 0.01) { video.currentTime = 0.01; } } catch (e) { /* noop */ }
      });
      ScrollTrigger.create({
        trigger: idSeccion,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: function (st) {
          if (!duracion) { leerDuracion(); }
          if (!duracion) { return; }
          try {
            var t = st.progress * duracion;
            if (t >= duracion) { t = duracion - 0.05; }
            if (Math.abs(video.currentTime - t) > 0.04) { video.currentTime = t; }
          } catch (e) { /* seek aún no disponible: noop */ }
        }
      });
    }

    /* ---- 8.1 OBELISCO: órbita de dron (scroll en escritorio, autoplay en táctil) ---- */
    fijarEscena('#escena-obelisco', '#obelisco-stage');
    if (esTactil) { reproducirAlVer('#escena-obelisco', '#obelisco-video'); }
    else { videoDirigidoPorScroll('#escena-obelisco', '#obelisco-video'); }
    disolverAlFinal('#escena-obelisco', '#obelisco-contenido', '#obelisco-video-escena')
      .to('.hint-obelisco', { autoAlpha: 0, duration: 0.08, ease: 'none' }, 0);

    /* ---- 8.2 FLOR: órbita aérea al atardecer ---- */
    fijarEscena('#escena-flor', '#flor-stage');
    if (esTactil) { reproducirAlVer('#escena-flor', '#flor-video'); }
    else { videoDirigidoPorScroll('#escena-flor', '#flor-video'); }
    disolverAlFinal('#escena-flor', '#flor-contenido', '#flor-video-escena');

    /* ---- 8.3 MANTO: travelling lateral frente a la Virgen ---- */
    fijarEscena('#escena-manto', '#manto-stage');
    if (esTactil) { reproducirAlVer('#escena-manto', '#manto-video'); }
    else { videoDirigidoPorScroll('#escena-manto', '#manto-video'); }
    disolverAlFinal('#escena-manto', '#manto-contenido', '#manto-video-escena')
      .to('.hint-manto', { autoAlpha: 0, duration: 0.08, ease: 'none' }, 0);

    // Recalcular los puntos de fijado cuando todo (incluidos videos) cargue
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  /* --------------------------------------------------------------------------
     9. SONIDO AMBIENTE GENERATIVO (Web Audio)
     --------------------------------------------------------------------------
     Composición ORIGINAL inspirada en el golpe larense (compás de 6/8):
     arpegio de cuatro + colchón de cuerdas sobre Am – F – C – G.
     No reproduce "Ah mundo Barquisimeto" (obra con derechos): es un
     ambiente propio con su aire folk. Sin archivos: todo se sintetiza
     en vivo con la Web Audio API.
     El navegador exige un gesto del usuario: el sonido arranca con el
     botón flotante (nunca en autoplay).
  -------------------------------------------------------------------------- */
  var btnSonido = document.getElementById('btn-sonido');
  var audio = { ctx: null, master: null, delay: null, sonando: false,
                timer: null, paso: 0, siguiente: 0, estabaSonando: false };

  function midiAFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // 8 compases de 6/8 en loop; el acorde cambia cada 2 compases.
  var ACORDES = [
    { bajo: 45, arpegio: [57, 60, 64, 69, 64, 60], melodia: [76, 74] }, // Am
    { bajo: 41, arpegio: [53, 57, 60, 65, 60, 57], melodia: [72, 69] }, // F
    { bajo: 48, arpegio: [60, 64, 67, 72, 67, 64], melodia: [79, 76] }, // C
    { bajo: 43, arpegio: [55, 59, 62, 67, 62, 59], melodia: [74, 71] }  // G
  ];
  var PASO_CORCHEA = 0.32; // ≈94 BPM en 6/8

  function construirAudio() {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // Eco suave: le da aire de plaza al atardecer.
    var delay = ctx.createDelay(1);
    delay.delayTime.value = 0.46;
    var fb = ctx.createGain(); fb.gain.value = 0.32;
    var wet = ctx.createGain(); wet.gain.value = 0.22;
    delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(master);
    audio.ctx = ctx; audio.master = master; audio.delay = delay;
  }

  // Punteo estilo cuatro: ataque rápido, caída corta, filtro cálido.
  function punteo(midi, t, vol, brillante) {
    var ctx = audio.ctx;
    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiAFreq(midi);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + (brillante ? 0.5 : 1.1));
    var filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = brillante ? 3800 : 2200;
    osc.connect(filtro); filtro.connect(g);
    g.connect(audio.master); g.connect(audio.delay);
    osc.start(t); osc.stop(t + 1.3);
  }

  // Colchón de cuerdas: entra despacio y sostiene cada acorde.
  function colchon(acorde, t, dur) {
    var ctx = audio.ctx;
    for (var i = 0; i < 3; i++) {
      (function (i) {
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = midiAFreq(acorde.arpegio[i] - 12);
        osc.detune.value = (i - 1) * 4;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 1.6);
        g.gain.setValueAtTime(0.05, t + Math.max(1.7, dur - 1.2));
        g.gain.linearRampToValueAtTime(0, t + dur);
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 750;
        osc.connect(f); f.connect(g); g.connect(audio.master);
        osc.start(t); osc.stop(t + dur + 0.1);
      })(i);
    }
  }

  // Planificador con lookahead: programa notas 0.4 s por adelantado.
  function programar() {
    var ctx = audio.ctx;
    while (audio.siguiente < ctx.currentTime + 0.4) {
      var t = audio.siguiente;
      var compas = Math.floor(audio.paso / 6) % 8;
      var acorde = ACORDES[Math.floor(compas / 2)];
      var s = audio.paso % 6;
      if (s === 0) { punteo(acorde.bajo, t, 0.5, false); }
      else { punteo(acorde.arpegio[s - 1], t, 0.3, true); }
      // Melodía escasa: dos notas altas en los compases pares.
      if (compas % 2 === 1 && (s === 2 || s === 4)) {
        punteo(acorde.melodia[s === 2 ? 0 : 1], t, 0.15, true);
      }
      if (audio.paso % 12 === 0) { colchon(acorde, t, PASO_CORCHEA * 12); }
      audio.siguiente += PASO_CORCHEA;
      audio.paso++;
    }
  }

  function pintarBotonSonido() {
    btnSonido.classList.toggle('sonando', audio.sonando);
    btnSonido.setAttribute('aria-pressed', audio.sonando ? 'true' : 'false');
    btnSonido.setAttribute('aria-label',
      audio.sonando ? 'Desactivar sonido ambiente' : 'Activar sonido ambiente');
  }

  function alternarSonido() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      btnSonido.style.display = 'none';
      return;
    }
    if (!audio.ctx) {
      try { construirAudio(); }
      catch (e) { btnSonido.style.display = 'none'; return; }
      audio.ctx.resume();
      audio.master.gain.linearRampToValueAtTime(0.16, audio.ctx.currentTime + 1.5);
      audio.siguiente = audio.ctx.currentTime + 0.1;
      audio.timer = setInterval(programar, 120);
      audio.sonando = true;
    } else if (audio.sonando) {
      audio.ctx.suspend();
      audio.sonando = false;
    } else {
      audio.ctx.resume();
      audio.sonando = true;
    }
    pintarBotonSonido();
  }
  btnSonido.addEventListener('click', alternarSonido);

  // Al ocultar la pestaña se pausa (ahorra batería); al volver, sigue.
  document.addEventListener('visibilitychange', function () {
    if (!audio.ctx) { return; }
    if (document.hidden && audio.sonando) {
      audio.estabaSonando = true;
      audio.ctx.suspend();
      audio.sonando = false;
      pintarBotonSonido();
    } else if (!document.hidden && audio.estabaSonando) {
      audio.estabaSonando = false;
      audio.ctx.resume();
      audio.sonando = true;
      pintarBotonSonido();
    }
  });

  /* --------------------------------------------------------------------------
     10. ANCLAS CON SCROLL SUAVE (respetan el Lenis)
  -------------------------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2) { return; }
      var destino = document.querySelector(id);
      if (!destino) { return; }
      e.preventDefault();
      if (lenis) { lenis.scrollTo(destino, { offset: -64, duration: 1.6 }); }
      else { destino.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
})();
