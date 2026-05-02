/**
 * L4-Step-6 — Super Over engine.
 *
 * Rules (ICC Law 16.5 / T20 playing conditions):
 *   • Each team selects 3 batters + 1 bowler.
 *   • Innings ends at 2 wickets OR 1 over (6 legal balls) — whichever first.
 *   • Team that batted 2nd in the main match bats 1st in the Super Over.
 *   • If tied again → repeat Super Over (recursion).
 *
 * This script REPLACES the existing stub startSuperOver() with a proper
 * engine + injects an Over-end/Innings-end checkpoint that knows about
 * Super Over mode. All super-over balls get is_super_over=true for stats.
 *
 * State flags added to window.match:
 *   _superOver       : bool — currently inside a Super Over
 *   _superOverIdx    : 1..N — which SO iteration we're on (for recursion)
 *   _superOverInning : 1 | 2 — first innings or chase
 *   _superOverInn1   : { runs, wickets, balls, batTeamId, bowler }
 *                      recorded when we swap to the 2nd SO innings
 *
 * Idempotent.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');

let s = fs.readFileSync(FILE, 'utf8');
if (s.includes('/* L4 super-over engine */')) {
  console.log('super-over engine already wired, skipping');
  process.exit(0);
}

// We need two changes:
//  A) replace the body of startSuperOver() with the new engine
//  B) append an IIFE that hooks addBall/addWide/addNb/addBye/endOver/wicket
//     to enforce Super Over termination rules.

/* ── A) Replace startSuperOver() body ───────────────────────────── */
// Match the bare stub using a regex that's tolerant to whitespace drift.
const soRe = /function\s+startSuperOver\s*\(\s*\)\s*\{[\s\S]*?\n\}/;
const m = soRe.exec(s);
if (!m) {
  console.error('startSuperOver() function not found');
  process.exit(1);
}
const newSO = `function startSuperOver() {
  // L4 engine — set super-over mode and 1-over / 2-wicket termination.
  // Team that batted 2nd in the main match bats 1st in the SO: we swap
  // bat/bowl only if we're entering the FIRST SO iteration (i.e. coming
  // from a tied main match, not from a tied previous SO).
  if (!window.match._superOver) {
    const prevBat  = window.match.batTeamId;
    const prevBowl = window.match.bowlTeamId;
    // After the tied main-match INN2, window.match.batTeamId currently
    // points at the team that was chasing (= batted 2nd). So we keep it.
    // (No swap needed; the 2nd-innings bat team stays as SO bat team.)
    window.match._superOverIdx    = 1;
  } else {
    // Consecutive SO (previous SO tied). Re-alternate bat/bowl.
    const tmp = window.match.batTeamId;
    window.match.batTeamId  = window.match.bowlTeamId;
    window.match.bowlTeamId = tmp;
    window.match._superOverIdx = (window.match._superOverIdx || 1) + 1;
  }
  window.match._superOver       = true;
  window.match._superOverInning = 1;
  window.match._superOverInn1   = null;

  // Fresh innings state but keep team theme colours + teams list.
  window.match.isFinished     = false;
  window.match.winner         = '';
  window.match.winDesc        = '';
  window.match.inning         = 1;        // logical "inning" within SO
  window.match.target         = 0;
  window.match.maxOvers       = 1;
  window.match.runs           = 0;
  window.match.wickets        = 0;
  window.match.balls          = 0;
  window.match.p1             = {};
  window.match.p2             = {};
  window.match.bowler         = '';
  window.match.thisOverBalls  = [];
  window.match.allBalls       = [];
  window.match.usedPlayers    = [];
  window.match.batsmanStats   = {};
  window.match.bowlerStats    = {};
  if (window.CC && CC.guard) CC.guard.resetRotation();

  // Hide the Super Over prompt — match is now live again.
  const soSec = document.getElementById('super-over-section');
  if (soSec) soSec.style.display = 'none';
  renderLive();

  if (window.CC && window.CC.ui && window.CC.ui.toast) {
    window.CC.ui.toast('Super Over started — pick striker, non-striker, then bowler.', 'info');
  }
  openBatsmanModal('p1', 'p2', 'Super Over: Select Striker');
}`;
s = s.slice(0, m.index) + newSO + s.slice(m.index + m[0].length);

/* ── B) Append the SO enforcement IIFE ──────────────────────────── */
const ANCHOR = `/* L4 powerplay bootstrap */`;
const i = s.indexOf(ANCHOR);
if (i < 0) {
  console.error('powerplay anchor not found — run _wire_powerplay first');
  process.exit(1);
}

const snippet = `/* L4 super-over engine */
(function initSuperOverEngine() {
  'use strict';

  // ─── Squad limits ────────────────────────────────────────────────
  // Max 3 batters per SO innings — 3rd one only comes in after the
  // 2nd wicket, which itself ENDS the innings. So effectively only 2
  // batters + the 3rd as "next man in" (never needed in practice).
  // We still keep a used-squad list so the modal dropdown shows only
  // unused names, mirroring normal-innings behaviour.

  function isSO() { return !!(window.match && window.match._superOver); }

  function finishInning() {
    const m = window.match;
    if (m._superOverInning === 1) {
      // Snapshot INN1 of this SO, swap teams, start chase.
      m._superOverInn1 = {
        runs:       m.runs,
        wickets:    m.wickets,
        balls:      m.balls,
        batTeamId:  m.batTeamId,
        bowlTeamId: m.bowlTeamId,
      };
      m._superOverInning = 2;
      m.target  = m.runs + 1;
      // Swap bat/bowl.
      const tmp = m.batTeamId; m.batTeamId = m.bowlTeamId; m.bowlTeamId = tmp;
      // Fresh innings counters.
      m.runs = 0; m.wickets = 0; m.balls = 0;
      m.p1 = {}; m.p2 = {}; m.bowler = '';
      m.thisOverBalls = []; m.allBalls = []; m.usedPlayers = [];
      m.batsmanStats = {}; m.bowlerStats = {};
      if (window.CC && CC.guard) CC.guard.resetRotation();
      renderLive();
      if (window.CC && window.CC.ui) {
        window.CC.ui.toast('SO INN 1 complete. Target: ' + m.target, 'info');
      }
      openBatsmanModal('p1', 'p2', 'SO Innings 2: Select Striker');
      return;
    }
    // INN2 done — decide winner or recurse.
    const inn1 = m._superOverInn1 || { runs: 0 };
    const inn1Runs = inn1.runs || 0;
    const soIdx = m._superOverIdx || 1;
    if (m.runs > inn1Runs) {
      const name = (window.teams.find(t => t.id === m.batTeamId) || {}).name || 'Team';
      setMatchWinner(name, 'SUPER OVER ' + soIdx);
    } else if (m.runs < inn1Runs) {
      const name = (window.teams.find(t => t.id === m.bowlTeamId) || {}).name || 'Team';
      setMatchWinner(name, 'SUPER OVER ' + soIdx);
    } else {
      // Tied again — recurse. Show the SO prompt again.
      const cfg = (m.settings) || window.CRICCAST_MATCH_SETTINGS || {};
      if (cfg.tie_allowed === true) {
        setMatchWinner('MATCH TIED', 'Tied after ' + soIdx + ' Super Over' + (soIdx > 1 ? 's' : ''));
        return;
      }
      if (window.CC && window.CC.ui) {
        window.CC.ui.toast('Super Over tied — starting another SO.', 'warn');
      }
      // Keep _superOver true so startSuperOver alternates bat/bowl.
      setTimeout(() => startSuperOver(), 600);
    }
  }

  /** Called after every legal ball while in SO. Checks 1-over / 2-wicket / target-hit. */
  function soCheckEnd() {
    const m = window.match;
    if (!isSO() || m.isFinished) return;
    // Target hit during INN2?
    if (m._superOverInning === 2 && m.target && m.runs >= m.target) {
      finishInning();
      return;
    }
    // 2 wickets?
    if (m.wickets >= 2) { finishInning(); return; }
    // 1 over (6 legal balls)?
    if (m.balls >= 6)   { finishInning(); return; }
  }

  // Hook every scoring entry-point: after the original call, run soCheckEnd.
  // Also tag every ball event with is_super_over so stats can distinguish.
  function wrap(name) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      const wasSO = isSO();
      const r = orig.apply(this, arguments);
      if (wasSO && window.match && window.match.allBalls && window.match.allBalls.length) {
        const last = window.match.allBalls[window.match.allBalls.length - 1];
        last.is_super_over = true;
      }
      if (wasSO) soCheckEnd();
      return r;
    };
  }
  ['addBall', 'addWide', 'addNb', 'addBye', 'addPenalty'].forEach(wrap);

  // Wicket path: _applyWicket already records a ball event; tag and check.
  const _aw = window._applyWicket;
  if (typeof _aw === 'function') {
    window._applyWicket = function () {
      const wasSO = isSO();
      const r = _aw.apply(this, arguments);
      if (wasSO && window.match && window.match.allBalls && window.match.allBalls.length) {
        const last = window.match.allBalls[window.match.allBalls.length - 1];
        last.is_super_over = true;
      }
      if (wasSO) soCheckEnd();
      return r;
    };
  }
})();

`;

s = s.slice(0, i) + snippet + s.slice(i);
fs.writeFileSync(FILE, s, 'utf8');
console.log('super-over engine wired (', snippet.length, 'bytes inserted )');
