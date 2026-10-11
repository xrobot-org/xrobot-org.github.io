/**
 * Applies the stored page animation switch to <html data-motion> before first paint
 * (plain ES5, loaded synchronously in <head> by docusaurus.config.js), so CSS keyed on
 * html[data-motion='off'] never flashes the animated state. Same key and default as
 * src/utils/motion.ts.
 */
(function () {
  'use strict';
  var off = false;
  try {
    off = window.localStorage.getItem('xr-motion') === 'off';
  } catch (e) {
    /* storage unavailable: animation stays on */
  }
  document.documentElement.setAttribute('data-motion', off ? 'off' : 'on');
})();
