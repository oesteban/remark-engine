// remark-engine: make <object>-embedded SVGs survive printing.
//
// THE BUG
// remark keeps every slide in the DOM but renders only the current one
// (.remark-slide-container is display:none otherwise). Chrome does not
// instantiate an <object>'s document while it sits in a display:none subtree:
// the file is never even requested. So every slide you have not visited yet
// holds an empty <object>.
//
// Printing reveals all slides through remark's print stylesheet, but by then
// it is too late. Loading is asynchronous and the print snapshot has already
// been taken, so unvisited slides print blank. Symptom: a deck prints fine if
// you happen to have paged through it first, and blank if you print it cold,
// which is why this looks intermittent.
//
// WHAT DOES NOT WORK
// Prefetching the file (fetch/<link rel=preload>) does nothing. What decides
// the outcome is whether the element has instantiated its document, not
// whether the bytes are in the HTTP cache. Verified: with the SVG already
// cached, the slide still prints blank.
//
// THE FIX
// Once, at startup, render each affected slide off-screen just long enough for
// its objects to fire `load`, then restore it. An <object> that has loaded
// stays loaded when it is hidden again.
//
// Opt in per deck, after core/engine.js:
//   <script src="../../remark/ext/svg-preload.js"></script>
(function () {
  'use strict';

  var SEL = 'object[type="image/svg+xml"]';
  var MARKER = 'data-remark-preloaded';
  var TIMEOUT = 8000;   // never leave a slide forced open, whatever happens

  function preloadContainer(container, objects) {
    var pending = objects.length;
    var restored = false;
    // Remember the inline style verbatim: remark also writes to it.
    var previous = container.getAttribute('style');

    function restore() {
      if (restored) { return; }
      restored = true;
      if (previous === null) {
        container.removeAttribute('style');
      } else {
        container.setAttribute('style', previous);
      }
    }

    function settled() {
      pending -= 1;
      if (pending <= 0) { restore(); }
    }

    objects.forEach(function (obj) {
      obj.setAttribute(MARKER, '1');
      obj.addEventListener('load', settled);
      obj.addEventListener('error', settled);
    });

    // Rendered, so the load happens, but out of the way and non-interactive.
    container.style.setProperty('display', 'block', 'important');
    container.style.setProperty('position', 'absolute', 'important');
    container.style.setProperty('left', '-99999px', 'important');
    container.style.setProperty('top', '0', 'important');
    container.style.setProperty('visibility', 'hidden', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');

    setTimeout(restore, TIMEOUT);
  }

  function run() {
    var objects = document.querySelectorAll(SEL);
    var groups = [];
    var byContainer = [];

    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i];
      if (obj.hasAttribute(MARKER)) { continue; }
      var container = obj.closest ? obj.closest('.remark-slide-container') : null;
      // No hidden ancestor to fight: it will load on its own.
      if (!container || window.getComputedStyle(container).display !== 'none') {
        continue;
      }
      var at = byContainer.indexOf(container);
      if (at === -1) {
        byContainer.push(container);
        groups.push([obj]);
      } else {
        groups[at].push(obj);
      }
    }

    for (var g = 0; g < groups.length; g++) {
      preloadContainer(byContainer[g], groups[g]);
    }
  }

  // remark has built the slide DOM by the time deck scripts run, but give the
  // scaler a frame to settle before forcing layout on every slide at once.
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(function () { window.requestAnimationFrame(run); });
  } else {
    setTimeout(run, 0);
  }
})();
