/**
 * One-off: swap Controller's dismissal modal HTML block with a 3-step
 * flow (type -> catch subtype -> field/keeper + mini-ground zone picker)
 * and retire the generic "Other" dismissal.
 *
 * Anchored on the stable markers `<div class="modal-overlay" id="modal-dismissal">`
 * and the trailing `</style>` of its scoped styles.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');
let s = fs.readFileSync(FILE, 'utf8');

const START = '<div class="modal-overlay" id="modal-dismissal">';
const END_MARKER = '.dismissal-type-btn.selected{border-color:var(--gold);background:rgba(245,158,11,0.2);color:var(--gold);}\n</style>';

const i = s.indexOf(START);
const jBase = s.indexOf(END_MARKER);
if (i < 0 || jBase < 0) {
  console.error('markers not found', { i, jBase });
  process.exit(1);
}
const j = jBase + END_MARKER.length;

const replacement = `<div class="modal-overlay" id="modal-dismissal">
  <div class="modal-box" style="max-width:480px;">
    <h3 style="margin-bottom:12px;">
      <svg style="display:inline-block;vertical-align:middle;margin-right:4px;" width="13" height="20" viewBox="0 0 80 160"><g transform="rotate(40 40 90)"><path d="M 37 4 L 43 4 L 43 63 Q 72 68 72 88 L 72 148 Q 58 160 40 160 Q 22 160 8 148 L 8 88 Q 8 68 37 63 Z" fill="white"/></g></svg>
      How was <span id="dismissal-batsman-name" style="color:var(--gold);">\u2014</span> out?
    </h3>

    <!-- STEP 1: dismissal type -->
    <div id="dismissal-step-1" style="margin-bottom:12px;">
      <label style="font-size:12px;color:var(--muted);font-weight:700;display:block;margin-bottom:6px;letter-spacing:1.5px;">STEP 1 \u00b7 DISMISSAL TYPE</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button class="dismissal-type-btn" data-dt="bowled"     onclick="selectDismissalType('bowled')">Bowled</button>
        <button class="dismissal-type-btn" data-dt="caught"     onclick="selectDismissalType('caught')">Caught</button>
        <button class="dismissal-type-btn" data-dt="lbw"        onclick="selectDismissalType('lbw')">LBW</button>
        <button class="dismissal-type-btn" data-dt="run_out"    onclick="selectDismissalType('run_out')">Run Out</button>
        <button class="dismissal-type-btn" data-dt="stumped"    onclick="selectDismissalType('stumped')">Stumped</button>
        <button class="dismissal-type-btn" data-dt="hit_wicket" onclick="selectDismissalType('hit_wicket')">Hit Wicket</button>
      </div>
    </div>

    <!-- STEP 2: catch subtype (Caught only) -->
    <div id="dismissal-step-2" style="display:none;margin-bottom:12px;">
      <label style="font-size:12px;color:var(--muted);font-weight:700;display:block;margin-bottom:6px;letter-spacing:1.5px;">STEP 2 \u00b7 CATCH KIND</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button class="dismissal-type-btn" data-sub="edge"         onclick="selectDismissalSubtype('edge')">Edge</button>
        <button class="dismissal-type-btn" data-sub="top_edge"     onclick="selectDismissalSubtype('top_edge')">Top Edge</button>
        <button class="dismissal-type-btn" data-sub="high_ball"    onclick="selectDismissalSubtype('high_ball')">High Ball</button>
        <button class="dismissal-type-btn" data-sub="direct_catch" onclick="selectDismissalSubtype('direct_catch')">Direct Catch</button>
      </div>
    </div>

    <!-- STEP 3: who caught (field / keeper) -->
    <div id="dismissal-step-3" style="display:none;margin-bottom:12px;">
      <label style="font-size:12px;color:var(--muted);font-weight:700;display:block;margin-bottom:6px;letter-spacing:1.5px;">STEP 3 \u00b7 WHO CAUGHT?</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button class="dismissal-type-btn" data-by="field"  onclick="selectCatchBy('field')">Field Catch</button>
        <button class="dismissal-type-btn" data-by="keeper" onclick="selectCatchBy('keeper')">Keeper Catch (WK)</button>
      </div>
    </div>

    <!-- FIELDER PICKER (caught / run_out / stumped) -->
    <div id="dismissal-fielder-wrap" style="display:none;margin-bottom:12px;">
      <label style="font-size:13px;color:var(--muted);font-weight:700;display:block;margin-bottom:6px;" id="dismissal-fielder-label">FIELDER</label>
      <select id="dismissal-fielder-select" style="width:100%;margin-bottom:8px;"><option value="">-- Select from squad --</option></select>
      <input type="text" id="dismissal-fielder-custom" placeholder="Or type fielder name..." style="width:100%;">
      <input type="hidden" id="dismissal-is-wk" value="0">
    </div>

    <!-- MINI-GROUND CATCH MAP (only field catches) -->
    <div id="dismissal-ground-wrap" style="display:none;margin-bottom:12px;">
      <label style="font-size:12px;color:var(--muted);font-weight:700;display:block;margin-bottom:6px;letter-spacing:1.5px;">CATCH ZONE (optional)</label>
      <svg id="dismissal-ground-svg" viewBox="0 0 240 240" style="display:block;width:220px;height:220px;margin:0 auto 4px;">
        <!-- boundary -->
        <circle cx="120" cy="120" r="110" fill="#14532d" stroke="#22c55e" stroke-width="2"/>
        <!-- 30-yard / inner circle -->
        <circle cx="120" cy="120" r="55"  fill="none"    stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-dasharray="3 3"/>
        <!-- pitch -->
        <rect x="110" y="95" width="20" height="50" fill="#a16207" stroke="#78350f" stroke-width="1"/>
        <!-- zone 1..6 = inner; 7..12 = outer. 6 slices each, 60 deg. -->
        <g id="dismissal-zones"></g>
      </svg>
      <div id="dismissal-zone-label" style="text-align:center;font-size:12px;color:var(--muted);font-weight:700;letter-spacing:1.5px;text-transform:uppercase;min-height:16px;"></div>
    </div>

    <!-- SELECTED SUMMARY -->
    <div id="dismissal-selected-type" style="display:none;padding:6px 12px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:14px;color:var(--gold);font-weight:700;margin-bottom:12px;"></div>

    <div class="modal-actions">
      <button class="modal-cancel" onclick="cancelDismissal()">Cancel</button>
      <button class="modal-ok" id="dismissal-confirm-btn" onclick="confirmDismissal()" disabled style="opacity:0.4;">
        <svg style="display:inline-block;vertical-align:middle;margin-right:5px;" width="15" height="15" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Confirm Out
      </button>
    </div>
  </div>
</div>
<style>
.dismissal-type-btn{padding:10px 8px;border-radius:8px;border:2px solid rgba(255,255,255,0.12);background:rgba(30,41,59,0.8);color:#e2e8f0;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .15s;text-align:center;}
.dismissal-type-btn:hover{border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.1);}
.dismissal-type-btn.selected{border-color:var(--gold);background:rgba(245,158,11,0.2);color:var(--gold);}
#dismissal-ground-svg .zone{fill:rgba(34,197,94,0.0);stroke:rgba(255,255,255,0.18);stroke-width:0.5;cursor:pointer;transition:fill .12s;}
#dismissal-ground-svg .zone:hover{fill:rgba(251,191,36,0.25);}
#dismissal-ground-svg .zone.selected{fill:rgba(251,191,36,0.5);stroke:var(--gold);stroke-width:1.5;}
</style>`;

s = s.slice(0, i) + replacement + s.slice(j);
fs.writeFileSync(FILE, s, 'utf8');
console.log('dismissal modal replaced (' + (j - i) + ' -> ' + replacement.length + ' bytes)');
