/**
 * L4-Step-2 — Tie detection.
 *
 * Current checkWinCondition() always declares MATCH TIED when INN2 ends
 * with scores level. Under Session 4 rules:
 *   - if tenant/match has tie_allowed = true  → keep the TIE result
 *   - if tie_allowed = false (default)        → show Super Over section
 *
 * We rewrite the `else` branch of the final-ball block to consult the
 * settings first. The rest of the function is untouched.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');

let s = fs.readFileSync(FILE, 'utf8');

// Target the exact else-branch bytes (matches current source layout).
// Leading whitespace is significant — we preserve the 6-space indent.
const target =
`      } else {
        setMatchWinner('MATCH TIED', 'SCORES LEVEL');
      }`;

const i = s.indexOf(target);
if (i < 0) {
  console.error('tie-branch anchor not found');
  process.exit(1);
}
if (s.includes('tie_allowed === true')) {
  console.log('tie detection already wired, skipping');
  process.exit(0);
}

const replacement =
`      } else {
        // L4 — Tie handling. If the tenant/match has opted into allowing a
        // tie as a final result, call the match tied and stop. Otherwise
        // surface the Super Over section so the admin can kick off a SO.
        const _cfg = (window.match && window.match.settings) || window.CRICCAST_MATCH_SETTINGS || {};
        if (_cfg.tie_allowed === true) {
          window.match.resultType = 'tie';
          setMatchWinner('MATCH TIED', 'Scores level and innings completed');
        } else {
          const soSec2 = document.getElementById('super-over-section');
          if (soSec2) soSec2.style.display = 'block';
          setMatchWinner('SUPER OVER', 'TIED - NEEDS SUPER OVER');
        }
      }`;

s = s.slice(0, i) + replacement + s.slice(i + target.length);
fs.writeFileSync(FILE, s, 'utf8');
console.log('tie detection wired (', target.length, '->', replacement.length, 'bytes )');
