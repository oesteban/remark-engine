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

  // Grid diagram color channels, keyed by accent colour.
  // Channel A = green in CHUV source SVGs, Channel B = blue.
  // Themes that need the swap (e.g. nipreps) reverse A↔B.
  var GRID_DEFAULT = { a: '#6ed567', aL: '#afde85', b: '#55a9e2', bL: '#9ac7df' };
  var GRID_SWAPPED = { a: '#55a9e2', aL: '#9ac7df', b: '#6ed567', bL: '#afde85' };
  var gridMap = {
    '#009933': GRID_DEFAULT,  // CHUV (matches source SVG)
    '#dc0069': { a: '#dc0069', aL: '#de84af', b: '#55a9e2', bL: '#9ac7df' }  // hes-so
  };
  var grid = gridMap[accent] || GRID_SWAPPED;

  // Class → [CSS property, value] mapping
  var rules = [
    ['accent-stroke', 'stroke', accent],
    ['accent-fill', 'fill', accent],
    ['accent-dim-stroke', 'stroke', accentDim],
    ['accent-dim-fill', 'fill', accentDim],
    ['accent-dark-stroke', 'stroke', accentDark],
    ['accent-dark-fill', 'fill', accentDark],
    ['accent-a-fill', 'fill', grid.a],
    ['accent-a-light-fill', 'fill', grid.aL],
    ['accent-b-fill', 'fill', grid.b],
    ['accent-b-light-fill', 'fill', grid.bL]
  ];

  var MARKER = 'data-remark-themed';

  function applyTheme(svgDoc) {
    if (!svgDoc || !svgDoc.documentElement) {
      return;
    }
    // Avoid double-application
    if (svgDoc.documentElement.hasAttribute(MARKER)) {
      return;
    }
    svgDoc.documentElement.setAttribute(MARKER, '1');
    for (var i = 0; i < rules.length; i++) {
      var cls = rules[i][0], prop = rules[i][1], val = rules[i][2];
      if (!val) { continue; }
      var els = svgDoc.querySelectorAll('.' + cls);
      for (var j = 0; j < els.length; j++) {
        els[j].style.setProperty(prop, val, 'important');
      }
    }
  }

  function processObject(obj) {
    if (!obj || obj.getAttribute('type') !== 'image/svg+xml') {
      return;
    }
    // Always listen for load — covers initial load and potential re-navigation
    obj.addEventListener('load', function () {
      try {
        applyTheme(obj.contentDocument);
      } catch (e) {
        // cross-origin — ignore
      }
    });
    // Also try immediate injection if SVG is already fully loaded
    try {
      var doc = obj.contentDocument;
      if (doc && doc.documentElement &&
          doc.documentElement.tagName.toLowerCase() === 'svg') {
        applyTheme(doc);
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
