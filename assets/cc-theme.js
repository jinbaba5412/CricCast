/* ════════════════════════════════════════════════════════════════════
   CricCast — theme toggle (dark | light | system)
   Persists to localStorage['cc-theme']. Sets data-theme on <html>.
   Init runs ASAP via inline IIFE; UI helpers exposed on window.CCTheme.
   Anti-FOUC: this file is intended to be loaded as the FIRST script
   in <head> so the data-theme attribute is set before paint.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'cc-theme';
  var VALID = { dark: 1, light: 1, system: 1 };

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return VALID[v] ? v : 'dark';   // default = dark
    } catch (e) { return 'dark'; }
  }

  function resolve(mode) {
    if (mode === 'system') {
      try {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      } catch (e) { return 'dark'; }
    }
    return mode;
  }

  function apply(mode) {
    var root = document.documentElement;
    root.setAttribute('data-theme', resolve(mode));
    root.setAttribute('data-theme-pref', mode);
  }

  // Initial paint — synchronous before <body> renders.
  apply(read());

  // Watch system pref when in system mode.
  try {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var handler = function () {
      if (read() === 'system') apply('system');
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  } catch (e) { /* noop */ }

  // Public API
  window.CCTheme = {
    get: read,
    set: function (mode) {
      if (!VALID[mode]) mode = 'dark';
      try { localStorage.setItem(KEY, mode); } catch (e) {}
      apply(mode);
      // Reflect aria-pressed on any toggle UI.
      var btns = document.querySelectorAll('[data-cc-theme-btn]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-cc-theme-btn') === mode ? 'true' : 'false');
      }
      // Allow listeners to react.
      try { window.dispatchEvent(new CustomEvent('cc-theme-change', { detail: { mode: mode, resolved: resolve(mode) } })); } catch (e) {}
    },
    cycle: function () {
      var order = ['dark', 'light', 'system'];
      var cur = read();
      var idx = order.indexOf(cur);
      this.set(order[(idx + 1) % order.length]);
    },
    /**
     * Mount a theme-toggle pill into the given parent element.
     * Renders three buttons: dark / light / system.
     */
    mount: function (parent) {
      if (!parent) return;
      var pill = document.createElement('div');
      pill.className = 'cc-theme-toggle';
      pill.setAttribute('role', 'group');
      pill.setAttribute('aria-label', 'Theme');

      var defs = [
        { mode: 'light',  title: 'Light',  svg: '<path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" fill="none"/>' },
        { mode: 'dark',   title: 'Dark',   svg: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>' },
        { mode: 'system', title: 'System', svg: '<rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 20h8M12 17v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
      ];
      var cur = read();
      defs.forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button';
        b.title = d.title;
        b.setAttribute('aria-label', d.title + ' theme');
        b.setAttribute('data-cc-theme-btn', d.mode);
        b.setAttribute('aria-pressed', cur === d.mode ? 'true' : 'false');
        b.innerHTML = '<svg viewBox="0 0 24 24">' + d.svg + '</svg>';
        b.addEventListener('click', function () { window.CCTheme.set(d.mode); });
        pill.appendChild(b);
      });
      parent.appendChild(pill);
      return pill;
    }
  };

  // Auto-mount: if a [data-cc-theme-mount] target exists at DOMContentLoaded,
  // render the toggle into it without consumer code needing to call mount().
  function autoMount() {
    var t = document.querySelector('[data-cc-theme-mount]');
    if (t) window.CCTheme.mount(t);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})();
