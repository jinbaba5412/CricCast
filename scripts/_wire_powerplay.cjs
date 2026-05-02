/**
 * L4-Step-4 — Powerplay engine (Controller side).
 *
 *  • auto mode   — compute from over number + format:
 *      T20 (maxOvers ≤ 20)         → PP1 covers 1..6
 *      ODI (21..50)                → PP1:1-10  PP2:11-40  PP3:41-50
 *      Test (> 50)                 → no PP
 *  • manual mode — admin toggles PP1 on/off via a Controller button.
 *  • An in-match manual override flag (window.match._ppManual) forces
 *    auto-compute to yield its value.
 *  • Indicator painted into #pp-indicator (Controller) and into
 *    #cc-pp-badge on the scoreboard DOM (scoreboard-core will pick it
 *    up on next render tick).
 *
 *  Consumers: scoreboard-core-offline.js and the live-render pipeline
 *  read window.match.powerplayActive (boolean) +
 *  window.match.powerplayLabel (string like "PP1" | "PP2" | "").
 *
 *  Idempotent (sentinel guard).
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');

let s = fs.readFileSync(FILE, 'utf8');
if (s.includes('/* L4 powerplay bootstrap */')) {
  console.log('powerplay already wired, skipping');
  process.exit(0);
}

const ANCHOR = `/* L4 free-hit bootstrap */`;
const i = s.indexOf(ANCHOR);
if (i < 0) {
  console.error('free-hit anchor not found — run _wire_free_hit first');
  process.exit(1);
}

const snippet = `/* L4 powerplay bootstrap */
(function initPowerplay() {
  'use strict';

  function cfg() {
    return (window.match && window.match.settings) || window.CRICCAST_MATCH_SETTINGS || {};
  }
  function formatOf(maxOvers) {
    if (!maxOvers || maxOvers < 1) return 'unknown';
    if (maxOvers <= 20) return 't20';
    if (maxOvers <= 50) return 'odi';
    return 'test';
  }

  /**
   * computePPAuto(m) → { active, label }
   *   m: window.match snapshot.
   */
  function computePPAuto(m) {
    if (!m || !m.maxOvers) return { active: false, label: '' };
    const fmt  = formatOf(m.maxOvers);
    const over = Math.floor((m.balls || 0) / 6) + 1; // 1-based current over
    if (fmt === 't20') {
      if (over <= 6) return { active: true, label: 'PP1' };
      return { active: false, label: '' };
    }
    if (fmt === 'odi') {
      if (over <= 10)                 return { active: true, label: 'PP1' };
      if (over <= 40)                 return { active: true, label: 'PP2' };
      return                          { active: true, label: 'PP3' };
    }
    return { active: false, label: '' };
  }

  /** Recompute active state + paint the indicator. Called on every render. */
  function refresh() {
    const m = window.match;
    if (!m) return;
    const c = cfg();
    let active = false, label = '';
    if (c.powerplay_enabled) {
      if (c.powerplay_mode === 'manual') {
        active = !!m._ppManual;
        label  = active ? 'PP' : '';
      } else {
        const a = computePPAuto(m);
        active = a.active;
        label  = a.label;
      }
    }
    m.powerplayActive = active;
    m.powerplayLabel  = label;

    // Paint Controller indicator.
    let ind = document.getElementById('pp-indicator');
    if (!ind) {
      // Try to anchor next to the over-track row.
      const host = document.getElementById('over-meta-row');
      if (host) {
        ind = document.createElement('span');
        ind.id = 'pp-indicator';
        ind.style.cssText = 'padding:2px 8px;border-radius:4px;font-size:12px;'
          + 'font-weight:900;letter-spacing:1.5px;text-transform:uppercase;';
        host.appendChild(ind);
      }
    }
    if (ind) {
      if (active) {
        ind.textContent = label;
        ind.style.display = 'inline-block';
        ind.style.background = '#fef08a';
        ind.style.color = '#78350f';
      } else {
        ind.style.display = 'none';
      }
    }

    // Expose a toggle button on the live screen (manual mode only).
    let btn = document.getElementById('pp-toggle-btn');
    if (c.powerplay_enabled && c.powerplay_mode === 'manual') {
      if (!btn) {
        const toolbar = document.querySelector('.ctrl-top') || document.body;
        btn = document.createElement('button');
        btn.id = 'pp-toggle-btn';
        btn.type = 'button';
        btn.style.cssText = 'margin-left:auto;padding:6px 12px;border-radius:6px;'
          + 'border:1px solid var(--gold,#fbbf24);background:transparent;'
          + "color:var(--gold,#fbbf24);font-family:'Bebas Neue',sans-serif;"
          + 'font-size:14px;letter-spacing:2px;cursor:pointer;';
        btn.addEventListener('click', () => {
          window.match._ppManual = !window.match._ppManual;
          refresh();
          if (typeof window.renderLive === 'function') window.renderLive();
        });
        toolbar.appendChild(btn);
      }
      btn.textContent = active ? 'PP ON' : 'PP OFF';
      btn.style.background = active ? 'rgba(245,158,11,0.15)' : 'transparent';
    } else if (btn) {
      btn.remove();
    }
  }

  window.refreshPowerplay = refresh;

  // Hook renderLive so the indicator repaints after every ball.
  const _origRender = window.renderLive;
  if (typeof _origRender === 'function') {
    window.renderLive = function () {
      const r = _origRender.apply(this, arguments);
      refresh();
      return r;
    };
  }
  if (document.readyState !== 'loading') refresh();
  else document.addEventListener('DOMContentLoaded', refresh);
})();

`;

s = s.slice(0, i) + snippet + s.slice(i);
fs.writeFileSync(FILE, s, 'utf8');
console.log('powerplay module inserted (', snippet.length, 'bytes )');
