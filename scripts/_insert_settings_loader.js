/**
 * L4-Step-1 — after the existing match-context loader in Controller-offline.html
 * pulls the state-seed, fetch the effective settings (tenant defaults merged
 * with per-match overrides) and stash onto window.CRICCAST_MATCH_SETTINGS +
 * window.match.settings so every rule in Session 4 (tie / free hit /
 * powerplay / super over) can read from one place.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');

let s = fs.readFileSync(FILE, 'utf8');

// Anchor: the console.log inside loadMatchContext right before the catch.
const ANCHOR = `console.log('[CricCast] Match context loaded:', seed.matchId, '| Template:', seed.overlayTemplate);`;
const i = s.indexOf(ANCHOR);
if (i < 0) {
  console.error('anchor not found — is loadMatchContext still present?');
  process.exit(1);
}

if (s.includes('CRICCAST_MATCH_SETTINGS')) {
  console.log('settings loader already present, skipping');
  process.exit(0);
}

// Insert a settings fetch right BEFORE the anchor so it's still inside the
// try { ... } block of loadMatchContext and still runs before the final
// console.log. Indentation is 4 spaces to match the surrounding block.
const insertion = [
  '',
  '    /* ════════════════════════════════════════════════════════════════',
  '       L4 — Load effective settings (tenant defaults merged with per-match',
  '       overrides). Stored on window.CRICCAST_MATCH_SETTINGS + mirrored on',
  '       window.match.settings so the tie / free-hit / powerplay / super-over',
  '       engines can read them from a single place without extra fetches.',
  '       Best-effort: on failure we fall back to hardcoded safe defaults so',
  '       the Controller still boots offline.',
  '       ════════════════════════════════════════════════════════════════ */',
  '    try {',
  "      const sr = await fetch('/api/club/match/' + matchId + '/settings',",
  "                             { credentials: 'include', cache: 'no-store' });",
  '      if (sr.ok) {',
  '        const sd = await sr.json();',
  '        if (sd && sd.effective) window.CRICCAST_MATCH_SETTINGS = sd.effective;',
  '      }',
  '    } catch (e) { /* offline-safe: fall back to defaults */ }',
  '    window.CRICCAST_MATCH_SETTINGS = window.CRICCAST_MATCH_SETTINGS || {',
  '      super_ball_enabled:   true,',
  "      powerplay_enabled:    true,",
  "      powerplay_mode:       'auto',",
  '      free_hit_enabled:     true,',
  '      penalty_runs_enabled: true,',
  '      tie_allowed:          false,',
  '      custom_overs:         seed.maxOvers || 20,',
  '    };',
  '    if (window.match) window.match.settings = window.CRICCAST_MATCH_SETTINGS;',
  '',
  '    ',
].join('\n');

s = s.slice(0, i) + insertion + s.slice(i);
fs.writeFileSync(FILE, s, 'utf8');
console.log('settings loader inserted at offset', i, '(', insertion.length, 'bytes )');
