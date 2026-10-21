// nav-controls.js — bottom navigation bar for remark.js
(function () {
  'use strict';

  var slideshow = window.slideshow;
  if (!slideshow || typeof slideshow.gotoNextSlide !== 'function') {
    return;
  }

  // ---------- Build the bottom bar ----------
  var hoverZone = document.createElement('div');
  hoverZone.className = 'nav-controls-hover-zone';

  var bar = document.createElement('div');
  bar.className = 'nav-controls-bar';

  var btnHome = document.createElement('button');
  btnHome.className = 'nav-btn';
  btnHome.setAttribute('aria-label', 'First slide');
  btnHome.setAttribute('title', 'First slide');
  btnHome.textContent = '\u23EE'; // ⏮

  var btnPrev = document.createElement('button');
  btnPrev.className = 'nav-btn nav-btn-prev';
  btnPrev.setAttribute('aria-label', 'Previous slide');
  btnPrev.setAttribute('title', 'Previous');
  btnPrev.textContent = '\u2039'; // ‹

  var slideInput = document.createElement('input');
  slideInput.className = 'nav-slide-input';
  slideInput.type = 'number';
  slideInput.min = '1';
  slideInput.setAttribute('aria-label', 'Slide number');
  slideInput.setAttribute('title', 'Type slide number + Enter');

  var slideCount = document.createElement('span');
  slideCount.className = 'nav-slide-count';

  var btnNext = document.createElement('button');
  btnNext.className = 'nav-btn nav-btn-next';
  btnNext.setAttribute('aria-label', 'Next slide');
  btnNext.setAttribute('title', 'Next');
  btnNext.textContent = '\u203A'; // ›

  var btnEnd = document.createElement('button');
  btnEnd.className = 'nav-btn';
  btnEnd.setAttribute('aria-label', 'Last slide');
  btnEnd.setAttribute('title', 'Last slide');
  btnEnd.textContent = '\u23ED'; // ⏭

  var btnFs = document.createElement('button');
  btnFs.className = 'nav-btn nav-btn-fs';
  btnFs.setAttribute('aria-label', 'Toggle fullscreen');
  btnFs.setAttribute('title', 'Fullscreen (F)');
  btnFs.textContent = '⛶';

  // An inline icon: no printer glyph renders alike across platforms.
  var PRINTER_ICON =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 9V2h12v7"/>' +
    '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>' +
    '<rect x="6" y="14" width="12" height="8"/></svg>';

  var btnPrint = document.createElement('button');
  btnPrint.className = 'nav-btn nav-btn-print';
  btnPrint.setAttribute('aria-label', 'Print');
  btnPrint.setAttribute('title', 'Print');
  btnPrint.innerHTML = PRINTER_ICON;

  bar.appendChild(btnHome);
  bar.appendChild(btnPrev);
  bar.appendChild(slideInput);
  bar.appendChild(slideCount);
  bar.appendChild(btnNext);
  bar.appendChild(btnEnd);
  bar.appendChild(btnFs);
  bar.appendChild(btnPrint);

  document.body.appendChild(hoverZone);
  document.body.appendChild(bar);

  // ---------- Block remark.js from seeing events on the bar ----------
  // remark.js listens for mousedown/click on the document to advance slides.
  // We must stop propagation at the bar level for ALL event types remark uses.
  ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend'].forEach(function (evt) {
    bar.addEventListener(evt, function (e) {
      e.stopPropagation();
    }, false);
  });

  // ---------- Stepwise-SVG integration ----------
  function getActiveStepSlide() {
    if (typeof window._stepwiseSvgActive === 'function') {
      return window._stepwiseSvgActive();
    }
    return null;
  }

  // ---------- Slide number from URL hash (source of truth) ----------
  // remark.js updates location.hash via replaceState (no hashchange event),
  // so we read the hash directly whenever afterShowSlide fires.
  function slideNoFromHash() {
    var h = window.location.hash.replace(/^#/, '');
    var n = parseInt(h, 10);
    return (n >= 1) ? n : 1;
  }

  function totalSlides() {
    return slideshow.getSlideCount();
  }

  function syncInput() {
    if (document.activeElement === slideInput) return;
    slideInput.value = slideNoFromHash();
    slideInput.max = totalSlides();
    slideCount.textContent = '/ ' + totalSlides();
  }

  // Defer to next tick so remark finishes its replaceState before we read the hash
  slideshow.on('afterShowSlide', function () { setTimeout(syncInput, 0); });
  window.addEventListener('hashchange', syncInput);
  syncInput();

  // ---------- Navigation handlers ----------
  btnNext.addEventListener('click', function (e) {
    e.preventDefault();
    var step = getActiveStepSlide();
    if (step && step.stepForward()) {
      return;
    }
    slideshow.gotoNextSlide();
  });

  btnPrev.addEventListener('click', function (e) {
    e.preventDefault();
    var step = getActiveStepSlide();
    if (step && step.stepBackward()) {
      return;
    }
    slideshow.gotoPreviousSlide();
  });

  btnHome.addEventListener('click', function (e) {
    e.preventDefault();
    slideshow.gotoFirstSlide();
  });

  btnEnd.addEventListener('click', function (e) {
    e.preventDefault();
    slideshow.gotoLastSlide();
  });

  // ---------- Fullscreen ----------
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function toggleFullscreen() {
    var doc = document, root = doc.documentElement;
    if (isFullscreen()) {
      var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) exit.call(doc);
    } else {
      var enter = root.requestFullscreen || root.webkitRequestFullscreen;
      if (enter) enter.call(root);
    }
  }

  function syncFsIcon() {
    if (isFullscreen()) {
      btnFs.textContent = '⤢'; // ⤢ (compress)
      btnFs.setAttribute('aria-label', 'Exit fullscreen');
    } else {
      btnFs.textContent = '⛶'; // ⛶ (expand)
      btnFs.setAttribute('aria-label', 'Toggle fullscreen');
    }
  }

  btnFs.addEventListener('click', function (e) {
    e.preventDefault();
    toggleFullscreen();
  });
  document.addEventListener('fullscreenchange', syncFsIcon);
  document.addEventListener('webkitfullscreenchange', syncFsIcon);

  // ---------- Print ----------
  // The audience view prints the slides; presenter mode prints a handout with
  // the notes (core/base.css). remarkEngine.print() loads every SVG first.
  function printDeck(trigger) {
    if (trigger.getAttribute('aria-busy') === 'true') return;
    trigger.setAttribute('aria-busy', 'true');
    function done() { trigger.removeAttribute('aria-busy'); }

    var engine = window.remarkEngine;
    if (engine && typeof engine.print === 'function') {
      engine.print().then(done, done);
    } else {
      window.print();
      done();
    }
  }

  btnPrint.addEventListener('click', function (e) {
    e.preventDefault();
    btnPrint.blur();
    printDeck(btnPrint);
  });

  // The same button in remark's presenter toolbar, after the notes' + and -.
  // remark binds its toolbar links when it builds them, so this one is ours alone.
  var toolbar = document.querySelector('.remark-notes-area .remark-toolbar');
  if (toolbar) {
    var linkPrint = document.createElement('a');
    linkPrint.className = 'remark-toolbar-link remark-toolbar-print';
    linkPrint.href = '#print';
    linkPrint.setAttribute('aria-label', 'Print slides with notes');
    linkPrint.setAttribute('title', 'Print slides with notes');
    linkPrint.innerHTML = PRINTER_ICON;
    toolbar.insertBefore(linkPrint, toolbar.querySelector('.remark-toolbar-timer'));

    linkPrint.addEventListener('click', function (e) {
      e.preventDefault();   // #print would send remark to the first slide
      e.stopPropagation();
      printDeck(linkPrint);
    });
  }

  // ---------- Slide number input ----------
  slideInput.addEventListener('keydown', function (e) {
    e.stopPropagation(); // prevent remark from handling arrow keys etc.
    if (e.key === 'Enter') {
      e.preventDefault();
      var num = parseInt(slideInput.value, 10);
      var total = totalSlides();
      if (num >= 1 && num <= total) {
        window.location.hash = '#' + num;
        slideInput.blur();
      } else {
        slideInput.classList.add('nav-slide-input--error');
        setTimeout(function () {
          slideInput.classList.remove('nav-slide-input--error');
          syncInput();
        }, 350);
      }
    } else if (e.key === 'Escape') {
      syncInput();
      slideInput.blur();
    }
  });

  slideInput.addEventListener('keyup', function (e) { e.stopPropagation(); });
  slideInput.addEventListener('keypress', function (e) { e.stopPropagation(); });
  slideInput.addEventListener('blur', function () { syncInput(); });

  // ---------- Show/hide on hover over bottom edge ----------
  var hideTimer = null;
  var HIDE_DELAY = 600;

  function showBar() {
    bar.classList.add('nav-visible');
    clearTimeout(hideTimer);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      // Don't hide if input is focused
      if (document.activeElement === slideInput) return;
      bar.classList.remove('nav-visible');
    }, HIDE_DELAY);
  }

  hoverZone.addEventListener('mouseenter', showBar);
  hoverZone.addEventListener('mouseleave', scheduleHide);
  bar.addEventListener('mouseenter', showBar);
  bar.addEventListener('mouseleave', scheduleHide);

  // ---------- Roulette integration ----------
  function addRouletteButtons(root) {
    if (!window.Roulette) return;
    var controls = root.querySelector('.rr-controls');
    if (!controls) return;
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
  }

  slideshow.on('afterShowSlide', function () {
    var root = document.querySelectorAll(
      '.remark-slide-container.remark-visible .remark-slide-content'
    );
    var content = root[root.length - 1];
    if (!content) return;

    if (content.classList.contains('roulette') && window.Roulette) {
      setTimeout(function () { addRouletteButtons(content); }, 0);
    }
  });
})();
