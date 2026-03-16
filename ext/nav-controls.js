// nav-controls.js — floating mouse-clickable navigation for remark.js
(function () {
  'use strict';

  var slideshow = window.slideshow;
  if (!slideshow || typeof slideshow.gotoNextSlide !== 'function') {
    return;
  }

  // ---------- Build the overlay ----------
  var overlay = document.createElement('div');
  overlay.className = 'nav-controls-overlay';

  var btnPrev = document.createElement('button');
  btnPrev.className = 'nav-btn-prev';
  btnPrev.setAttribute('aria-label', 'Previous slide');
  btnPrev.setAttribute('title', 'Previous');
  btnPrev.textContent = '\u2039'; // ‹

  var btnNext = document.createElement('button');
  btnNext.className = 'nav-btn-next';
  btnNext.setAttribute('aria-label', 'Next slide');
  btnNext.setAttribute('title', 'Next');
  btnNext.textContent = '\u203A'; // ›

  var btnHome = document.createElement('button');
  btnHome.className = 'nav-btn-home';
  btnHome.setAttribute('aria-label', 'First slide');
  btnHome.setAttribute('title', 'First slide');
  btnHome.textContent = '\u23EE'; // ⏮

  var btnEnd = document.createElement('button');
  btnEnd.className = 'nav-btn-end';
  btnEnd.setAttribute('aria-label', 'Last slide');
  btnEnd.setAttribute('title', 'Last slide');
  btnEnd.textContent = '\u23ED'; // ⏭

  overlay.appendChild(btnPrev);
  overlay.appendChild(btnNext);
  overlay.appendChild(btnHome);
  overlay.appendChild(btnEnd);
  document.body.appendChild(overlay);

  // ---------- Stepwise-SVG integration ----------
  function getActiveStepSlide() {
    if (typeof window._stepwiseSvgActive === 'function') {
      return window._stepwiseSvgActive();
    }
    return null;
  }

  // ---------- Navigation handlers ----------
  btnNext.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var step = getActiveStepSlide();
    if (step && step.stepForward()) {
      return;
    }
    slideshow.gotoNextSlide();
  });

  btnPrev.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var step = getActiveStepSlide();
    if (step && step.stepBackward()) {
      return;
    }
    slideshow.gotoPreviousSlide();
  });

  btnHome.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    slideshow.gotoFirstSlide();
  });

  btnEnd.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    slideshow.gotoLastSlide();
  });

  // ---------- Auto-hide after 3 seconds of mouse inactivity ----------
  var hideTimer = null;
  var HIDE_DELAY = 3000;

  function showControls() {
    overlay.classList.add('nav-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      overlay.classList.remove('nav-visible');
    }, HIDE_DELAY);
  }

  document.addEventListener('mousemove', showControls);
  // Also show on any mouse button press (e.g., touchpad click without move)
  document.addEventListener('mousedown', showControls);

  // Show initially for a moment so the presenter knows controls exist
  showControls();

  // ---------- Roulette integration ----------
  // On roulette slides, inject play/skip/stop buttons into the .rr-controls bar.
  var rouletteButtonsAdded = false;

  function addRouletteButtons(root) {
    if (!window.Roulette) return;
    var controls = root.querySelector('.rr-controls');
    if (!controls) return;

    // Avoid duplicates
    if (controls.querySelector('.nav-roulette-btn')) return;

    var sep = document.createElement('span');
    sep.className = 'rr-sep';
    sep.textContent = '|';

    var btnPlay = document.createElement('button');
    btnPlay.className = 'nav-roulette-btn';
    btnPlay.setAttribute('title', 'Start / Pause (Space)');
    btnPlay.textContent = '\u25B6'; // ▶
    btnPlay.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!window.Roulette._active) {
        window.Roulette._startRoulette(root);
      } else {
        window.Roulette._togglePause();
      }
    });

    var btnSkip = document.createElement('button');
    btnSkip.className = 'nav-roulette-btn';
    btnSkip.setAttribute('title', 'Skip (S)');
    btnSkip.textContent = '\u23ED'; // ⏭
    btnSkip.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.Roulette._active) {
        window.Roulette._skip();
      }
    });

    var btnStop = document.createElement('button');
    btnStop.className = 'nav-roulette-btn';
    btnStop.setAttribute('title', 'Stop (K)');
    btnStop.textContent = '\u23F9'; // ⏹
    btnStop.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.Roulette._teardownRoulette();
    });

    controls.appendChild(sep);
    controls.appendChild(btnPlay);
    controls.appendChild(btnSkip);
    controls.appendChild(btnStop);
    rouletteButtonsAdded = true;
  }

  function removeRouletteButtons() {
    if (!rouletteButtonsAdded) return;
    // Clean up is handled automatically when roulette teardown re-renders controls
    rouletteButtonsAdded = false;
  }

  slideshow.on('afterShowSlide', function () {
    var root = document.querySelectorAll(
      '.remark-slide-container.remark-visible .remark-slide-content'
    );
    var content = root[root.length - 1];
    if (!content) return;

    if (content.classList.contains('roulette') && window.Roulette) {
      // Small delay to let roulette.js mount its controls first
      setTimeout(function () { addRouletteButtons(content); }, 0);
    } else {
      removeRouletteButtons();
    }
  });
})();
