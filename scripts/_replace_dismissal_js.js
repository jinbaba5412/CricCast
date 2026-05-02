/**
 * Swap Controller's dismissal-modal JS from the old single-step + "Other"
 * fallback into the new 3-step flow (type -> catch subtype -> field/keeper)
 * with an optional mini-ground catch-zone picker.  Retires the generic
 * "Other" dismissal.  Data payload extended with dismissalSubtype, catchBy,
 * catchZone for the Session 5 stats aggregator.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'Controller-offline.html');
let s = fs.readFileSync(FILE, 'utf8');

const START  = 'function openDismissalModal() {';
const ANCHOR = 'function handleWicket';

const i = s.indexOf(START);
const j = s.indexOf(ANCHOR, i);
if (i < 0 || j < 0) { console.error('markers not found'); process.exit(1); }

const replacement = `/* ══════════════════════════════════════════════════════════════════
   L3 — 3-STEP DISMISSAL FLOW
   Step 1  type   : bowled | caught | lbw | run_out | stumped | hit_wicket
   Step 2  sub    : (caught only) edge | top_edge | high_ball | direct_catch
   Step 3  catchBy: (caught only) field | keeper    (+ optional zone 1..12)
   _applyWicket() now accepts a richer payload for stats aggregation.
   ══════════════════════════════════════════════════════════════════ */

var _pendingDismissalSubtype = '';   // for 'caught'
var _pendingCatchBy          = '';   // 'field' | 'keeper'
var _pendingCatchZone        = null; // 1..12 or null

function _resetDismissalState() {
  _pendingDismissalType    = '';
  _pendingDismissalSubtype = '';
  _pendingCatchBy          = '';
  _pendingCatchZone        = null;
}

function _setStepVisible(step1, step2, step3, fielder, ground) {
  document.getElementById('dismissal-step-1').style.display     = step1 ? '' : 'none';
  document.getElementById('dismissal-step-2').style.display     = step2 ? '' : 'none';
  document.getElementById('dismissal-step-3').style.display     = step3 ? '' : 'none';
  document.getElementById('dismissal-fielder-wrap').style.display = fielder ? '' : 'none';
  document.getElementById('dismissal-ground-wrap').style.display  = ground  ? '' : 'none';
}

function _dismissalBuildZones() {
  var host = document.getElementById('dismissal-zones');
  if (!host || host.childElementCount) return;
  // 6 outer (r=55..110) + 6 inner (r=0..55) wedges of 60 degrees.
  var cx = 120, cy = 120;
  function wedgePath(rInner, rOuter, a0, a1) {
    var rad = Math.PI / 180;
    var x0 = cx + rOuter * Math.cos(a0 * rad);
    var y0 = cy + rOuter * Math.sin(a0 * rad);
    var x1 = cx + rOuter * Math.cos(a1 * rad);
    var y1 = cy + rOuter * Math.sin(a1 * rad);
    var x2 = cx + rInner * Math.cos(a1 * rad);
    var y2 = cy + rInner * Math.sin(a1 * rad);
    var x3 = cx + rInner * Math.cos(a0 * rad);
    var y3 = cy + rInner * Math.sin(a0 * rad);
    return [
      'M', x0.toFixed(2), y0.toFixed(2),
      'A', rOuter, rOuter, 0, 0, 1, x1.toFixed(2), y1.toFixed(2),
      'L', x2.toFixed(2), y2.toFixed(2),
      'A', rInner, rInner, 0, 0, 0, x3.toFixed(2), y3.toFixed(2),
      'Z'
    ].join(' ');
  }
  // Outer ring: zones 7..12 (behind keeper up, rotating clockwise).
  // Inner ring: zones 1..6.
  var names = [
    // zone id (1..12)           label
    [1, 'Cover (in)'], [2, 'Mid-off (in)'], [3, 'Mid-on (in)'],
    [4, 'Mid-wkt (in)'], [5, 'Sq-leg (in)'], [6, 'Point (in)'],
    [7, 'Deep cover'], [8, 'Long off'], [9, 'Long on'],
    [10, 'Deep mid-wkt'], [11, 'Deep sq-leg'], [12, 'Third man'],
  ];
  for (var k = 0; k < 6; k++) {
    var a0 = -90 + k * 60;   // start clockwise from top
    var a1 = a0 + 60;
    var inner = names[k];
    var outer = names[k + 6];
    // inner wedge
    var pIn = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pIn.setAttribute('d', wedgePath(0, 55, a0, a1));
    pIn.setAttribute('class', 'zone');
    pIn.dataset.zone  = inner[0];
    pIn.dataset.label = inner[1];
    host.appendChild(pIn);
    // outer wedge
    var pOut = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pOut.setAttribute('d', wedgePath(55, 110, a0, a1));
    pOut.setAttribute('class', 'zone');
    pOut.dataset.zone  = outer[0];
    pOut.dataset.label = outer[1];
    host.appendChild(pOut);
  }
  host.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.dataset || !t.dataset.zone) return;
    host.querySelectorAll('.zone.selected').forEach(function (e) { e.classList.remove('selected'); });
    t.classList.add('selected');
    _pendingCatchZone = parseInt(t.dataset.zone, 10);
    var lbl = document.getElementById('dismissal-zone-label');
    if (lbl) lbl.textContent = 'Zone ' + _pendingCatchZone + ' \u00b7 ' + (t.dataset.label || '');
  });
}

function _dismissalUpdateSummary() {
  var disp = document.getElementById('dismissal-selected-type');
  if (!disp) return;
  var parts = [];
  if (_pendingDismissalType) parts.push(_pendingDismissalType.replace(/_/g, ' ').toUpperCase());
  if (_pendingDismissalSubtype) parts.push(_pendingDismissalSubtype.replace(/_/g, ' '));
  if (_pendingCatchBy) parts.push(_pendingCatchBy + ' catch');
  disp.textContent = parts.join(' \u00b7 ');
  disp.style.display = parts.length ? '' : 'none';
}

function _dismissalEnableConfirm(enable) {
  var b = document.getElementById('dismissal-confirm-btn');
  if (!b) return;
  b.disabled      = !enable;
  b.style.opacity = enable ? '1' : '0.4';
}

function openDismissalModal() {
  if (window.match.isFinished) return;
  _resetDismissalState();
  var bName = window.match.p1 && window.match.p1.name || 'Batsman';
  document.getElementById('dismissal-batsman-name').textContent = bName;
  document.getElementById('dismissal-fielder-select').innerHTML = '<option value="">-- Select from squad --</option>';
  document.getElementById('dismissal-fielder-custom').value = '';
  document.getElementById('dismissal-is-wk').value = '0';
  _dismissalEnableConfirm(false);
  _setStepVisible(true, false, false, false, false);
  // populate fielder dropdown from bowling team
  var bowlTeam = window.teams.find(function (t) { return t.id === window.match.bowlTeamId; });
  var sel = document.getElementById('dismissal-fielder-select');
  var currentBowler = window.match.bowler || '';
  if (bowlTeam && bowlTeam.players) {
    bowlTeam.players.forEach(function (p) {
      if (p.name && p.name !== currentBowler) sel.add(new Option(p.name, p.name));
    });
  }
  document.querySelectorAll('.dismissal-type-btn').forEach(function (b) { b.classList.remove('selected'); });
  _dismissalUpdateSummary();
  _dismissalBuildZones();
  document.getElementById('modal-dismissal').classList.add('open');
}

function selectDismissalType(type) {
  _pendingDismissalType    = type;
  _pendingDismissalSubtype = '';
  _pendingCatchBy          = '';
  _pendingCatchZone        = null;
  // highlight chosen step-1 button
  document.querySelectorAll('#dismissal-step-1 .dismissal-type-btn').forEach(function (b) {
    b.classList.toggle('selected', b.dataset.dt === type);
  });
  document.querySelectorAll('#dismissal-step-2 .dismissal-type-btn').forEach(function (b) { b.classList.remove('selected'); });
  document.querySelectorAll('#dismissal-step-3 .dismissal-type-btn').forEach(function (b) { b.classList.remove('selected'); });
  document.getElementById('dismissal-fielder-select').value = '';
  document.getElementById('dismissal-fielder-custom').value = '';
  document.getElementById('dismissal-is-wk').value = '0';

  switch (type) {
    case 'caught':
      _setStepVisible(true, true, false, false, false);
      _dismissalEnableConfirm(false);   // need subtype + catchBy first
      break;
    case 'run_out':
      document.getElementById('dismissal-fielder-label').textContent = 'FIELDER (who ran him out)';
      _setStepVisible(true, false, false, true, false);
      _dismissalEnableConfirm(true);    // fielder optional
      break;
    case 'stumped':
      document.getElementById('dismissal-fielder-label').textContent = 'STUMPED BY (WK)';
      document.getElementById('dismissal-is-wk').value = '1';
      _setStepVisible(true, false, false, true, false);
      _dismissalEnableConfirm(true);
      break;
    default: // bowled | lbw | hit_wicket
      _setStepVisible(true, false, false, false, false);
      _dismissalEnableConfirm(true);
  }
  _dismissalUpdateSummary();
}

function selectDismissalSubtype(sub) {
  _pendingDismissalSubtype = sub;
  document.querySelectorAll('#dismissal-step-2 .dismissal-type-btn').forEach(function (b) {
    b.classList.toggle('selected', b.dataset.sub === sub);
  });
  // reveal step 3
  document.getElementById('dismissal-step-3').style.display = '';
  _dismissalUpdateSummary();
  // confirm still disabled until catchBy picked
  _dismissalEnableConfirm(false);
}

function selectCatchBy(who) {
  _pendingCatchBy = who;
  document.querySelectorAll('#dismissal-step-3 .dismissal-type-btn').forEach(function (b) {
    b.classList.toggle('selected', b.dataset.by === who);
  });
  // Field catch: show fielder picker + mini-ground. Keeper catch: fielder only, WK flag set.
  if (who === 'field') {
    document.getElementById('dismissal-fielder-label').textContent = 'CAUGHT BY';
    document.getElementById('dismissal-is-wk').value = '0';
    _setStepVisible(true, true, true, true, true);
    _pendingCatchZone = null;
  } else { // keeper
    document.getElementById('dismissal-fielder-label').textContent = 'CAUGHT BY (WK)';
    document.getElementById('dismissal-is-wk').value = '1';
    _setStepVisible(true, true, true, true, false);
    _pendingCatchZone = null;
  }
  _dismissalUpdateSummary();
  _dismissalEnableConfirm(true);
}

function cancelDismissal() {
  closeModal('modal-dismissal');
  // Undo the saveState that was done before opening (existing behaviour).
  if (window.match.history && window.match.history.length) {
    var _hist = window.match.history;
    window.match = _hist.pop(); window.match.history = _hist;
    renderLive();
  }
  _resetDismissalState();
}

function confirmDismissal() {
  closeModal('modal-dismissal');
  var dismissType = _pendingDismissalType || 'bowled';
  var fielderSel    = document.getElementById('dismissal-fielder-select').value;
  var fielderCustom = document.getElementById('dismissal-fielder-custom').value.trim();
  var fielder = fielderSel || fielderCustom || '';
  var isWK = document.getElementById('dismissal-is-wk').value === '1';

  var meta = {
    dismissalSubtype: _pendingDismissalSubtype || null,
    catchBy:          _pendingCatchBy          || null,
    catchZone:        _pendingCatchZone        || null,
  };
  _applyWicket(dismissType, fielder, isWK, meta);
  _resetDismissalState();
}

`;

s = s.slice(0, i) + replacement + s.slice(j);
fs.writeFileSync(FILE, s, 'utf8');
console.log('dismissal JS replaced (' + (j - i) + ' -> ' + replacement.length + ' bytes)');
