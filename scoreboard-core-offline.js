/**
 * scoreboard-core-offline.js — CricCast Broadcast Engine v6
 *
 * v6 — Node.js native, real-time via SSE:
 *  - Primary:  EventSource /api/events  → instant push when controller updates
 *  - Fallback: polls GET /api/state every 3 s when SSE is unavailable
 *  - No BroadcastChannel, no localStorage, no PHP dependencies
 *  - Captain/player photos pop above bar — no circle, full portrait
 *  - Auto color-swap on 2nd innings (batting/bowling themes swap)
 */

'use strict';

/* ── Connection config ── */
const CRICCAST_KEY  = 'criccast_state';
// Allow SaaS injection to override URLs (set by match route before this file loads)
const SSE_URL       = window.CRICCAST_SSE_URL   || '/api/events';   /* Server-Sent Events endpoint (primary)  */
const STATE_URL     = window.CRICCAST_STATE_URL  || '/api/state';    /* REST state endpoint (fallback poll)     */
const POLL_INTERVAL = 10000;           /* Fallback poll interval — only when SSE down */

/* ════════════════════════════════════════════════
   LOGO BAR CSS — clean flat logos, no circle, no pop-above
   Captain photos fill the bar height cleanly.
════════════════════════════════════════════════ */
(function injectPopoutCSS() {
  const css = `
    /* Bar allows captain photo to pop above — overflow must be visible */
    .broadcast-bar {
      overflow: visible !important;
    }

    /* ── Overlay backdrop: cover full viewport, center cards ── */
    #master-wrap.overlay-active {
      position: fixed !important;
      inset: 0 !important;
      z-index: 9000 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      }
    #master-wrap.overlay-active #master-broadcast-bar {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      z-index: 9100 !important;
    }

    /* Logo cell: full height of bar, no circle, no border */
    /* overflow:visible so captain photo can extend above the bar */
    .bb-logo {
      overflow: visible !important;
      position: relative !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 0 !important;
    }
    .ss-logo {
      border-radius: 0 !important;
      overflow: visible !important;
      border: none !important;
      background: transparent !important;
      position: relative !important;
    }

    /* Team logo image — contained, no circle */
    .cc-logo-bar-img {
      display: block;
      width: 80%;
      height: 80%;
      object-fit: contain;
      object-position: center;
    }

    /* Captain/player photo — HEAD-ABOVE-BAR effect:
       Image is 200% of bar height, anchored at bottom of logo cell,
       so the head+shoulders visibly pops above the bar.
       object-position:top ensures the face is at the top of the crop. */
    .cc-logo-bar-img.is-captain {
      position: absolute !important;
      bottom: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 200% !important;
      object-fit: cover !important;
      object-position: top center !important;
      z-index: 20 !important;
      border-radius: 0 !important;
    }

    /* Emoji fallback */
    .cc-logo-emoji {
      font-size: 34px;
      line-height: 1;
    }

    /* Small inline logo in overlay cards — still rounded is fine */
    .cc-logo-inline {
      width: 100%; height: 100%;
      object-fit: cover;
      object-position: top center;
      border-radius: 4px;
    }
  `;
  const el = document.createElement('style');
  el.id = 'cc-popout-styles';
  el.textContent = css;
  document.head.appendChild(el);
})();

/* ════════════════════════════════════════════════
   COMPACT OVERLAY CSS
════════════════════════════════════════════════ */
(function injectCompactStyles() {
  const css = `
    .ic-table th { padding: 5px 12px !important; font-size: 11px !important; }
    .ic-table td { padding: 5px 12px !important; font-size: 13px !important; }
    .ic-table td.cc-bat-name,
    .ic-table td.batter-name  { font-size: 13px !important; }
    .ic-section-title         { padding: 5px 14px !important; font-size: 12px !important; }
    .ic-header                { padding: 10px 16px !important; }
    .ic-team-name             { font-size: 20px !important; }
    .ic-total-badge           { font-size: 26px !important; }
    .ic-subtitle              { font-size: 11px !important; letter-spacing: 1.5px !important; }
    .ms-player-row,
    .sc-row                   { font-size: 12px !important; padding: 5px 10px !important; }
    .ms-bat-row td, .ms-bowl-row td { padding: 4px 10px !important; font-size: 12px !important; }
    #target-strip {
      display: none; align-items: center; gap: 14px; padding: 6px 20px;
      background: rgba(245,158,11,0.12);
      border-top: 1px solid rgba(245,158,11,0.3);
      border-bottom: 1px solid rgba(245,158,11,0.3);
      font-family: 'Barlow Condensed', sans-serif; font-size: 15px;
      font-weight: 900; letter-spacing: 2px; text-transform: uppercase;
      color: var(--gold, #f59e0b);
    }
    #target-strip strong { font-size: 20px; color: #fff; }
  `;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
})();

/* ════════════════════════════════════════════════
   SHARED OVERLAY CSS
════════════════════════════════════════════════ */
(function injectSharedCSS() {
  const css = `
.cc-table { width: 100%; border-collapse: collapse; }
.cc-table thead tr { background: rgba(255,255,255,0.03); }
.cc-table th { padding: 8px 18px; font-size: 12px; font-weight: 900; letter-spacing: 1.5px; color: rgba(255,255,255,0.5); text-transform: uppercase; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08); }
.cc-table th:not(:first-child) { text-align: right; }
.cc-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background .15s; }
.cc-table tbody tr.striker-row { background: transparent; }
.cc-table td { padding: 9px 18px; font-size: 15px; font-weight: 700; color: #fff; text-align: left; }
.cc-table td:not(:first-child) { text-align: right; }
.cc-bat-name { font-size: 16px; font-weight: 900; text-transform: uppercase; }
.cc-bat-name .not-out { color: #f59e0b; font-size: 11px; margin-left: 4px; vertical-align: super; }
.cc-bat-name .out-label { font-size: 11px; color: rgba(255,255,255,0.4); display: block; font-weight: 600; }
.cc-runs { font-size: 20px; font-weight: 900; }
.cc-balls { color: rgba(255,255,255,0.5); }
.cc-4s { color: #6ee7b7; font-weight: 900; }
.cc-6s { color: #5eead4; font-weight: 900; }
.cc-sr { color: rgba(255,255,255,0.4); font-size: 14px; }
.ms-innings { padding: 20px 24px; }
.ms-innings:first-child { border-right: 1px solid rgba(255,255,255,0.07); }
.ms-inn-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.ms-inn-logo { width: 64px; height: 64px; border-radius: 8px; background: transparent; border: none; display: flex; align-items: center; justify-content: center; overflow: visible; flex-shrink: 0; }
.ms-inn-team { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px; color: #fff; }
.ms-inn-label { font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
.ms-inn-score { margin-left: auto; text-align: right; }
.ms-inn-score .runs { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #f59e0b; letter-spacing: 2px; line-height: 1; }
.ms-inn-score .overs { font-size: 13px; color: rgba(255,255,255,0.5); }
.ms-section-label { font-size: 12px; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,0.5); text-transform: uppercase; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.ms-player-row, .ms-bowl-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.ms-player-name, .ms-bowl-name { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #fff; }
.ms-player-name .status { color: #f59e0b; font-size: 11px; margin-left: 4px; }
.ms-player-stat .main { font-size: 20px; font-weight: 900; color: #fff; }
.ms-player-stat .balls { color: rgba(255,255,255,0.5); font-size: 14px; }
.ms-bowl-fig .w { color: #fca5a5; font-size: 20px; font-weight: 900; }
.ms-bowl-fig .r { color: rgba(255,255,255,0.5); }
.ms-gap { height: 16px; }
.ms-result-banner { padding: 14px; text-align: center; font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 4px; color: #fff; background: rgba(30,64,175,0.9); }
.ms-result-banner.win-bat { background: linear-gradient(90deg, #065f46, #047857) !important; }
.ms-result-banner.tied { background: #374151 !important; }
.ts-card { border-radius: 16px; overflow: hidden; width: 100%; }
.ts-header { display: flex; align-items: center; gap: 16px; padding: 20px 24px; }
.ts-logo { width: 84px; height: 84px; border-radius: 8px; border: none; background: transparent; display: flex; align-items: center; justify-content: center; overflow: visible; flex-shrink: 0; }
.ts-logo img, .ts-logo svg { width: 76px; height: 76px; object-fit: contain; }
.ts-team-info { flex: 1; }
.ts-team-name { font-family: 'Bebas Neue', sans-serif; font-size: 40px; letter-spacing: 4px; color: #fff; line-height: 1; }
.ts-team-sub { font-size: 13px; color: rgba(255,255,255,0.6); font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 3px; }
.ts-tabs { display: flex; }
.ts-tab { padding: 8px 16px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.6); border-radius: 8px; cursor: pointer; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; transition: all .2s; margin-left: 6px; }
.ts-tab.active { background: #f59e0b; color: #000; border-color: #f59e0b; }
.ts-list-header { display: grid; grid-template-columns: 36px 1fr 90px; padding: 8px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 12px; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase; background: rgba(0,0,0,0.3); font-family: 'Barlow Condensed', sans-serif; font-weight: 900; }
.ts-player-row { display: grid; grid-template-columns: 36px 1fr 90px; align-items: center; padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.ts-player-num { color: rgba(255,255,255,0.35); font-size: 15px; }
.ts-player-name { font-size: 18px; font-weight: 900; text-transform: uppercase; color: #fff; font-family: 'Barlow Condensed', sans-serif; }
.ts-player-role { display: flex; align-items: center; }
.role-chip { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); font-family: 'Barlow Condensed', sans-serif; }
.role-chip.bat  { background: rgba(245,158,11,0.2); color: #f59e0b; }
.role-chip.bowl { background: rgba(220,38,38,0.2);  color: #fca5a5; }
.role-chip.wk   { background: rgba(16,185,129,0.2); color: #6ee7b7; }
.role-chip.all  { background: rgba(139,92,246,0.2); color: #c4b5fd; }
.role-chip.spin { background: rgba(6,182,212,0.15); color: #67e8f9; }
.role-chip.cap  { background: rgba(245,158,11,0.25); color: #f59e0b; font-size: 11px; }
.role-chip.vcap { background: rgba(245,158,11,0.12); color: #fcd34d; font-size: 11px; }
.ts-footer { padding: 10px 20px; text-align: center; opacity: .5; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; border-top: 1px solid rgba(255,255,255,0.06); font-family: 'Barlow Condensed', sans-serif; font-weight: 700; }
`;
  const el = document.createElement('style');
  el.id = 'cc-shared-styles';
  el.textContent = css;
  document.head.appendChild(el);
})();

/* ════════════════════════════════════════════════
   LOGO HELPERS
════════════════════════════════════════════════ */

/**
 * logoElBar — used inside the broadcast bar (.bb-logo / .ss-logo)
 * Clean flat image — fills the logo cell, no circle, no pop-above.
 */
function logoElBar(team) {
  if (!team) return '';
  // D2 (B-LOGO-OR-CAPTAIN) — honor team.barLogoMode:
  //   auto    : captain if set, else logo (legacy)
  //   logo    : team logo only
  //   captain : captain photo (or logo / emoji fallback)
  //   both    : logo + captain layered (captain absolute, see CSS)
  const mode = team.barLogoMode || 'auto';
  const cp   = team.captainPhoto;
  const hasCaptain = cp && (cp.type === 'image' || cp.type === 'url') && cp.value;
  const logo = team.logo;
  const hasLogo   = logo && (logo.type === 'img' || logo.type === 'image' || logo.type === 'url') && logo.value;
  const emojiVal  = (logo && logo.type === 'emoji' && logo.value) ? logo.value : '🏏';
  // D6 (B-LOGO-FALLBACK): if a logo image fails to load, replace the
  // <img> with the emoji span so the bar never shows a broken icon.
  const _onerrLogo    = "this.outerHTML='<span class=&quot;cc-logo-emoji&quot;>\u{1F3CF}</span>'";
  const _onerrCaptain = "this.outerHTML='<span class=&quot;cc-logo-emoji&quot;>\u{1F3CF}</span>'";
  const _logo    = () => `<img class="cc-logo-bar-img" src="${logo.value}" alt="${team.name}" loading="eager" onerror="${_onerrLogo}">`;
  const _captain = () => `<img class="cc-logo-bar-img is-captain" src="${cp.value}" alt="${team.name}" loading="eager" onerror="${_onerrCaptain}">`;
  const _emoji   = () => `<span class="cc-logo-emoji">${emojiVal}</span>`;
  if (mode === 'logo')    return hasLogo ? _logo() : _emoji();
  if (mode === 'captain') return hasCaptain ? _captain() : (hasLogo ? _logo() : _emoji());
  if (mode === 'both') {
    let out = '';
    if (hasLogo)    out += _logo();
    if (hasCaptain) out += _captain();
    return out || _emoji();
  }
  // auto
  if (hasCaptain) return _captain();
  if (hasLogo)    return _logo();
  return _emoji();
}

/**
 * logoEl — used in overlay cards (no pop-out, small inline)
 */
function logoEl(team, size) {
  if (!team) return '';
  const logo = team.logo;
  size = size || 40;

  if (logo && (logo.type === 'img' || logo.type === 'image' || logo.type === 'url') && logo.value) {
    // D6 (B-LOGO-FALLBACK): swap to emoji on broken URL.
    const fbSize = Math.round(size * 0.65);
    const onerr  = "this.outerHTML='<span style=&quot;font-size:" + fbSize + "px;line-height:1;&quot;>\u{1F3CF}</span>'";
    return `<img class="cc-logo-inline" src="${logo.value}" alt="${team.name}" loading="eager" onerror="${onerr}"
            style="width:${size}px;height:${size}px;object-fit:contain;border-radius:6px;">`;
  }
  const emoji = (logo && logo.type === 'emoji' && logo.value) ? logo.value : '🏏';
  return `<span style="font-size:${Math.round(size * 0.65)}px;line-height:1;">${emoji}</span>`;
}

window.logoEl    = logoEl;
window.logoElBar = logoElBar;

/* ════════════════════════════════════════════════
   COLOUR VARIABLES
════════════════════════════════════════════════ */
function applyColorVars(matchData, teamsData) {
  const root = document.documentElement;
  // D5 (B-COLOR-FROZEN): re-derive bat/bowl colors from the team objects
  // every render so the broadcast bar tracks the *current* batting side
  // (innings swap, toss-flip, etc.) instead of the value frozen at
  // startMatch. Falls back to matchData.batColor/bowlColor if the team
  // record is missing.
  if (Array.isArray(teamsData) && teamsData.length) {
    const batT  = teamsData.find(t => t.id === matchData.batTeamId);
    const bowlT = teamsData.find(t => t.id === matchData.bowlTeamId);
    const batC  = (batT  && batT.color)  || matchData.batColor;
    const bowlC = (bowlT && bowlT.color) || matchData.bowlColor;
    if (batC)  root.style.setProperty('--bat-color',  batC);
    if (bowlC) root.style.setProperty('--bowl-color', bowlC);
    return;
  }
  if (matchData.batColor)  root.style.setProperty('--bat-color',  matchData.batColor);
  if (matchData.bowlColor) root.style.setProperty('--bowl-color', matchData.bowlColor);
}

/* ════════════════════════════════════════════════
   WINNER STATE — hide losing team logo/captain
   Runs after every renderBroadcastBar call so ALL
   templates get consistent winner visuals.
════════════════════════════════════════════════ */
function applyWinnerLogoState(matchData, teamsData) {
  if (!matchData) return;
  const logoL    = document.getElementById('bb-logo-left');
  const logoR    = document.getElementById('bb-logo-right');
  const uibat    = document.getElementById('bb-batting-ui');
  const uiscore  = document.getElementById('bb-score-ui');
  const uibowl   = document.getElementById('bb-bowling-ui');
  const winnerUI = document.getElementById('bb-winner-ui');

  if (matchData.isFinished && matchData.winner) {
    const batTeam  = (teamsData || []).find(t => t.id === matchData.batTeamId);
    const bowlTeam = (teamsData || []).find(t => t.id === matchData.bowlTeamId);

    // Hide live UI panels, show winner
    if (uibat)    uibat.style.display    = 'none';
    if (uiscore)  uiscore.style.display  = 'none';
    if (uibowl)   uibowl.style.display   = 'none';
    if (winnerUI) {
      winnerUI.style.display = 'flex';
      const bigEl = document.getElementById('w-big-text');
      const subEl = document.getElementById('w-sub-text');
      if (bigEl) bigEl.textContent = String(matchData.winner || 'MATCH ENDED').toUpperCase();
      if (subEl) subEl.textContent = String(matchData.winDesc || '').toUpperCase();
    }

    if (matchData.winner === (batTeam && batTeam.name || '')) {
      // Batting team won — show left logo, hide right
      if (logoL) logoL.style.display = 'flex';
      if (logoR) logoR.style.display = 'none';
      if (winnerUI) winnerUI.style.background = 'var(--bat-color)';
    } else if (matchData.winner === (bowlTeam && bowlTeam.name || '')) {
      // Bowling team won — hide left logo, show right
      if (logoL) logoL.style.display = 'none';
      if (logoR) logoR.style.display = 'flex';
      if (winnerUI) winnerUI.style.background = 'var(--bowl-color)';
    } else {
      // Tie / draw / unknown — show both
      if (logoL) logoL.style.display = 'flex';
      if (logoR) logoR.style.display = 'flex';
      if (winnerUI) winnerUI.style.background = '#1e3a8a';
    }
  } else {
    // Match not finished — restore normal state
    if (logoL) logoL.style.display = 'flex';
    if (logoR) logoR.style.display = 'flex';
    if (winnerUI) winnerUI.style.display = 'none';
    if (uibat)   uibat.style.display   = 'flex';
    if (uiscore) uiscore.style.display  = 'flex';
    if (uibowl)  uibowl.style.display   = 'flex';
  }
}

/* ════════════════════════════════════════════════
   INNINGS CARD OVERLAY
════════════════════════════════════════════════ */
function renderInningsCard(matchData, teamsData) {
  const card = document.getElementById('innings-card');
  if (!card) return;

  const isInn2   = matchData.overlayMode === 'inning2';
  // During live inning1, inning1BatTeamId is null → fall back to current batTeamId
  const inn1BatId  = matchData.inning1BatTeamId  || matchData.batTeamId;
  const inn1BowlId = matchData.inning1BowlTeamId || matchData.bowlTeamId;
  const batTeam  = isInn2
    ? teamsData.find(t => t.id === matchData.batTeamId)
    : teamsData.find(t => t.id === inn1BatId);
  const bowlTeam = isInn2
    ? teamsData.find(t => t.id === matchData.bowlTeamId)
    : teamsData.find(t => t.id === inn1BowlId);

  // During live inning1, inning1BatStats is empty → fall back to current batsmanStats
  const inn1StatsAvailable = matchData.inning1BatTeamId != null;
  const batStats  = isInn2
    ? matchData.batsmanStats
    : (inn1StatsAvailable ? matchData.inning1BatStats  : matchData.batsmanStats);
  const bowlStats = isInn2
    ? matchData.bowlerStats
    : (inn1StatsAvailable ? matchData.inning1BowlStats : matchData.bowlerStats);
  const runs      = isInn2 ? matchData.runs    : (inn1StatsAvailable ? matchData.inning1Runs    : matchData.runs)    || 0;
  const wickets   = isInn2 ? matchData.wickets : (inn1StatsAvailable ? matchData.inning1Wickets : matchData.wickets) || 0;
  const balls     = isInn2 ? matchData.balls   : (inn1StatsAvailable ? matchData.inning1Balls   : matchData.balls)   || 0;
  // L3 — replace the "1ST INNINGS / 2ND INNINGS" ribbon with an "OVERS: X.Y"
  // indicator (team/inning colour is still preserved below so viewers can
  // still see at a glance which innings is live).
  const _ovF = Math.floor(((matchData.balls || 0)) / 6) + '.' + ((matchData.balls || 0) % 6);
  const innLabel  = 'OVERS: ' + _ovF;
  const innColor  = isInn2 ? '#059669' : '#2563eb';

  const teamColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--bat-color').trim() || '#1e3a8a';

  const logoHtml = batTeam ? `<div class="ic-logo">${logoEl(batTeam, 44)}</div>` : '';

  // Show current batters for live innings; for completed inn1 viewed during inn2, no live batters
  const isLiveInn1 = !isInn2 && !inn1StatsAvailable;
  const currentBatters = (isInn2 || isLiveInn1) ? [matchData.p1?.name, matchData.p2?.name].filter(Boolean) : [];

  const batEntries = Object.entries(batStats || {});
  batEntries.sort((a, b) => {
    if (!a[1].out && b[1].out) return -1;
    if (a[1].out && !b[1].out) return 1;
    return b[1].runs - a[1].runs;
  });

  let batRows = '';
  for (const [name, s] of batEntries) {
    const isStriker = currentBatters.includes(name);
    const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '—';
    const statusBadge = s.out
      ? `<span class="out-label">${s.how || 'out'}</span>`
      : (s.retired ? `<span class="out-label" style="color:#c4b5fd;">ret not out</span>` : '');
    const strikerBat = '';  // bat icon only on scoreboard bar, not in INN overlay
    batRows += `<tr>
      <td class="batter-name cc-bat-name">${strikerBat}${name}${!s.out && !s.retired ? '<span class="not-out" style="color:rgba(255,255,255,0.5);">*</span>' : ''}${statusBadge}</td>
      <td class="ic-runs cc-runs">${s.runs}</td>
      <td class="ic-balls cc-balls">${s.balls}</td>
      <td class="ic-4 cc-4s">${s.fours}</td>
      <td class="ic-6 cc-6s">${s.sixes}</td>
      <td class="ic-sr cc-sr">${sr}</td>
    </tr>`;
  }

  const bowlEntries = Object.entries(bowlStats || {});
  bowlEntries.sort((a, b) => b[1].wickets - a[1].wickets || a[1].runs - b[1].runs);
  let bowlRows = '';
  for (const [name, s] of bowlEntries) {
    const eco = s.balls > 0 ? (s.runs / (s.balls / 6)).toFixed(2) : '—';
    bowlRows += `<tr>
      <td class="batter-name">${name}</td>
      <td class="cc-balls">${Math.floor(s.balls/6)}.${s.balls%6}</td>
      <td>${s.runs}</td>
      <td style="color:#fca5a5;font-weight:900;">${s.wickets}</td>
      <td class="cc-sr">${eco}</td>
    </tr>`;
  }

  const crr = balls > 0 ? (runs / (balls / 6)).toFixed(2) : '0.00';

  card.innerHTML = `
  <div style="background:rgba(5,8,18,0.98);border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.95),0 0 0 1px rgba(255,255,255,0.08);border-bottom:4px solid var(--gold,#f59e0b);">
    <div style="background:linear-gradient(135deg,${teamColor} 0%,rgba(0,0,0,0.75) 100%);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 16px 4px;">
        <span style="font-size:11px;font-weight:900;letter-spacing:3px;text-transform:uppercase;background:${innColor};color:#fff;padding:3px 10px;border-radius:4px;">${innLabel}</span>${
          matchData.powerplayActive
            ? '<span style="margin-left:6px;font-size:11px;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;background:#fef08a;color:#78350f;padding:3px 8px;border-radius:4px;">'
              + (matchData.powerplayLabel || 'PP')
              + '</span>'
            : ''
        }
        <span style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:var(--gold,#f59e0b);letter-spacing:2px;line-height:1;">${runs}/${wickets}
          <span style="font-size:14px;color:rgba(255,255,255,0.5);font-family:'Barlow Condensed',sans-serif;font-weight:700;">&nbsp;${Math.floor(balls/6)}.${balls%6} OV &nbsp;CRR ${crr}</span>
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:14px;padding:4px 16px 10px;">
        ${logoHtml}
        <div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:3px;color:#fff;line-height:1;">${(batTeam?.name||'—').toUpperCase()}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);font-weight:700;">vs ${(bowlTeam?.name||'—').toUpperCase()}</div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:0;max-height:58vh;">
      <div style="flex:1;overflow-y:auto;border-right:1px solid rgba(255,255,255,0.06);">
        <div class="ic-section-title" style="position:sticky;top:0;background:#0a0f1e;">🏏 BATTING — ${(batTeam?.name||'').toUpperCase()}</div>
        <table class="ic-table cc-table">
          <thead><tr><th>BATTER</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
          <tbody>${batRows || '<tr><td colspan="6" style="text-align:center;opacity:.4;padding:20px;">No data yet</td></tr>'}</tbody>
        </table>
        <div style="padding:6px 16px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.5);">
          EXTRAS: ${matchData.extras||0} &nbsp;·&nbsp; TOTAL: ${runs}/${wickets} (${Math.floor(balls/6)}.${balls%6})
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;">
        <div class="ic-section-title" style="position:sticky;top:0;background:#0a0f1e;">⚡ BOWLING — ${(bowlTeam?.name||'').toUpperCase()}</div>
        <table class="ic-table cc-table">
          <thead><tr><th>BOWLER</th><th>O</th><th>R</th><th>W</th><th>ECO</th></tr></thead>
          <tbody>${bowlRows || '<tr><td colspan="5" style="text-align:center;opacity:.4;padding:20px;">No data yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

/* ════════════════════════════════════════════════
   MATCH SUMMARY OVERLAY
════════════════════════════════════════════════ */
function renderMatchSummary(matchData, teamsData) {
  const msBody = document.getElementById('ms-body') || document.querySelector('.ms-body');
  if (!msBody) return;

  function buildCol(batTeam, bowlTeam, batStats, bowlStats, runs, wickets, balls, innLabel) {
    const logoHtml = batTeam ? `<div class="ms-inn-logo">${logoEl(batTeam, 56)}</div>` : '';
    const overs = `${Math.floor(balls/6)}.${balls%6}`;
    // Top 4 batsmen by runs
    const batEntries = Object.entries(batStats||{}).sort((a,b)=>b[1].runs-a[1].runs).slice(0,4);
    let batHtml = batEntries.map(([bn,bs]) => {
      const sr = bs.balls > 0 ? ((bs.runs/bs.balls)*100).toFixed(1) : '0.0';
      return `<div class="ms-player-row" style="padding:5px 0;">
        <div style="flex:1;min-width:0;">
          <span class="ms-player-name" style="font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${bn}${!bs.out?'<span class="status">*</span>':''}</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.4);">SR: ${sr} &nbsp;4s: ${bs.fours||0} &nbsp;6s: ${bs.sixes||0}</span>
        </div>
        <span class="ms-player-stat" style="margin-left:8px;"><span class="main" style="font-size:18px;">${bs.runs}</span><span class="balls" style="font-size:12px;"> (${bs.balls})</span></span>
      </div>`;
    }).join('');
    // Top 4 bowlers by wickets then economy
    const bowlEntries = Object.entries(bowlStats||{}).filter(e=>e[1].balls>0).sort((a,b)=>{
      if (b[1].wickets !== a[1].wickets) return b[1].wickets - a[1].wickets;
      const ecoA = a[1].runs/(a[1].balls/6); const ecoB = b[1].runs/(b[1].balls/6);
      return ecoA - ecoB;
    }).slice(0,4);
    let bowlHtml = bowlEntries.map(([bn,bs]) => {
      const eco = bs.balls > 0 ? (bs.runs/(bs.balls/6)).toFixed(1) : '0.0';
      return `<div class="ms-bowl-row" style="padding:5px 0;">
        <div style="flex:1;min-width:0;">
          <span class="ms-bowl-name" style="font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${bn}</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.4);">Eco: ${eco} &nbsp;${Math.floor(bs.balls/6)}.${bs.balls%6} ov</span>
        </div>
        <span class="ms-bowl-fig" style="margin-left:8px;"><span class="w" style="font-size:18px;">${bs.wickets}</span>/<span class="r" style="font-size:14px;">${bs.runs}</span></span>
      </div>`;
    }).join('');
    return `<div class="ms-innings">
      <div class="ms-inn-header">
        ${logoHtml}
        <div><div class="ms-inn-team">${(batTeam?.name||'—').toUpperCase()}</div>
          <div class="ms-inn-label">${innLabel}</div></div>
        <div class="ms-inn-score">
          <div class="runs">${runs}/${wickets}</div>
          <div class="overs">${overs} OV</div>
        </div>
      </div>
      <div style="display:flex;gap:0;">
        <div style="flex:1;border-right:1px solid rgba(255,255,255,0.06);padding-right:12px;">
          <div class="ms-section-label">🏏 ${(batTeam?.name||'BATTING').toUpperCase()}</div>
          ${batHtml || '<div style="font-size:12px;color:rgba(255,255,255,0.3);padding:8px 0;">No data</div>'}
        </div>
        <div style="flex:1;padding-left:12px;">
          <div class="ms-section-label">⚡ ${(bowlTeam?.name||'BOWLING').toUpperCase()}</div>
          ${bowlHtml || '<div style="font-size:12px;color:rgba(255,255,255,0.3);padding:8px 0;">No data</div>'}
        </div>
      </div>
    </div>`;
  }

  const inn1Bat  = teamsData.find(t => t.id === matchData.inning1BatTeamId);
  const inn1Bowl = teamsData.find(t => t.id === matchData.inning1BowlTeamId);
  const inn2Bat  = teamsData.find(t => t.id === matchData.batTeamId);

  // Wave 7.2d — innings labels in the match summary card are now
  // expressed as the over count (e.g. "OVERS 12.4") instead of the
  // legacy "1ST INNINGS / 2ND INNINGS" string. Underlying inning
  // logic (matchData.inning, inning1*, etc.) is untouched — only the
  // presentation layer changes. The label is computed from the same
  // `balls` count that drives the column's score so it always
  // matches the rest of the readout.
  const _ovLabel = (b) => 'OVERS ' + Math.floor((b||0)/6) + '.' + ((b||0)%6);
  let html = '';
  if (matchData.inning1BatTeamId)
    html += buildCol(inn1Bat, inn1Bowl,
      matchData.inning1BatStats, matchData.inning1BowlStats,
      matchData.inning1Runs||0, matchData.inning1Wickets||0, matchData.inning1Balls||0,
      _ovLabel(matchData.inning1Balls));
  if (matchData.inning === 2 || matchData.isFinished)
    html += buildCol(inn2Bat, inn1Bat,
      matchData.batsmanStats, matchData.bowlerStats,
      matchData.runs||0, matchData.wickets||0, matchData.balls||0,
      _ovLabel(matchData.balls));

  msBody.innerHTML = html;

  const resultEl = document.getElementById('ms-result');
  if (resultEl) {
    if (matchData.isFinished && matchData.winner) {
      resultEl.textContent = `${matchData.winner.toUpperCase()} — ${(matchData.winDesc||'').toUpperCase()}`;
      resultEl.className = 'ms-result-banner' +
        (matchData.winner === 'MATCH TIED' ? ' tied' :
         matchData.winner === (inn2Bat?.name||'') ? ' win-bat' : '');
    } else {
      resultEl.textContent = matchData.inning === 2
        ? `${inn2Bat ? inn2Bat.name.toUpperCase() : ''} NEED ${Math.max(0,(matchData.target||0)-(matchData.runs||0))} RUNS`
        : 'MATCH IN PROGRESS';
      resultEl.className = 'ms-result-banner';
    }
  }
}

/* ════════════════════════════════════════════════
   TEAM SHEET OVERLAY
════════════════════════════════════════════════ */
function renderTeamSheet(matchData, teamsData, mode) {
  const card = document.getElementById('team-sheet-card');
  if (!card) return;

  const batTeam  = teamsData.find(t => t.id === matchData.batTeamId);
  const bowlTeam = teamsData.find(t => t.id === matchData.bowlTeamId);

  // Determine which team to show from overlay mode (no interactive tabs in OBS)
  const overallMode = mode || matchData.overlayMode || 'teamsheet_bat';
  const isBowlSide  = overallMode === 'teamsheet_bowl';
  const activeTeam  = isBowlSide ? bowlTeam : batTeam;
  const sideLabel   = isBowlSide ? 'BOWLING SIDE' : 'BATTING SIDE';
  if (!activeTeam) return;

  const rnMap = { BM:'bat', BAT:'bat', B:'bowl', BOWL:'bowl', S:'spin', ALL:'all', WK:'wk', C:'cap', VC:'vcap' };
  const rlMap = { BM:'Batsman', BAT:'Batsman', B:'Bowler', BOWL:'Bowler', S:'Spinner', ALL:'All-Rounder', WK:'Keeper', C:'Captain', VC:'Vice Captain' };
  const players = activeTeam.players || [];

  // Compact rows — small font so all names fit even with 15+ players
  const rows = players.map((p, i) =>
    `<div style="display:grid;grid-template-columns:28px 1fr 72px;align-items:center;padding:7px 14px;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="color:rgba(255,255,255,0.3);font-size:13px;font-weight:700;">${i+1}</span>
      <span style="font-size:15px;font-weight:900;text-transform:uppercase;color:#fff;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name||'—'}</span>
      <span><span class="role-chip ${rnMap[p.role]||''}" style="font-size:11px;padding:2px 7px;">${rlMap[p.role]||p.role||''}</span></span>
    </div>`
  ).join('') || `<div style="padding:16px;text-align:center;opacity:.4;font-size:14px;">No players listed</div>`;

  const batColorVal = getComputedStyle(document.documentElement)
    .getPropertyValue('--bat-color').trim() || '#1e3a8a';
  const accentColor = isBowlSide
    ? (getComputedStyle(document.documentElement).getPropertyValue('--bowl-color').trim() || '#7f1d1d')
    : batColorVal;

  card.innerHTML = `
  <div style="background:rgba(5,8,18,0.97);border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.95),0 0 0 1px rgba(255,255,255,0.08);border-bottom:3px solid ${accentColor};width:100%;">
    <div style="background:linear-gradient(135deg,${accentColor} 0%,rgba(0,0,0,0.6) 100%);padding:12px 16px;display:flex;align-items:center;gap:12px;">
      <div style="width:64px;height:64px;border-radius:8px;border:none;background:transparent;display:flex;align-items:center;justify-content:center;overflow:visible;flex-shrink:0;">${logoEl(activeTeam,56)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:3px;color:#fff;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${activeTeam.name.toUpperCase()}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.55);font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">${sideLabel} — SQUAD</div>
      </div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:rgba(255,255,255,0.2);letter-spacing:2px;">${players.length}</div>
    </div>
    <div style="display:grid;grid-template-columns:28px 1fr 72px;padding:6px 14px;background:rgba(0,0,0,0.5);border-bottom:1px solid rgba(255,255,255,0.07);">
      <span style="font-size:10px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.35);text-transform:uppercase;">#</span>
      <span style="font-size:10px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.35);text-transform:uppercase;">PLAYER</span>
      <span style="font-size:10px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.35);text-transform:uppercase;">ROLE</span>
    </div>
    ${rows}
    <div style="padding:8px 14px;text-align:center;font-size:12px;color:rgba(255,255,255,0.3);letter-spacing:1.5px;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.06);">${players.length} PLAYERS</div>
  </div>`;
}

window.switchTeamSheetTab = function(tab) {
  /* no-op in OBS mode — side is controlled by overlay button in controller */
};

/* ════════════════════════════════════════════════
   Wave 7 — TOSS BANNER GATE OVERLAY (TV side)
   ──────────────────────────────────────────────
   Slides over the bottom broadcast bar reading
   "TEAM A WON THE TOSS · ELECTED TO BAT FIRST".
   Driven by matchData._inningsStarted from the
   controller. Auto-injects its DOM + CSS so all
   Scoreboard*.html templates inherit it without
   per-template edits.
════════════════════════════════════════════════ */
let _tossGate_lastStarted = null;
function _ensureTossGateCss() {
  if (document.getElementById('cc-toss-gate-css')) return;
  const css = document.createElement('style');
  css.id = 'cc-toss-gate-css';
  // Wave 7.2 — match Controller-offline.html: solid 100%-opaque
  // background (no gradient), pt-format chip removed, "MATCH ABOUT
  // TO BEGIN" replaced with a directive prompt, stronger border
  // accent for the stage badge.
  css.textContent =
    '#cc-toss-gate-overlay{' +
      'position:absolute;left:0;right:0;top:0;bottom:0;' +
      'display:flex;align-items:center;justify-content:center;gap:24px;padding:0 32px;' +
      'background:rgba(5,8,18,1);' +
      'z-index:50;font-family:\'Barlow Condensed\',sans-serif;pointer-events:none;' +
      'box-shadow:inset 0 -3px 0 var(--gold,#f59e0b);' +
    '}' +
    '#cc-toss-gate-overlay .ctg-stage{display:inline-flex;align-items:center;padding:6px 14px;' +
      'border:1px solid var(--gold,#f59e0b);background:rgba(245,158,11,0.18);' +
      'color:var(--gold,#f59e0b);font-family:\'Bebas Neue\',sans-serif;font-size:20px;letter-spacing:3px;border-radius:4px;}' +
    '#cc-toss-gate-overlay .ctg-line{font-family:\'Bebas Neue\',sans-serif;font-size:34px;letter-spacing:3px;color:#fff;line-height:1.1;}' +
    '#cc-toss-gate-overlay .ctg-line .ctg-team{color:var(--gold,#f59e0b);}' +
    '#cc-toss-gate-overlay .ctg-line .ctg-elect{color:#fde68a;}' +
    '#cc-toss-gate-overlay .ctg-line .ctg-pending{color:rgba(253,230,138,0.95);font-size:26px;letter-spacing:2px;}' +
    '#cc-toss-gate-overlay .ctg-format{display:none;}' +
    '#cc-toss-gate-overlay .ctg-sep{opacity:.4;color:rgba(255,255,255,0.45);}' +
    /* Wave 7.2 — bar gets .cc-toss-up while gate active so captain
       portraits (.cc-logo-bar-img.is-captain — abs-positioned at 200%
       bar height with object-fit:cover so the head pokes above the bar)
       are hidden. Without this the heads stick out above the toss
       banner. Also hide entire .bb-logo cells in case a SB template
       uses a different inner img class. */
    '.cc-toss-up .cc-logo-bar-img.is-captain{display:none!important;}' +
    '.cc-toss-up .cc-logo-bar-img{opacity:0!important;}' +
    '.cc-toss-up .bb-logo,.cc-toss-up .ss-logo{visibility:hidden!important;}' +
    '@keyframes ccTossSlideOutTv{0%{transform:translateX(0);opacity:1}100%{transform:translateX(-115%);opacity:0}}' +
    '#cc-toss-gate-overlay.ctg-out{animation:ccTossSlideOutTv .6s cubic-bezier(.6,.0,.2,1) forwards;}';
  document.head.appendChild(css);
}
function _ensureTossGateEl(barEl) {
  if (!barEl) return null;
  let el = document.getElementById('cc-toss-gate-overlay');
  if (el) return el;
  _ensureTossGateCss();
  el = document.createElement('div');
  el.id = 'cc-toss-gate-overlay';
  el.style.display = 'none';
  // Position relative to the bar so the overlay covers the score area.
  if (getComputedStyle(barEl).position === 'static') barEl.style.position = 'relative';
  barEl.appendChild(el);
  return el;
}
function _composeTossLineHtml(matchData, teamsData) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  // Wave 7.2 — overs chip dropped, "MATCH ABOUT TO BEGIN" fallback
  // swapped for "TOSS PENDING — UPDATE IN MATCH SETUP" directive so
  // the operator sees what to do next instead of a vague placeholder.
  const tossId = matchData.tossWinner || '';
  const tossT  = tossId
    ? (teamsData || []).find(t => t.id === tossId || t.short_id === tossId)
    : null;
  const tossName = (tossT && tossT.name) || tossId || '';
  const elect = String(matchData.tossElection || '').toLowerCase() === 'bowl' ? 'BOWL' : 'BAT';
  const stage = String(matchData.matchStage || '').trim().toUpperCase();
  const stageHtml = stage ? '<span class="ctg-stage">' + esc(stage) + '</span>' : '';
  const lineHtml  = tossName
    ? '<span class="ctg-line"><span class="ctg-team">' + esc(tossName).toUpperCase() + '</span> WON THE TOSS · ELECTED TO <span class="ctg-elect">' + elect + '</span> FIRST</span>'
    : '<span class="ctg-line"><span class="ctg-pending">TOSS PENDING — UPDATE IN MATCH SETUP</span></span>';
  const bits = [stageHtml, lineHtml].filter(Boolean);
  return bits.join('<span class="ctg-sep">·</span>');
}
function _shouldShowTossGateTv(matchData) {
  if (!matchData || !matchData.batTeamId) return false;
  if (matchData.isFinished) return false;
  if (matchData._inningsStarted === true) return false;
  if ((matchData.inning || 1) !== 1) return false;
  if ((Number(matchData.balls) || 0) > 0) return false;
  return true;
}
function renderTossGateOverlay(matchData, teamsData, barEl) {
  if (!barEl) return;
  const el = _ensureTossGateEl(barEl);
  if (!el) return;
  const showNow = _shouldShowTossGateTv(matchData);
  // Detect the controller flipping _inningsStarted false→true so we can
  // play the slide-out animation instead of just snap-hiding.
  const startedNow = matchData._inningsStarted === true;
  if (showNow) {
    el.classList.remove('ctg-out');
    el.style.display = 'flex';
    el.innerHTML = _composeTossLineHtml(matchData, teamsData);
    // Wave 7.2 — flag bar so captain/logo poppers hide.
    if (barEl) barEl.classList.add('cc-toss-up');
    _tossGate_lastStarted = false;
    return;
  }
  // Not showing — but if we were just up and the controller has now
  // started the innings, run the slide-out animation once.
  if (startedNow && _tossGate_lastStarted === false &&
      el.style.display !== 'none') {
    el.classList.add('ctg-out');
    setTimeout(() => {
      el.classList.remove('ctg-out');
      el.style.display = 'none';
      if (barEl) barEl.classList.remove('cc-toss-up');
    }, 640);
    _tossGate_lastStarted = true;
    return;
  }
  el.style.display = 'none';
  if (barEl) barEl.classList.remove('cc-toss-up');
  _tossGate_lastStarted = startedNow;
}

/* ════════════════════════════════════════════════
   PRE-MATCH CARD (D3 — B-NOPRE)
   ──────────────────────────────────────────────
   Shows toss outcome, election, match stage, max
   overs, and the two teams. Auto-injects its own
   DOM the first time it's needed so we don't have
   to edit all 20 Scoreboard*.html templates.
════════════════════════════════════════════════ */
function ensurePreMatchCard() {
  let card = document.getElementById('pre-match-card');
  if (card) return card;
  card = document.createElement('div');
  card.id = 'pre-match-card';
  card.className = 'pre-match-card';
  card.style.cssText =
    'display:none;position:absolute;top:50%;left:50%;' +
    'transform:translate(-50%,-50%);max-width:calc(100vw - 80px);' +
    'z-index:20;width:920px;background:rgba(5,8,18,0.97);' +
    'border-radius:14px;overflow:hidden;' +
    'box-shadow:0 30px 80px rgba(0,0,0,0.95),0 0 0 1px rgba(255,255,255,0.08);' +
    'border-bottom:4px solid var(--gold,#f59e0b);';
  const wrap = document.getElementById('master-wrap');
  if (wrap) wrap.appendChild(card);
  else document.body.appendChild(card);
  return card;
}

/* ─────────────────────────────────────────────────
   Wave 7 — FIXTURES OVERLAY (was: PRE-MATCH card)
   Tournament-scoped list of upcoming + on-going +
   recently-completed matches. Auto-fits to the
   viewport (font + padding scale down as row count
   grows). Highlights the row matching the active
   match with a pulsing accent + ON-GOING tag.
   Cached for 30 s so opening the overlay repeatedly
   doesn't hammer the API.
   ───────────────────────────────────────────────── */
let _fixtures_cache = { ts: 0, key: '', data: null };

function _ccEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _fixturesShouldShow(m, nowMs) {
  // live → always include
  if (m.status === 'live') return true;
  // completed → include if within last 24h
  if (m.status === 'completed' || m.status === 'finished') {
    const ts = m.finished_at ? Date.parse(m.finished_at) : (m.created_at ? Date.parse(m.created_at) : 0);
    if (!ts) return true; // unknown date — keep, list is small anyway
    return (nowMs - ts) <= (24 * 3600 * 1000);
  }
  // scheduled / ready → include if within next 48h. If no scheduled
  // date is set, still include — small tournaments often run
  // back-to-back without explicit scheduling.
  if (m.scheduled_date) {
    const ts = Date.parse(m.scheduled_date + 'T' + (m.scheduled_time || '23:59:59'));
    if (!isFinite(ts)) return true;
    return ts >= (nowMs - 30 * 60 * 1000) &&  // 30-min grace for in-flight
           ts <= (nowMs + 48 * 3600 * 1000);
  }
  return true;
}

function _fixturesStatusTag(m, currentMatchId, nextScheduledId) {
  if (m.id === currentMatchId)            return { label: 'ON-GOING', cls: 'fx-tag-live' };
  if (m.status === 'live')                return { label: 'ON-GOING', cls: 'fx-tag-live' };
  if (m.status === 'completed' || m.status === 'finished') {
    let winName = '';
    if (m.winner_team_id) {
      if (m.winner_team_id === m.bat_team_id)  winName = m.bat_team_name  || m.bat_team_id;
      else if (m.winner_team_id === m.bowl_team_id) winName = m.bowl_team_name || m.bowl_team_id;
      else winName = m.winner_team_id;
    }
    return winName
      ? { label: 'WON BY ' + String(winName).toUpperCase(), cls: 'fx-tag-won' }
      : { label: 'COMPLETED', cls: 'fx-tag-won' };
  }
  if (m.id === nextScheduledId)           return { label: 'NEXT', cls: 'fx-tag-next' };
  return { label: 'UPCOMING', cls: 'fx-tag-up' };
}

function _fixturesEnsureCss() {
  if (document.getElementById('cc-fixtures-css')) return;
  const css = document.createElement('style');
  css.id = 'cc-fixtures-css';
  css.textContent =
    '#pre-match-card .fx-head{padding:14px 24px;background:linear-gradient(135deg,rgba(30,64,175,0.55) 0%,rgba(0,0,0,0.4) 100%);' +
      'border-bottom:2px solid var(--gold,#f59e0b);text-align:center;}' +
    '#pre-match-card .fx-title{font-family:\'Bebas Neue\',sans-serif;font-size:38px;letter-spacing:5px;color:var(--gold,#f59e0b);line-height:1;}' +
    '#pre-match-card .fx-sub{font-size:13px;color:rgba(255,255,255,0.65);font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-top:6px;}' +
    '#pre-match-card .fx-list{display:flex;flex-direction:column;}' +
    '#pre-match-card .fx-row{display:grid;grid-template-columns:90px 1fr 150px;gap:14px;align-items:center;' +
      'padding:12px 22px;border-bottom:1px solid rgba(255,255,255,0.06);}' +
    '#pre-match-card .fx-row:last-child{border-bottom:none;}' +
    '#pre-match-card .fx-row.fx-current{background:linear-gradient(90deg,rgba(245,158,11,0.18) 0%,rgba(245,158,11,0.04) 100%);' +
      'box-shadow:inset 4px 0 0 var(--gold,#f59e0b);}' +
    '#pre-match-card .fx-row.fx-current .fx-when{color:var(--gold,#f59e0b);}' +
    '#pre-match-card .fx-when{font-family:\'Bebas Neue\',sans-serif;font-size:18px;letter-spacing:1.5px;color:rgba(255,255,255,0.55);}' +
    '#pre-match-card .fx-when .fx-d{display:block;font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.4);margin-top:2px;}' +
    '#pre-match-card .fx-mu{font-family:\'Bebas Neue\',sans-serif;font-size:22px;letter-spacing:1.5px;color:#fff;line-height:1.1;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '#pre-match-card .fx-mu .fx-vs{color:rgba(255,255,255,0.4);margin:0 8px;font-size:16px;}' +
    '#pre-match-card .fx-stage{font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-top:3px;font-weight:700;}' +
    '#pre-match-card .fx-stage .fx-score{color:#fde68a;}' +
    '#pre-match-card .fx-tag{justify-self:end;font-family:\'Bebas Neue\',sans-serif;font-size:14px;letter-spacing:2.5px;' +
      'padding:5px 11px;border-radius:4px;border:1px solid rgba(255,255,255,0.12);text-transform:uppercase;text-align:center;}' +
    '#pre-match-card .fx-tag-live{color:#fff;background:#dc2626;border-color:#dc2626;' +
      'animation:ccFxLivePulse 1.4s infinite;}' +
    '#pre-match-card .fx-tag-next{color:var(--gold,#f59e0b);background:rgba(245,158,11,0.15);border-color:var(--gold,#f59e0b);}' +
    '#pre-match-card .fx-tag-up{color:rgba(255,255,255,0.65);background:rgba(255,255,255,0.04);}' +
    '#pre-match-card .fx-tag-won{color:#86efac;background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.45);}' +
    '@keyframes ccFxLivePulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.6);}50%{box-shadow:0 0 0 6px rgba(220,38,38,0);}}' +
    '#pre-match-card .fx-empty{padding:60px 30px;text-align:center;color:rgba(255,255,255,0.55);font-size:16px;letter-spacing:2px;}' +
    '/* Auto-fit density tiers — applied via JS based on row count */' +
    '#pre-match-card.fx-dense .fx-row{padding:8px 22px;}' +
    '#pre-match-card.fx-dense .fx-mu{font-size:19px;}' +
    '#pre-match-card.fx-dense .fx-when{font-size:16px;}' +
    '#pre-match-card.fx-ultra .fx-row{padding:6px 18px;}' +
    '#pre-match-card.fx-ultra .fx-mu{font-size:17px;}' +
    '#pre-match-card.fx-ultra .fx-when{font-size:14px;}' +
    '#pre-match-card.fx-ultra .fx-tag{font-size:12px;padding:3px 8px;}';
  document.head.appendChild(css);
}

async function _fixturesFetch(tournamentId) {
  const cacheKey = String(tournamentId || 'all');
  const now = Date.now();
  if (_fixtures_cache.key === cacheKey && (now - _fixtures_cache.ts) < 30000 && _fixtures_cache.data) {
    return _fixtures_cache.data;
  }
  try {
    const url = '/api/club/matches' + (tournamentId ? '?tournamentId=' + encodeURIComponent(tournamentId) + '&limit=50' : '?limit=30');
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    const rows = (data && data.matches) || [];
    _fixtures_cache = { ts: now, key: cacheKey, data: rows };
    return rows;
  } catch (e) {
    console.warn('[CricCast] Fixtures fetch failed:', e.message);
    return [];
  }
}

function _fixturesRender(card, rows, currentMatchId, tournamentName) {
  _fixturesEnsureCss();
  const nowMs = Date.now();
  // If the caller didn't supply a tournament name, lift it from the
  // first matching row so the FIXTURES header reads e.g.
  // "PREMIER LEAGUE 2025 · NEXT 48 H" instead of "ALL MATCHES".
  if (!tournamentName) {
    const named = rows.find(r => r.tournament_name);
    if (named) tournamentName = named.tournament_name;
  }
  const filtered = rows.filter(m => _fixturesShouldShow(m, nowMs));

  // Order: live first → ready/scheduled (next earliest first) → completed (most recent first)
  filtered.sort((a, b) => {
    const rank = (m) => {
      if (m.status === 'live') return 0;
      if (m.status === 'ready' || m.status === 'scheduled' || m.status === 'setup') return 1;
      return 2;
    };
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    const da = a.scheduled_date ? Date.parse(a.scheduled_date + 'T' + (a.scheduled_time || '00:00:00')) : 0;
    const db = b.scheduled_date ? Date.parse(b.scheduled_date + 'T' + (b.scheduled_time || '00:00:00')) : 0;
    if (ra === 2) return db - da; // completed: newest first
    return da - db;               // upcoming: earliest first
  });

  const top = filtered.slice(0, 10);

  // Determine the FIRST upcoming non-current match for the NEXT tag.
  let nextScheduledId = null;
  for (const m of top) {
    if (m.status === 'live') continue;
    if (m.status === 'completed' || m.status === 'finished') continue;
    if (m.id === currentMatchId) continue;
    nextScheduledId = m.id;
    break;
  }

  // Auto-fit density: 5 or fewer = comfy, 6-7 = dense, 8+ = ultra.
  card.classList.remove('fx-dense', 'fx-ultra');
  if (top.length >= 8) card.classList.add('fx-ultra');
  else if (top.length >= 6) card.classList.add('fx-dense');

  const head =
    '<div class="fx-head">' +
      '<div class="fx-title">📅 FIXTURES</div>' +
      '<div class="fx-sub">' + (tournamentName ? _ccEsc(tournamentName).toUpperCase() : 'ALL MATCHES') +
        ' · NEXT 48 H · ' + top.length + ' MATCH' + (top.length === 1 ? '' : 'ES') +
      '</div>' +
    '</div>';

  if (!top.length) {
    card.innerHTML = head + '<div class="fx-empty">NO FIXTURES IN THE NEXT 48 HOURS</div>';
    return;
  }

  const fmtTime = (m) => {
    if (m.status === 'live') return '<span style="color:#fca5a5;">LIVE</span>';
    if (!m.scheduled_date)   return '—';
    const d = new Date(m.scheduled_date + 'T' + (m.scheduled_time || '00:00:00'));
    if (isNaN(d.getTime())) return '—';
    const today = new Date(); today.setHours(0,0,0,0);
    const tom   = new Date(today.getTime() + 24*3600*1000);
    const dayLbl = d.toDateString() === today.toDateString() ? 'TODAY'
                 : d.toDateString() === tom.toDateString()   ? 'TMRW'
                 : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }).toUpperCase();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return (m.scheduled_time ? hh + ':' + mm : '—') + '<span class="fx-d">' + dayLbl + '</span>';
  };

  const fmtScoreLine = (m) => {
    if (!m.liveScore) return '';
    const ls = m.liveScore;
    return '<span class="fx-score">' + ls.runs + '/' + ls.wickets + ' · ' + ls.overs + ' OV</span>';
  };

  const list = top.map(m => {
    const isCur  = m.id === currentMatchId;
    const tag    = _fixturesStatusTag(m, currentMatchId, nextScheduledId);
    const stage  = m.stage && m.stage !== 'custom' && m.stage !== 'group'
      ? String(m.stage).replace(/_/g,' ').toUpperCase()
      : (m.stage === 'group' ? 'GROUP STAGE' : '');
    const liveScore = (m.status === 'live') ? fmtScoreLine(m) : '';
    const stageLine = [stage, liveScore].filter(Boolean).join(' · ');
    return '<div class="fx-row' + (isCur ? ' fx-current' : '') + '">' +
      '<div class="fx-when">' + fmtTime(m) + '</div>' +
      '<div>' +
        '<div class="fx-mu">' +
          _ccEsc(m.bat_team_name || m.bat_team_id) +
          '<span class="fx-vs">vs</span>' +
          _ccEsc(m.bowl_team_name || m.bowl_team_id) +
        '</div>' +
        (stageLine ? '<div class="fx-stage">' + stageLine + '</div>' : '') +
      '</div>' +
      '<div class="fx-tag ' + tag.cls + '">' + _ccEsc(tag.label) + '</div>' +
    '</div>';
  }).join('');

  card.innerHTML = head + '<div class="fx-list">' + list + '</div>';
}

function renderPreMatchCard(matchData, teamsData) {
  const card = ensurePreMatchCard();
  if (!card) return;
  const tournamentId   = matchData.tournamentId   || null;
  const tournamentName = matchData.tournamentName || '';
  const currentMatchId = matchData.matchId        || null;

  // Render synchronously with whatever is cached so the overlay opens
  // instantly. Then refresh from the API and re-render once data lands.
  if (_fixtures_cache.data && _fixtures_cache.key === String(tournamentId || 'all')) {
    _fixturesRender(card, _fixtures_cache.data, currentMatchId, tournamentName);
  } else {
    _fixturesEnsureCss();
    card.innerHTML =
      '<div class="fx-head">' +
        '<div class="fx-title">📅 FIXTURES</div>' +
        '<div class="fx-sub">LOADING…</div>' +
      '</div>' +
      '<div class="fx-empty">FETCHING MATCHES…</div>';
  }

  _fixturesFetch(tournamentId).then(rows => {
    // Bail if the overlay was closed before the fetch resolved.
    if (card.style.display === 'none') return;
    _fixturesRender(card, rows, currentMatchId, tournamentName);
  });
}
window.renderPreMatchCard = renderPreMatchCard;

/* ════════════════════════════════════════════════
   MATCH-STATE BADGES (D4 — B-NOFREEHIT-OVERLAY,
                            B-NOPP-OVERLAY)
   ──────────────────────────────────────────────
   Lights up FREE HIT and POWERPLAY chips above
   the broadcast bar. Lazy DOM-injected so we
   don't have to edit 20 templates.
════════════════════════════════════════════════ */
function ensureMatchBadgesHost() {
  let host = document.getElementById('cc-match-badges');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'cc-match-badges';
  host.style.cssText =
    'position:absolute;left:50%;bottom:118px;transform:translateX(-50%);' +
    'display:flex;gap:10px;z-index:50;pointer-events:none;' +
    'transition:opacity 0.32s ease,transform 0.32s ease;';
  const wrap = document.getElementById('master-wrap');
  if (wrap) wrap.appendChild(host);
  else document.body.appendChild(host);
  return host;
}

function paintMatchBadges(matchData, overlayActive) {
  const host = ensureMatchBadgesHost();
  if (!host || !matchData) return;
  const fh       = !!matchData._freeHitPending;
  const ppActive = !!matchData.powerplayActive;
  const ppLabel  = String(matchData.powerplayLabel || 'PP').toUpperCase()
                     .replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const items = [];
  if (fh) {
    items.push(
      '<div style="padding:5px 14px;border-radius:5px;' +
      'background:linear-gradient(90deg,#facc15,#f59e0b);color:#1a1a1a;' +
      "font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:3px;font-weight:900;" +
      'box-shadow:0 4px 14px rgba(245,158,11,0.5);">⚡ FREE HIT ⚡</div>'
    );
  }
  if (ppActive) {
    items.push(
      '<div style="padding:5px 14px;border-radius:5px;' +
      'background:linear-gradient(90deg,#10b981,#06b6d4);color:#fff;' +
      "font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:3px;font-weight:900;" +
      'box-shadow:0 4px 14px rgba(16,185,129,0.45);">' + ppLabel + '</div>'
    );
  }
  host.innerHTML = items.join('');
  if (!items.length || overlayActive || matchData.isFinished) {
    host.style.opacity = '0';
    host.style.transform = 'translateX(-50%) translateY(8px)';
  } else {
    host.style.opacity = '1';
    host.style.transform = 'translateX(-50%) translateY(0)';
  }
}
window.paintMatchBadges = paintMatchBadges;

/* ════════════════════════════════════════════════════════════════
   OVERLAY OPEN ANIMATOR — v12
   ──────────────────────────────────────────────────────────────
   Called whenever an overlay card or the main broadcast bar
   becomes visible.  Uses GSAP if available, is a no-op otherwise.

   Mode → animation mapping:
     live           OVERLAY    bar slides up from below; sections stagger in
     inning1        INN 1      card wipes in from the LEFT  (clip-path)
     inning2        INN 2      card wipes in from the RIGHT (clip-path)
     summary        SUMMARY    card elastic scale-in from center
     teamsheet_bat  BAT SQUAD  card drops from above; rows cascade right→left
     teamsheet_bowl BOWL SQUAD card rises from below; rows cascade left→right
     teamsheet      BAT SQUAD  same as teamsheet_bat
     pre_match      PRE-MATCH  card scales in elastic from center
════════════════════════════════════════════════════════════════ */
var _oa_prevMode     = null;   /* last mode that was shown          */
var _oa_barAnimated  = false;  /* broadcast bar only animates once  */

function overlayEnter(mode, cardEl, barEl) {
  if (typeof gsap === 'undefined') return;  /* degrade silently */

  /* ── OVERLAY: main broadcast bar ─────────────────────────── */
  if (mode === 'live') {
    if (!_oa_barAnimated && barEl) {
      _oa_barAnimated = true;
      /* Bar rises from below with a small overshoot */
      gsap.fromTo(barEl,
        { y: 110, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.72, ease: 'back.out(1.35)',
          clearProps: 'transform,opacity' });
      /* Internal sections stagger in */
      const sels = '.bb-logo,.bb-batting,.bb-score,.bb-bowling-wrap,' +
                   '.bb-batting-ui,.bb-score-ui,.bb-bowling-ui,' +
                   '.score-block,.players-block,.logo-block,' +
                   '.right-block,.over-block,.tgt-block';
      const parts = barEl.querySelectorAll(sels);
      if (parts.length)
        gsap.fromTo(parts,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.38, stagger: 0.07,
            ease: 'power2.out', delay: 0.38, clearProps: 'transform,opacity' });
    } else if (barEl && _oa_prevMode && _oa_prevMode !== 'live') {
      /* Returning from a card overlay: gentle pop-in */
      gsap.fromTo(barEl,
        { opacity: 0.55, scale: 0.97 },
        { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out',
          clearProps: 'transform,opacity' });
    }
    return;
  }

  if (!cardEl) return;
  cardEl.style.animation = 'none';  /* disable legacy CSS @keyframe */

  /* Helper: stagger child rows after card lands */
  function staggerRows(sel, xFrom, delay) {
    setTimeout(function () {
      var rows = cardEl.querySelectorAll(sel);
      if (rows.length)
        gsap.fromTo(rows,
          { opacity: 0, x: xFrom },
          { opacity: 1, x: 0, duration: 0.28, stagger: 0.038,
            ease: 'power2.out', clearProps: 'transform,opacity' });
    }, delay);
  }

  /* ── INN 1: drop from top + clip-path wipe from LEFT ────────── */
  if (mode === 'inning1') {
    gsap.set(cardEl, { opacity: 1, x: 0, scale: 1 });
    gsap.fromTo(cardEl,
      { y: -80, clipPath: 'inset(0 100% 0 0 round 14px)' },
      { y:   0, clipPath: 'inset(0 0% 0 0 round 14px)',
        duration: 0.58, ease: 'power3.inOut',
        onComplete: function () { cardEl.style.clipPath = ''; } });
    staggerRows('tr, .ic-section-title', -18, 420);
    setTimeout(function () {
      var foot = cardEl.querySelector('[style*="justify-content:space-between"]');
      if (foot) gsap.fromTo(foot, { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out', clearProps: 'transform,opacity' });
    }, 540);
  }

  /* ── INN 2: drop from top + clip-path wipe from RIGHT ────────── */
  else if (mode === 'inning2') {
    gsap.set(cardEl, { opacity: 1, x: 0, scale: 1 });
    gsap.fromTo(cardEl,
      { y: -80, clipPath: 'inset(0 0 0 100% round 14px)' },
      { y:   0, clipPath: 'inset(0 0 0 0% round 14px)',
        duration: 0.58, ease: 'power3.inOut',
        onComplete: function () { cardEl.style.clipPath = ''; } });
    staggerRows('tr, .ic-section-title', 18, 420);
    setTimeout(function () {
      var foot = cardEl.querySelector('[style*="justify-content:space-between"]');
      if (foot) gsap.fromTo(foot, { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out', clearProps: 'transform,opacity' });
    }, 540);
  }

  /* ── SUMMARY: drop from top + elastic scale-in ───────────────── */
  else if (mode === 'summary') {
    gsap.fromTo(cardEl,
      { scale: 0.88, opacity: 0, y: -70 },
      { scale: 1,    opacity: 1, y:   0,
        duration: 0.65, ease: 'back.out(2.0)', clearProps: 'transform,opacity' });
    var tl     = gsap.timeline({ delay: 0.27 });
    var header = cardEl.querySelector('.ms-header');
    var cols   = cardEl.querySelectorAll('.ms-innings');
    var banner = cardEl.querySelector('.ms-result-banner');
    if (header)       tl.fromTo(header, { y: -24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.38, ease: 'power2.out', clearProps: 'transform,opacity' }, 0);
    if (cols.length)  tl.fromTo(cols,   { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.44, stagger: 0.13, ease: 'power2.out', clearProps: 'transform,opacity' }, 0.07);
    if (banner)       tl.fromTo(banner, { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5,  ease: 'back.out(1.7)', clearProps: 'transform,opacity' }, 0.36);
  }

  /* ── BAT SQUAD: drop from above, rows cascade right→left ─── */
  else if (mode === 'teamsheet_bat' || mode === 'teamsheet') {
    gsap.fromTo(cardEl,
      { y: -72, opacity: 0, scale: 0.95 },
      { y:   0, opacity: 1, scale: 1,
        duration: 0.58, ease: 'back.out(1.8)', clearProps: 'transform,opacity' });
    staggerRows('.ts-player-row, [style*="grid-template-columns"]', 48, 310);
  }

  /* ── BOWL SQUAD: also drop from above, rows cascade left→right ── */
  else if (mode === 'teamsheet_bowl') {
    gsap.fromTo(cardEl,
      { y: -72, opacity: 0, scale: 0.95 },
      { y:   0, opacity: 1, scale: 1,
        duration: 0.58, ease: 'back.out(1.8)', clearProps: 'transform,opacity' });
    staggerRows('.ts-player-row, [style*="grid-template-columns"]', -48, 310);
  }

  /* ── PRE-MATCH: elastic scale-in from center (D3 — B-NOPRE) ── */
  else if (mode === 'pre_match') {
    gsap.fromTo(cardEl,
      { scale: 0.88, opacity: 0, y: -40 },
      { scale: 1,    opacity: 1, y: 0,
        duration: 0.6, ease: 'back.out(1.9)', clearProps: 'transform,opacity' });
  }
}

/* ════════════════════════════════════════════════
   PROCESS INCOMING STATE
════════════════════════════════════════════════ */
function processState(data) {
  if (!data) return;

  const matchData = data.match;
  const teamsData = data.teams || [];

  const wrap = document.getElementById('master-wrap');
  const bar  = document.getElementById('master-broadcast-bar');

  if (!matchData || !matchData.batTeamId) {
    if (wrap) wrap.style.display = 'none';
    if (bar)  bar.style.display  = 'none';
    return;
  }

  window._lastMatchData = matchData;
  window._lastTeamsData = teamsData;

  if (wrap) wrap.style.display = '';
  applyColorVars(matchData, teamsData);

  const mode          = matchData.overlayMode || 'live';
  const prevMode      = _oa_prevMode;
  const _overlayActive = mode !== 'live';

  /* ── Toggle overlay-active class for full-screen centering backdrop ── */
  if (wrap) {
    if (_overlayActive) wrap.classList.add('overlay-active');
    else wrap.classList.remove('overlay-active');
  }

  /* ── Hide/show bottom bar based on overlay mode ── */
  if (bar) {
    bar.style.transition = 'opacity 0.38s ease, transform 0.38s ease';
    if (_overlayActive) {
      bar.style.opacity = '0';
      bar.style.transform = 'translateY(24px)';
      bar.style.pointerEvents = 'none';
    } else {
      bar.style.display = '';
      bar.style.opacity = '1';
      bar.style.transform = 'translateY(0)';
      bar.style.pointerEvents = '';
    }
  }

  // D11 (B-BOWLER-NAME-FORMAT): swap legal `name` for `display_name`
  // (when set) on the live bar fields. Only mutates the local copy
  // for this render — the controller's source of truth is unchanged.
  (function _applyDisplayNames() {
    if (!Array.isArray(teamsData) || !teamsData.length) return;
    function _disp(teamId, plainName) {
      if (!plainName) return plainName;
      const team = teamsData.find(t => t.id === teamId);
      if (!team || !Array.isArray(team.players)) return plainName;
      const p = team.players.find(pp => pp.name === plainName);
      return (p && p.display_name) ? p.display_name : plainName;
    }
    if (matchData.bowler && matchData.bowlTeamId)
      matchData.bowler = _disp(matchData.bowlTeamId, matchData.bowler);
    if (matchData.p1 && matchData.p1.name && matchData.batTeamId)
      matchData.p1.name = _disp(matchData.batTeamId, matchData.p1.name);
    if (matchData.p2 && matchData.p2.name && matchData.batTeamId)
      matchData.p2.name = _disp(matchData.batTeamId, matchData.p2.name);
  })();

  if (typeof window.renderBroadcastBar === 'function')
    window.renderBroadcastBar(matchData, teamsData);

  // Shared winner-state fix: hide losing team logo/captain on match end.
  // Individual templates may not handle this, so enforce it centrally.
  applyWinnerLogoState(matchData, teamsData);

  // D4: paint FREE HIT / POWERPLAY badges above the bar.
  paintMatchBadges(matchData, _overlayActive);

  // Wave 7 — toss banner gate. Mirrors the controller. When
  // _inningsStarted is false on innings 1 ball 0, a banner overlays
  // the bar reading "TEAM A WON THE TOSS · ELECTED TO BAT FIRST".
  // When the controller flips _inningsStarted=true, we slide the
  // banner left + fade so TV viewers see the same transition.
  renderTossGateOverlay(matchData, teamsData, bar);

  const inningsCard   = document.getElementById('innings-card');
  const summaryCard   = document.getElementById('match-summary-card');
  const teamSheetCard = document.getElementById('team-sheet-card');
  // D3: pre-match card is auto-injected on demand (no template edit needed).
  const preMatchCard  = document.getElementById('pre-match-card');

  /* ── Exit animation helper ── */
  function exitCard(el, dir, onDone) {
    if (!el || el.style.display === 'none') { if(onDone) onDone(); return; }
    if (typeof gsap !== 'undefined') {
      gsap.to(el, {
        opacity: 0,
        y: dir === 'up' ? -55 : 55,
        scale: 0.92,
        duration: 0.30,
        ease: 'power2.in',
        onComplete: function() { el.style.display='none'; el.style.opacity=''; el.style.transform=''; if(onDone) onDone(); }
      });
    } else {
      el.style.display = 'none';
      if (onDone) onDone();
    }
  }

  /* ── Determine which card was active and should exit ── */
  const _prevInnings   = prevMode==='inning1'||prevMode==='inning2';
  const _prevSummary   = prevMode==='summary';
  const _prevTeamsheet = prevMode==='teamsheet_bat'||prevMode==='teamsheet_bowl'||prevMode==='teamsheet';

  /* ── Hide cards that are no longer active (with exit anim if changing) ── */
  if (mode !== 'inning1' && mode !== 'inning2')
    exitCard(inningsCard, prevMode==='inning1'?'up':'down');
  if (mode !== 'summary')
    exitCard(summaryCard, 'up');
  if (mode !== 'teamsheet_bat' && mode !== 'teamsheet_bowl' && mode !== 'teamsheet')
    exitCard(teamSheetCard, 'down');
  // D3: hide pre-match card if leaving the mode.
  if (mode !== 'pre_match')
    exitCard(preMatchCard, 'up');

  /* ── Show the active card ── */
  if (mode === 'inning1' || mode === 'inning2') {
    if (inningsCard) {
      inningsCard.style.display = 'block';
      inningsCard.style.opacity = '';
      renderInningsCard(matchData, teamsData);
      if (prevMode !== mode) overlayEnter(mode, inningsCard, null);
    }
  } else if (mode === 'summary') {
    if (summaryCard) {
      summaryCard.style.display = 'block';
      summaryCard.style.opacity = '';
      renderMatchSummary(matchData, teamsData);
      if (prevMode !== mode) overlayEnter(mode, summaryCard, null);
    }
  } else if (mode === 'teamsheet_bat' || mode === 'teamsheet_bowl' || mode === 'teamsheet') {
    if (teamSheetCard) {
      teamSheetCard.style.display = 'block';
      teamSheetCard.style.opacity = '';
      renderTeamSheet(matchData, teamsData, mode);
      if (prevMode !== mode) overlayEnter(mode, teamSheetCard, null);
    }
  } else if (mode === 'pre_match') {
    // D3: render & show pre-match card; ensures DOM exists (lazy create).
    const card = ensurePreMatchCard();
    if (card) {
      card.style.display = 'block';
      card.style.opacity = '';
      renderPreMatchCard(matchData, teamsData);
      if (prevMode !== mode) overlayEnter(mode, card, null);
    }
  } else {
    /* mode === 'live' — animate broadcast bar back in */
    overlayEnter('live', null, bar);
  }

  _oa_prevMode = mode;
}

/* ════════════════════════════════════════════════
   OVERS FORMATTER HELPER
════════════════════════════════════════════════ */
function fmtOvers(balls) {
  return `${Math.floor(balls/6)}.${balls%6}`;
}
window.fmtOvers = fmtOvers;

/* ════════════════════════════════════════════════════════════════
   CONNECTION ENGINE v6 — Server-Sent Events (SSE) + poll fallback
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Primary path:
     EventSource → /api/events
       • Server pushes instantly when controller POSTs new state
       • No polling, no delay, sub-100 ms latency
       • Automatic reconnect built into EventSource spec

   Fallback path (when SSE is unavailable — OBS browser source
   with broken keep-alive, very old proxy, etc.):
     fetch → /api/state   every POLL_INTERVAL ms
       • Activates only when SSE has not produced a message for
         POLL_INTERVAL × 2  ms, or on explicit SSE error
       • Deactivates automatically when SSE recovers

   processState() is ALWAYS called outside any network try/catch
   so render errors never look like connection failures.
════════════════════════════════════════════════════════════════ */
function initCore() {
  let _lastTs      = -1;   /* last seen state timestamp — skips unchanged frames */
  let _sseAlive    = false;
  let _sseRetries  = 0;
  let _pollTimer   = null;
  let _consecutivePollErrors = 0;
  let _sse         = null;

  /* ── Apply state if it is newer than what we last rendered ── */
  function applyState(data) {
    if (!data) return;
    /* Use ts field for change detection; fall back to JSON comparison */
    const incoming = (typeof data.ts === 'number') ? data.ts : -1;
    if (incoming !== -1 && incoming === _lastTs) return;  /* no change */
    _lastTs = incoming;
    processState(data);   /* render errors propagate to console, not caught here */
  }

  /* ── Fallback poll: runs only when SSE is down ── */
  function startFallbackPoll() {
    if (_pollTimer) return;
    console.warn('[CricCast] SSE unavailable — switching to poll fallback (' + POLL_INTERVAL + 'ms)');
    _pollTimer = setInterval(async () => { if (_consecutivePollErrors > 5) { clearInterval(_pollTimer); _pollTimer = null; setTimeout(startPoll, 60000); return; }
      if (_sseAlive) {
        /* SSE recovered — stop polling */
        clearInterval(_pollTimer);
        _pollTimer = null;
        _consecutivePollErrors = 0; console.log('[CricCast] SSE recovered — stopping poll fallback');
        return;
      }
      try {
        const res = await fetch(STATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        applyState(data);
      } catch (e) {
        _consecutivePollErrors++; console.warn('[CricCast] Poll fallback error:', e.message);
      }
    }, POLL_INTERVAL);
  }

  /* ── SSE connection ── */
  function connectSSE() {
    if (_sse) { try { _sse.close(); } catch {} _sse = null; }
    _sseAlive = false;

    try {
      _sse = new EventSource(SSE_URL);
    } catch (e) {
      /* Browser (e.g. very old OBS) doesn't support EventSource — go straight to poll */
      console.warn('[CricCast] EventSource not supported:', e.message);
      startFallbackPoll();
      return;
    }

    _sse.onopen = () => {
      _sseAlive   = true;
      _sseRetries = 0;
      console.log('[CricCast] SSE connected — real-time updates active');
    };

    _sse.onmessage = (e) => {
      _sseAlive = true;  /* confirm SSE is delivering */
      if (!e.data || e.data.startsWith(':')) return;  /* ignore keep-alive comments */
      try {
        const data = JSON.parse(e.data);
        applyState(data);
      } catch (err) {
        console.warn('[CricCast] SSE message parse error:', err.message);
      }
    };

    /* ── Named SSE event: "broadcast" → fire animation on this scoreboard ── */
    _sse.addEventListener('broadcast', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d && d.type && window.BroadcastEvents) {
          window.BroadcastEvents.trigger(d.type, d.options || {});
        }
      } catch (err) {
        console.warn('[CricCast] Broadcast event parse error:', err.message);
      }
    });

    /* ── L4 — Named SSE events: lifecycle + deletion ─────────────────
       The server emits:
         event: match:lifecycle   { matchId, from, to, at }
         event: match:deleted     { matchId, at }
       On `to == 'completed'` for the current match, we fade out and
       auto-close the scoreboard window (scorer is done). On `deleted`
       for the current match, we show a friendly message and stop
       rendering to prevent confusing stale state. */
    function _isOurMatch(m) {
      const ours = window.CRICCAST_MATCH_ID
        || (window.CRICCAST_BOOT && window.CRICCAST_BOOT.matchId);
      return ours && m && m.matchId && m.matchId === ours;
    }
    function _showEndOverlay(title, sub) {
      let el = document.getElementById('cc-end-overlay');
      if (!el) {
        el = document.createElement('div');
        el.id = 'cc-end-overlay';
        el.style.cssText =
          'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;'
          + 'align-items:center;justify-content:center;background:rgba(0,0,0,0.75);'
          + "color:#fff;font-family:'Bebas Neue',system-ui,sans-serif;text-align:center;"
          + 'transition:opacity .4s;';
        el.innerHTML = `
          <div style="font-size:48px;letter-spacing:4px;color:#fbbf24;margin-bottom:12px;">${title}</div>
          <div style="font-size:18px;letter-spacing:2px;opacity:0.8;">${sub}</div>`;
        document.body.appendChild(el);
      }
    }
    _sse.addEventListener('match:lifecycle', (e) => {
      try {
        const d = JSON.parse(e.data || '{}');
        if (!_isOurMatch(d)) return;
        if (d.to === 'completed' || d.to === 'finished') {
          _showEndOverlay('MATCH COMPLETE', 'This scoreboard will close shortly.');
          // Graceful auto-close — only works for windows opened by script.
          // OBS browser sources just keep showing the overlay (which is fine).
          setTimeout(() => { try { window.close(); } catch {} }, 8000);
        }
      } catch (err) {
        console.warn('[CricCast] lifecycle parse error:', err.message);
      }
    });
    _sse.addEventListener('match:deleted', (e) => {
      try {
        const d = JSON.parse(e.data || '{}');
        if (!_isOurMatch(d)) return;
        _showEndOverlay('MATCH REMOVED',
          'This match was deleted from the Dashboard.');
      } catch (err) {
        console.warn('[CricCast] deleted parse error:', err.message);
      }
    });

    _sse.onerror = () => {
      _sseAlive = false;
      _sseRetries++;
      /* EventSource auto-reconnects per spec but we add our own backoff
         for the poll fallback so the scoreboard doesn't freeze */
      const delay = Math.min(1000 * Math.pow(2, Math.min(_sseRetries - 1, 5)), 30000);
      console.warn('[CricCast] SSE error (attempt ' + _sseRetries + ') — fallback poll active, SSE retry in ' + delay + 'ms');
      startFallbackPoll();
      /* Close and manually reopen after backoff so we control the retry timing */
      try { _sse.close(); } catch {}
      _sse = null;
      setTimeout(connectSSE, delay);
    };
  }

  /* ── Fetch current state immediately on load so the scoreboard
     renders right away — SSE delivers future updates in real-time ── */
  async function fetchInitialState() {
    try {
      const res = await fetch(STATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) applyState(await res.json());
    } catch (e) {
      /* silent — SSE will deliver the state once connected */
    }
  }

  /* ── Start after DOM is fully parsed so window.renderBroadcastBar
     is always defined before the first message arrives ── */
  /* ══════════════════════════════════════════════════════════════
     CricCast — Standalone bootstrap
     ──────────────────────────────────────────────────────────────
     When this file runs inside a scoreboard served via
     /match/:id/overlay the server injects window.CRICCAST_BOOT with
     teams + the current ephemeral state. We paint from that BEFORE
     the SSE connection opens so there is no white page while we
     wait. If BOOT is absent but CRICCAST_MATCH_ID is known we fetch
     /api/match/:id/snapshot as a lazy fallback.  A small status
     pill at the bottom surfaces "loading" / "waiting for Controller"
     / "connection error" so "nothing live yet" isn't confused with
     "broken".
     ══════════════════════════════════════════════════════════════ */
  function ccEnsurePill() {
    if (document.getElementById('cc-status-overlay')) return;
    var el = document.createElement('div');
    el.id = 'cc-status-overlay';
    el.style.cssText =
      'position:fixed;left:0;right:0;bottom:10px;display:flex;justify-content:center;' +
      'pointer-events:none;z-index:2147483600;font-family:system-ui,sans-serif;';
    el.innerHTML =
      '<div id="cc-status-pill" style="pointer-events:auto;padding:6px 14px;' +
      'background:rgba(15,22,37,0.85);border:1px solid #2d4060;border-radius:999px;' +
      'font-size:12px;color:#e2e8f0;font-weight:600;letter-spacing:1px;' +
      'text-transform:uppercase;opacity:0;transition:opacity .25s;' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>';
    (document.body || document.documentElement).appendChild(el);
  }
  function ccSetStatus(text, visible) {
    ccEnsurePill();
    var pill = document.getElementById('cc-status-pill');
    if (!pill) return;
    if (text) pill.textContent = text;
    pill.style.opacity = visible ? '1' : '0';
  }
  window.__cc_setStatus = ccSetStatus;

  /* Turn the server's BOOT payload into the state shape applyState() expects. */
  function ccBootToState(boot) {
    if (!boot || typeof boot !== 'object') return null;
    var teams = [];
    function pushTeam(t) {
      if (!t) return;
      teams.push({
        id:        t.id,
        name:      t.name,
        shortName: t.short_name || (t.name || '').substring(0, 3).toUpperCase(),
        color:     t.color || '#1e40af',
        batColor:  t.color || '#1e40af',
        bowlColor: t.color || '#1e40af',
        logo:      t.logo || null,
        captainPhoto: t.captain_photo
            ? { type: 'url', value: t.captain_photo }
            : null,
        players: (t.players || []).map(function (p) {
          return {
            id:            p.id,
            name:          p.name,
            role:          p.role || 'UNASSIGNED',
            batting_order: p.batting_order || 0,
            tags:          Array.isArray(p.tags) ? p.tags : [],
            photo:         p.photo || ''
          };
        })
      });
    }
    pushTeam(boot.batTeam);
    pushTeam(boot.bowlTeam);

    var live      = (boot.state && typeof boot.state === 'object') ? boot.state : {};
    var baseMatch = live.match || {};

    var m = Object.assign({
      isFinished: false, winner: '', winDesc: '',
      inning: 1, target: 0,
      maxOvers: Number(boot.maxOvers) || 20,
      batTeamId:  boot.batTeam  ? boot.batTeam.short_id  : null,
      bowlTeamId: boot.bowlTeam ? boot.bowlTeam.short_id : null,
      runs: 0, wickets: 0, balls: 0,
      p1: {}, p2: {},
      bowler: '', bowlerRuns: 0, bowlerWickets: 0,
      history: [], allBalls: [], thisOverBalls: [], usedPlayers: [],
      overlayMode: 'live'
    }, baseMatch);

    return { match: m, teams: teams, __bootstrapped: true };
  }

  /* Exposed so any UI can trigger a refresh (e.g. a "refresh" button). */
  window.__cc_refreshSnapshot = async function () {
    var id = window.CRICCAST_MATCH_ID;
    if (!id) return null;
    try {
      ccSetStatus('Refreshing...', true);
      var r = await fetch('/api/match/' + encodeURIComponent(id) + '/snapshot',
                          { cache: 'no-store', credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      if (!data.ok || !data.boot) throw new Error('bad snapshot');
      window.CRICCAST_BOOT = data.boot;
      var st = ccBootToState(data.boot);
      if (st && typeof applyState === 'function') applyState(st);
      ccSetStatus('', false);
      return data.boot;
    } catch (e) {
      ccSetStatus('Connection error -- retrying', true);
      return null;
    }
  };

  function ccFirstPaint() {
    var boot = window.CRICCAST_BOOT;
    if (boot && (boot.batTeam || boot.bowlTeam)) {
      var st = ccBootToState(boot);
      if (st && typeof applyState === 'function') {
        try { applyState(st); } catch (e) { console.warn('[CricCast] first paint failed:', e); }
      }
      var hasLive = boot.state && boot.state.match && boot.state.match.batTeamId;
      if (!hasLive) {
        ccSetStatus('Waiting for Controller... teams ready', true);
        setTimeout(function () { ccSetStatus('', false); }, 6000);
      }
      return true;
    }
    if (window.CRICCAST_MATCH_ID) {
      ccSetStatus('Loading match...', true);
      window.__cc_refreshSnapshot();
      return true;
    }
    /* Legacy/local — opened directly as /Scoreboard with no context. */
    ccSetStatus('No match selected', true);
    setTimeout(function () { ccSetStatus('', false); }, 4000);
    return false;
  }

  function start() {
    /* 1) Paint immediately from injected bootstrap (no white page).      */
    ccFirstPaint();
    /* 2) Kick off the normal /api/state fetch — harmless if state empty. */
    fetchInitialState();
    /* 3) Open SSE for real-time updates from Controller.                 */
    console.log('[CricCast] Connecting to ' + SSE_URL + ' ...');
    connectSSE();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

/* ════════════════════════════════════════════════
   OVERLAY CARD TOP-POSITIONING — inject once at load
   Forces innings/summary/teamsheet cards to sit at the
   very top of the screen regardless of per-file CSS.
════════════════════════════════════════════════ */
(function injectOverlayTopCSS() {
  var style = document.createElement('style');
  style.id  = 'overlay-top-fix';
  style.textContent =
    '#innings-card,#match-summary-card,#team-sheet-card{' +
    'position:fixed !important;' +
    'top:14px !important;' +
    'left:50% !important;' +
    'transform:translateX(-50%) !important;' +
    'bottom:auto !important;' +
    'max-width:min(960px,calc(100vw - 32px));' +
    'z-index:30;}';
  function attach() { document.head.appendChild(style); }
  if (document.head) attach();
  else document.addEventListener('DOMContentLoaded', attach);
})();

initCore();
