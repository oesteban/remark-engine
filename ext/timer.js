// timer.js — countdown timer for remark.js slides
// Usage in markdown: .timer[in 10 minutes] or <span class="timer" data-until="2025-09-18T08:15:00+02:00"></span>
(function attachTimers(slideshow) {
  'use strict';

  var slideshow = window.slideshow;
  if (!slideshow || typeof slideshow.on !== 'function') {
    return;
  }

  var SEL = 'span.timer';

  // --- tiny parser: "1h 5m 30s", "10 min", "mm:ss", "hh:mm:ss", or bare minutes ---
  function parseSecs(s) {
    s = (s || '').trim().toLowerCase();
    var m;
    if ((m = s.match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/))) return (+m[1])*3600 + (+m[2])*60 + (+m[3]);
    if ((m = s.match(/^([0-5]?\d):([0-5]?\d)$/)))            return (+m[1])*60   + (+m[2]);
    var total = 0, hit = false;
    s.replace(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\b/g,
      function(_, n, u) { hit = true; n = parseFloat(n);
        if (/^h/.test(u)) total += Math.round(n*3600);
        else if (/^m(?!s)/.test(u)) total += Math.round(n*60);
        else total += Math.round(n);
      });
    if (hit) return total;
    var bare = parseFloat(s);
    return Number.isFinite(bare) ? Math.round(bare*60) : null; // bare number = minutes
  }

  function fmt(secs) {
    secs = Math.max(0, Math.floor(secs));
    var h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
    return h ? (h + ' hr ' + m + ' min') : (m ? (m + ' min ' + s + ' sec') : (s + ' sec'));
  }

  function start(el, secs) {
    if (el.dataset.timerRunning === '1') return;
    if (!el.dataset.original) el.dataset.original = el.textContent;
    el.dataset.timerRunning = '1';
    el.classList.add('started');
    var end = Date.now() + secs*1000;
    var tick = function() {
      var remain = Math.max(0, Math.floor((end - Date.now())/1000));
      el.textContent = fmt(remain);
      if (remain <= 0) { stop(el); el.classList.add('finished'); if (el.dataset.done) el.textContent = el.dataset.done; }
    };
    el.dataset.timerId = String(setInterval(tick, 500));
    tick();
  }

  function stop(el) { if (el.dataset.timerId) clearInterval(+el.dataset.timerId); delete el.dataset.timerId; delete el.dataset.timerRunning; }
  function reset(el) { stop(el); el.classList.remove('started','finished'); if (el.dataset.original) el.textContent = el.dataset.original; }

  function initIn(root) {
    root.querySelectorAll(SEL).forEach(function(el) {
      var secs = el.dataset.seconds ? parseInt(el.dataset.seconds,10) : null;
      if (!Number.isFinite(secs) && el.dataset.until) {
        var until = new Date(el.dataset.until); if (!isNaN(+until)) secs = Math.max(0, Math.round((until - Date.now())/1000));
      }
      if (!Number.isFinite(secs)) secs = parseSecs(el.textContent);
      if (Number.isFinite(secs)) start(el, secs);
    });
  }
  function resetIn(root) { root.querySelectorAll(SEL).forEach(reset); }

  var visibleSlideRoots = function() {
    return Array.from(document.querySelectorAll('.remark-slide-container.remark-visible .remark-slide-content'));
  };

  slideshow.on('afterShowSlide', function() { visibleSlideRoots().forEach(initIn); });
  slideshow.on('beforeHideSlide', function() { visibleSlideRoots().forEach(resetIn); });

  // kick the initially rendered slide
  visibleSlideRoots().forEach(initIn);
})();
