/**
 * One-off tool: replace the Controller-offline.html teams-screen HTML block
 * (old full CRUD form) with a minimal read-only screen. Safe because we
 * anchor on unique markers that appear exactly once each.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'Controller-offline.html');
let s = fs.readFileSync(file, 'utf8');

const START_MARKER = '<!-- ════ TEAMS SCREEN ════ -->';
const END_MARKER   = '<!-- ════ SETUP SCREEN ════ -->';

const i = s.indexOf(START_MARKER);
const j = s.indexOf(END_MARKER);
if (i < 0 || j < 0 || j <= i) {
  console.error('Markers not found. start=', i, 'end=', j);
  process.exit(1);
}

const REPLACEMENT = `<!-- ════ TEAMS SCREEN ════ -->
<div id="screen-teams" class="screen active">
<div class="page-wrap">
  <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
    <span>Tournament Teams</span>
    <div style="display:flex;gap:8px;align-items:center;">
      <span id="teams-source-status" style="font-size:12px;color:var(--muted);"></span>
      <button onclick="window.loadTeamsReadOnly && window.loadTeamsReadOnly(true)"
              style="padding:6px 12px;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:6px;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;">
        ⟳ REFRESH
      </button>
    </div>
  </div>

  <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--muted);line-height:1.5;">
    <strong style="color:var(--text);">Read-only view.</strong>
    Teams and players are managed in the <strong>Dashboard</strong>. Any changes made there will appear here automatically when you return to this screen.
  </div>

  <div id="teams-grid" class="teams-grid"></div>
  <div id="team-details" style="margin-top:18px;"></div>

</div>
</div>

`;

const out = s.slice(0, i) + REPLACEMENT + s.slice(j);
fs.writeFileSync(file, out, 'utf8');
console.log('Replaced teams-screen block (old', j - i, 'chars →', REPLACEMENT.length, 'chars).');
