/**
 * L4-Step-3 — Free Hit logic (Law 21.18 — limited-overs only).
 *
 *  • addNb(runsOffBat) → sets window.match._freeHitPending = true
 *    (only if settings.free_hit_enabled AND maxOvers ≤ 50 — Test Match
 *     explicitly has no free hit)
 *  • addBall / addBye  → clears the flag after one legal delivery AND
 *    marks that ball as is_free_hit=true on the event payload
 *  • On a Free Hit ball the only legal dismissals are Run Out, Stumped,
 *    Hit Wicket. selectDismissalType() greys out the rest in the modal.
 *  • A #free-hit-banner element is toggled on the live screen.
 *
 * All hooks are additive — the existing addNb/addBall/addBye bodies stay
 * intact; we monkey-patch at the tail. Idempotent (checks a sentinel).
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');

let s = fs.readFileSync(FILE, 'utf8');
if (s.includes('/* L4 free-hit bootstrap */')) {
  console.log('free-hit already wired, skipping');
  process.exit(0);
}

// Insert the module right after the <style> block that opens the dismissal
// modal styles — stable anchor, guaranteed to be in the head scripts area.
// Simpler: append a self-contained IIFE before the closing </script> of
// the main Controller script. We anchor on the sentinel line that closes
// our Session 3 boot, just above the scheduled-bar IIFE.
const ANCHOR = `/* ════════════════════════════════════════════════════════════════════
   CricCast — Scheduled Matches bar (L2)`;
const i = s.indexOf(ANCHOR);
if (i < 0) {
  console.error('scheduled-bar anchor not found');
  process.exit(1);
}

const snippet = `/* L4 free-hit bootstrap */
(function initFreeHit() {
  'use strict';
  // ─── Helpers ────────────────────────────────────────────────────────
  function freeHitEnabled() {
    const cfg = (window.match && window.match.settings) || window.CRICCAST_MATCH_SETTINGS || {};
    if (!cfg.free_hit_enabled) return false;
    // Law 21.18 — limited-overs only. Test Match (maxOvers >= 90) opts out.
    const max = (window.match && window.match.maxOvers) || 0;
    return max > 0 && max <= 50;
  }
  function setFreeHitBanner(active) {
    let el = document.getElementById('free-hit-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'free-hit-banner';
      el.style.cssText =
        'display:none;position:sticky;top:0;z-index:200;padding:6px 12px;'
        + 'background:linear-gradient(90deg,#facc15,#f59e0b);color:#1a1a1a;'
        + "font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:3px;"
        + 'text-align:center;font-weight:900;border-bottom:2px solid #92400e;';
      el.textContent = '⚡ FREE HIT ⚡';
      const host = document.querySelector('.controller-area') || document.body;
      host.insertBefore(el, host.firstChild);
    }
    el.style.display = active ? 'block' : 'none';
  }

  function updateFreeHitUI() {
    const active = !!(window.match && window.match._freeHitPending);
    setFreeHitBanner(active);
  }
  window.updateFreeHitUI = updateFreeHitUI;

  // ─── Hook addNb: set the flag after a no-ball is recorded ──────────
  const _addNbOrig = window.addNb;
  if (typeof _addNbOrig === 'function') {
    window.addNb = function (runsOffBat) {
      const r = _addNbOrig.apply(this, arguments);
      if (freeHitEnabled() && window.match && !window.match.isFinished) {
        window.match._freeHitPending = true;
        updateFreeHitUI();
      }
      return r;
    };
  }

  // ─── Hook addBall / addBye: after a legal ball, mark + clear flag ──
  function markAndClear(eventType) {
    // eventType unused — placeholder for future analytics hooks.
    if (!window.match) return;
    if (window.match._freeHitPending) {
      // Tag the just-pushed ball event as free-hit for stats aggregation.
      const all = window.match.allBalls || [];
      if (all.length) all[all.length - 1].is_free_hit = true;
      window.match._freeHitPending = false;
      updateFreeHitUI();
    }
  }
  const _addBallOrig = window.addBall;
  if (typeof _addBallOrig === 'function') {
    window.addBall = function (runs, type) {
      const r = _addBallOrig.apply(this, arguments);
      markAndClear('run');
      return r;
    };
  }
  const _addByeOrig = window.addBye;
  if (typeof _addByeOrig === 'function') {
    window.addBye = function (runs, isLeg) {
      const r = _addByeOrig.apply(this, arguments);
      markAndClear(isLeg ? 'legbye' : 'bye');
      return r;
    };
  }

  // ─── Restrict dismissal options on a Free Hit ──────────────────────
  // A free-hit ball can only produce run_out / stumped / hit_wicket.
  // We intercept selectDismissalType() and block the illegal types with
  // a toast.
  const _selectDismissalOrig = window.selectDismissalType;
  if (typeof _selectDismissalOrig === 'function') {
    window.selectDismissalType = function (type) {
      if (window.match && window.match._freeHitPending) {
        const allowed = new Set(['run_out', 'stumped', 'hit_wicket']);
        if (!allowed.has(type)) {
          if (window.CC && window.CC.ui && window.CC.ui.toast) {
            window.CC.ui.toast(
              'Free Hit — only Run Out, Stumped, or Hit Wicket are valid dismissals.',
              'warn'
            );
          }
          return;
        }
      }
      return _selectDismissalOrig.apply(this, arguments);
    };
  }

  // ─── Wicket event path also needs tagging ──────────────────────────
  // Patch the push of allBalls inside _applyWicket by tagging the last
  // event post-hoc (simplest without touching _applyWicket's body).
  const _applyWicketOrig = window._applyWicket;
  if (typeof _applyWicketOrig === 'function') {
    window._applyWicket = function (dismissType, fielder, isWK, meta) {
      const wasFH = !!(window.match && window.match._freeHitPending);
      const r = _applyWicketOrig.apply(this, arguments);
      if (wasFH) {
        const all = window.match.allBalls || [];
        if (all.length) all[all.length - 1].is_free_hit = true;
        // Free-hit wicket was recorded — clear the flag.
        window.match._freeHitPending = false;
        updateFreeHitUI();
      }
      return r;
    };
  }

  // Paint banner on boot in case state restored from localStorage/server.
  if (document.readyState !== 'loading') updateFreeHitUI();
  else document.addEventListener('DOMContentLoaded', updateFreeHitUI);
})();

`;

s = s.slice(0, i) + snippet + s.slice(i);
fs.writeFileSync(FILE, s, 'utf8');
console.log('free-hit module inserted (', snippet.length, 'bytes )');
