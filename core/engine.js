// remark-engine: shared macros + remark.create() wrapper
(function () {
  'use strict';

  // Custom macros
  // Use: ![:img Alt text with spaces but not commas, 50%](image.png)
  remark.macros.img = function (altText, width) {
    var url = this;
    return '<img alt="' + altText + '" src="' + url + '" style="width: ' + width + '" />';
  };
  // Use: ![:video](video.mp4)
  remark.macros.video = function (width) {
    var url = this;
    return '<video src="' + url + '" width="' + width + '" preload="auto" controls />';
  };
  // Use: ![:doi](10.5129/10234)
  remark.macros.doi = function () {
    var doi = this;
    return '<a href="https://doi.org/' + doi + '">' + doi + '</a>';
  };

  // MathJax auto-configuration (if MathJax is loaded)
  if (window.MathJax && MathJax.Hub) {
    MathJax.Hub.Config({
      tex2jax: {
        inlineMath: [['$','$'], ['\\(','\\)']],
        processEscapes: true
      }
    });
  }

  // Merge any user-provided config with defaults
  var defaults = {
    highlightStyle: 'monokai',
    highlightLanguage: 'remark',
    highlightLines: true,
    countIncrementalSlides: false,
    highlightSpans: true,
    ratio: '16:9'
  };

  var userConfig = window.remarkEngineConfig || {};
  var config = {};
  var key;
  for (key in defaults) {
    if (Object.prototype.hasOwnProperty.call(defaults, key)) {
      config[key] = defaults[key];
    }
  }
  for (key in userConfig) {
    if (Object.prototype.hasOwnProperty.call(userConfig, key)) {
      config[key] = userConfig[key];
    }
  }

  var slideshow = window.slideshow = remark.create(config);

  // ---- Printing -------------------------------------------------------------
  // core/base.css lays both prints out: the slides alone from the audience
  // view, a handout of slides and notes from presenter mode. This section keeps
  // the screen out of the print and gets the slides ready for it.

  // remark rescales every slide when the print media query matches, to suit its
  // own print stylesheet, and never scales them back. The screen behind the
  // print dialog, and after it, is left rearranged: in presenter mode the slide
  // shrinks into a portrait box over the notes. base.css does not need that
  // rescaling, so drop the listener. `require` is the loader remark's bundle
  // leaves global.
  try {
    if (typeof require === 'function') {
      require('components/printing').removeAllListeners('print');
    }
  } catch (e) {
    // Another script owns `require`: the resize below restores the screen.
  }

  // Whatever else a print disturbs, a resize has remark lay the screen out again,
  // once the screen layout is back. Not at `afterprint`: Firefox fires it while
  // the print layout is still in force, and remark would rescale every slide to
  // the printed page.
  if (window.matchMedia) {
    window.matchMedia('print').addEventListener('change', function (event) {
      if (!event.matches) {
        window.dispatchEvent(new Event('resize'));
      }
    });
  }

  // The page follows the mode: one slide per page at the slide's own size, or
  // the handout on paper the reader picks, with margins. A named page in CSS
  // (`page: handout`) cannot say this, because Firefox gives the first page the
  // root's page instead: no margins, every page laid out at that page's width,
  // and a blank page at the end. base.css reads the slide's size from the two
  // custom properties.
  var containerElement = document.querySelector('.remark-slides-area').parentNode;
  var pageRule = document.createElement('style');
  document.head.appendChild(pageRule);

  function syncPrintPage() {
    var scaler = containerElement.querySelector('.remark-slide-scaler');
    var width = (scaler && scaler.style.width) || '1210px';
    var height = (scaler && scaler.style.height) || '681px';
    document.documentElement.style.setProperty('--remark-slide-width', width);
    document.documentElement.style.setProperty('--remark-slide-height', height);
    pageRule.textContent = containerElement.classList.contains('remark-presenter-mode')
      ? '@page { size: auto; margin: 12mm; }'
      : '@page { size: ' + width + ' ' + height + '; margin: 0; }';
  }

  syncPrintPage();
  new MutationObserver(syncPrintPage).observe(containerElement,
    { attributes: true, attributeFilter: ['class'] });

  // An <object> SVG sized by its width alone takes its height from the drawing,
  // once the drawing has loaded. Firefox prints from a copy of the page that has
  // lost it, and the object falls back to the default 150px height: the drawing
  // prints small, letterboxed. Written on the element, the proportions survive
  // the copy, and on screen they change nothing, being the drawing's own.
  var SVG_OBJECT = 'object[type="image/svg+xml"]';
  var LOADED = 'data-remark-loaded';
  var PERCENT = 2;   // SVGLength.SVG_LENGTHTYPE_PERCENTAGE

  function pinProportions(obj) {
    var svg;
    try {
      svg = obj.contentDocument && obj.contentDocument.documentElement;
    } catch (e) {
      return;   // cross-origin
    }
    if (!svg || svg.tagName.toLowerCase() !== 'svg' ||
        obj.style.height || obj.hasAttribute('height')) {
      return;
    }
    var box = svg.viewBox && svg.viewBox.baseVal;
    var w = box ? box.width : 0;
    var h = box ? box.height : 0;
    if (!(w > 0 && h > 0) &&
        svg.width.baseVal.unitType !== PERCENT && svg.height.baseVal.unitType !== PERCENT) {
      w = svg.width.baseVal.value;
      h = svg.height.baseVal.value;
    }
    if (w > 0 && h > 0) {
      obj.style.aspectRatio = w + ' / ' + h;
    }
  }

  // `load` does not bubble, but it does pass the document on its way down.
  document.addEventListener('load', function (event) {
    var obj = event.target;
    if (obj.matches && obj.matches(SVG_OBJECT)) {
      obj.setAttribute(LOADED, '1');
      pinProportions(obj);
    }
  }, true);

  // Chrome does not load an <object> inside a display:none subtree, and every
  // slide but the current one is display:none, so a slide not yet shown prints
  // its SVGs blank. preloadObjects() renders each such slide off-screen until
  // its objects have loaded, then puts it back: an object that has loaded stays
  // loaded when hidden again. ext/svg-preload.js runs it at startup, the print
  // buttons before every print. Ctrl+P cannot wait for it.
  var PRELOAD_TIMEOUT = 8000;   // never leave a slide forced open, whatever happens
  var preloading = new Map();   // container -> promise, while it is forced open

  function preloadContainer(container, objects) {
    return new Promise(function (resolve) {
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
        preloading.delete(container);
        resolve();
      }

      function settled() {
        pending -= 1;
        if (pending <= 0) { restore(); }
      }

      objects.forEach(function (obj) {
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

      setTimeout(restore, PRELOAD_TIMEOUT);
    });
  }

  function preloadObjects() {
    var groups = new Map();   // container -> its objects still to load
    var waits = [];
    var objects = document.querySelectorAll('.remark-slides-area ' + SVG_OBJECT);

    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i];
      var container = obj.closest('.remark-slide-container');
      if (obj.hasAttribute(LOADED) || !container) { continue; }
      if (preloading.has(container)) {
        if (waits.indexOf(preloading.get(container)) === -1) {
          waits.push(preloading.get(container));
        }
        continue;
      }
      // No hidden ancestor to fight: it loads on its own.
      if (window.getComputedStyle(container).display !== 'none') { continue; }
      if (!groups.has(container)) { groups.set(container, []); }
      groups.get(container).push(obj);
    }

    groups.forEach(function (group, container) {
      var promise = preloadContainer(container, group);
      preloading.set(container, promise);
      waits.push(promise);
    });
    return Promise.all(waits);
  }

  function print() {
    return preloadObjects().then(function () { window.print(); });
  }

  // The handout prints a slide that is built up over several slides once, in
  // its last build. A build is the next slide continuing this one, by `--`, or
  // repeating it under the same title, marked `count: false`; the uncounted
  // cover does neither. remark already carries notes across `--`. Notes written
  // on an earlier copy are carried here, and print above the last build's own.
  function heading(container) {
    var h1 = container && container.querySelector('.remark-slide-content h1');
    return h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function isBuildOf(next, nextContainer, container) {
    if (!next) { return false; }
    if (next.properties.continued === 'true') { return true; }
    return next.properties.count === 'false' && heading(nextContainer) !== '' &&
      heading(nextContainer) === heading(container);
  }

  function markBuilds() {
    var slides = slideshow.getSlides();
    var containers = document.querySelectorAll('.remark-slides-area > .remark-slide-container');
    if (slides.length !== containers.length) { return; }

    var carried = [];   // notes of earlier builds, as [markdown, html]
    for (var i = 0; i < slides.length; i++) {
      var container = containers[i];
      var notesElement = container.querySelector('.remark-slide-notes');
      var notes = String(slides[i].notes || '').trim();
      // What this slide's own notes repeat needs no carrying.
      carried = carried.filter(function (pair) { return notes.indexOf(pair[0]) === -1; });

      if (isBuildOf(slides[i + 1], containers[i + 1], container)) {
        container.classList.add('remark-print-superseded');
        if (notes && notesElement) { carried.push([notes, notesElement.innerHTML]); }
        continue;
      }
      if (carried.length && notesElement) {
        // A sibling, not an edit: the presenter view copies remark's notes element.
        var extra = document.createElement('div');
        extra.className = 'remark-print-carried-notes';
        extra.innerHTML = carried.map(function (pair) { return pair[1]; }).join('');
        container.insertBefore(extra, notesElement);
      }
      carried = [];
    }
  }

  markBuilds();

  window.remarkEngine = {
    print: print,
    preloadObjects: preloadObjects
  };
})();
