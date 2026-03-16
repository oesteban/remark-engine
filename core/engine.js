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

  window.slideshow = remark.create(config);
})();
