// remark-engine: theme-aware SVG coloring
// Injects CSS rules into <object type="image/svg+xml"> documents so that
// SVG elements with accent-* classes follow the presentation's theme.
(function () {
  'use strict';

  // Read theme custom properties from the host page
  var rootStyle = getComputedStyle(document.documentElement);
  var accent = rootStyle.getPropertyValue('--accent').trim();
  var accentDim = rootStyle.getPropertyValue('--accent-dim').trim();
  var accentDark = rootStyle.getPropertyValue('--accent-dark').trim();

  // If no accent colour is defined, nothing to do
  if (!accent) {
    return;
  }

  // Build the CSS block that will be injected into each SVG document
  var css =
    '.accent-stroke { stroke: ' + accent + ' !important; }\n' +
    '.accent-fill { fill: ' + accent + ' !important; }\n' +
    '.accent-dim-stroke { stroke: ' + accentDim + ' !important; }\n' +
    '.accent-dim-fill { fill: ' + accentDim + ' !important; }\n' +
    '.accent-dark-stroke { stroke: ' + accentDark + ' !important; }\n' +
    '.accent-dark-fill { fill: ' + accentDark + ' !important; }\n';

  var STYLE_ID = 'remark-theme';

  function injectStyle(svgDoc) {
    if (!svgDoc || !svgDoc.documentElement) {
      return;
    }
    // Avoid double-injection
    if (svgDoc.getElementById(STYLE_ID)) {
      return;
    }
    var styleEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.setAttribute('id', STYLE_ID);
    styleEl.setAttribute('type', 'text/css');
    styleEl.textContent = css;
    // Prepend into <defs> if available, otherwise into the root <svg>
    var defs = svgDoc.querySelector('defs');
    if (defs) {
      defs.insertBefore(styleEl, defs.firstChild);
    } else {
      svgDoc.documentElement.insertBefore(styleEl, svgDoc.documentElement.firstChild);
    }
  }

  function processObject(obj) {
    if (!obj || obj.getAttribute('type') !== 'image/svg+xml') {
      return;
    }
    // Always listen for load — covers initial load and potential re-navigation
    obj.addEventListener('load', function () {
      try {
        injectStyle(obj.contentDocument);
      } catch (e) {
        // cross-origin — ignore
      }
    });
    // Also try immediate injection if SVG is already fully loaded
    try {
      var doc = obj.contentDocument;
      if (doc && doc.documentElement &&
          doc.documentElement.tagName.toLowerCase() === 'svg') {
        injectStyle(doc);
      }
    } catch (e) {
      // cross-origin — ignore
    }
  }

  // Process all existing <object> elements
  var objects = document.querySelectorAll('object[type="image/svg+xml"]');
  for (var i = 0; i < objects.length; i++) {
    processObject(objects[i]);
  }

  // Watch for dynamically added <object> elements
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var added = mutations[m].addedNodes;
        for (var n = 0; n < added.length; n++) {
          var node = added[n];
          if (node.nodeType !== 1) {
            continue;
          }
          if (node.tagName === 'OBJECT') {
            processObject(node);
          }
          // Also check children (e.g. a slide container was added)
          var nested = node.querySelectorAll
            ? node.querySelectorAll('object[type="image/svg+xml"]')
            : [];
          for (var k = 0; k < nested.length; k++) {
            processObject(nested[k]);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
