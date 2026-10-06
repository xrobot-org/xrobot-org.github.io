/**
 * Anti-FOUC head script (plain ES5, no dependencies, runs synchronously in
 * <head> via docusaurus.config.js `scripts: [{src: '/appearance-init.js',
 * async: false}]`). Applies the stored appearance preferences to <html> before
 * first paint, so the CSS layer (which keys off the data attributes) never
 * flashes the defaults.
 *
 * Keep in sync with src/utils/appearance.ts (same keys and defaults).
 */
(function () {
  'use strict';

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  var root = document.documentElement;

  // Accent: mono (default) or hue. The key only exists while hue mode is on.
  var hue = read('xr-accent-hue');
  if (hue !== null) {
    var parsed = parseInt(hue, 10);
    if (isNaN(parsed)) {
      parsed = 0;
    }
    if (parsed < 0) {
      parsed = 0;
    }
    if (parsed > 360) {
      parsed = 360;
    }
    root.setAttribute('data-accent', 'hue');
    root.style.setProperty('--xr-hue', String(parsed));
  } else {
    root.setAttribute('data-accent', 'mono');
  }

  // Font mode: 'default' (default) or 'wenkai'.
  var fontMode = read('xr-font-mode');
  root.setAttribute('data-font-mode', fontMode === 'wenkai' ? 'wenkai' : 'default');
  // Load the LXGW WenKai font stylesheet before first paint when needed.
  if (fontMode === 'wenkai' && !document.querySelector('link[data-xr-font="wenkai"]')) {
    document.write(
      '<link rel="stylesheet" href="/fonts/lxgw/lxgwwenkaiscreen.css" data-xr-font="wenkai">'
    );
  }

  // Card decor: 'ink' (default) or 'soft'.
  var cardDecor = read('xr-card-decor');
  root.setAttribute('data-card-decor', cardDecor === 'soft' ? 'soft' : 'ink');

  // Navbar mode: 'always' (default) or 'autohide'.
  var navbarMode = read('xr-navbar-mode');
  root.setAttribute('data-navbar-mode', navbarMode === 'autohide' ? 'autohide' : 'always');

  // Background texture: 'plain' (default), 'grid' or 'dots'.
  var bgMode = read('xr-bg-mode');
  root.setAttribute(
    'data-bg-mode',
    bgMode === 'grid' || bgMode === 'dots' ? bgMode : 'plain'
  );

  // Motion: 'on' (default) or 'off'.
  var motion = read('xr-motion');
  root.setAttribute('data-motion', motion === 'off' ? 'off' : 'on');
})();
