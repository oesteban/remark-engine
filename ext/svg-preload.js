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
// stays loaded when it is hidden again. The mechanism lives in core/engine.js
// (remarkEngine.preloadObjects), because the print buttons run it too, before
// every print. Ctrl+P cannot wait for it: `beforeprint` is synchronous. In a
// deck without this file, only the print buttons preload.
//
// Opt in per deck, after core/engine.js:
//   <script src="../../remark/ext/svg-preload.js"></script>
(function () {
  'use strict';

  if (!window.remarkEngine) {
    return;
  }

  // remark has built the slide DOM by the time deck scripts run, but give the
  // scaler a frame to settle before forcing layout on every slide at once.
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(window.remarkEngine.preloadObjects);
    });
  } else {
    setTimeout(window.remarkEngine.preloadObjects, 0);
  }
})();
