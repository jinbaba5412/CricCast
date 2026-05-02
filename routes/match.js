'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const sm      = require('../lib/stateManager');

const router = express.Router();

// ── Public match page — no auth required ─────────────────
router.get('/match/:matchId', async (req, res) => {
  const { matchId } = req.params;
  const tenantId    = req.tenant?.id || null;

  try {
    const [rows] = tenantId
      ? await db.query('SELECT m.*, t.slug FROM matches m JOIN tenants t ON t.id=m.tenant_id WHERE m.id=? AND m.tenant_id=?', [matchId, tenantId])
      : await db.query('SELECT m.*, t.slug FROM matches m JOIN tenants t ON t.id=m.tenant_id WHERE m.id=?', [matchId]);

    if (!rows.length) return res.status(404).send('<h1>Match not found</h1>');

    const match    = rows[0];
    const template = match.overlay_template || 'Scoreboard';
    const tenantSlug = match.slug;

    const templateFile = path.join(__dirname, '..', template + '.html');
    if (!fs.existsSync(templateFile)) {
      return res.status(404).send('<h1>Template not found: ' + template + '</h1>');
    }

    let html = fs.readFileSync(templateFile, 'utf8');

    const injection = `
<base href="/">
<script>
  // Injected by CricCast SaaS — public match view
  window.CRICCAST_MATCH_ID    = ${JSON.stringify(matchId)};
  window.CRICCAST_TENANT_SLUG = ${JSON.stringify(tenantSlug)};
  // C3: scope the SSE / fallback poll to this match so a sibling
  // match running on the same tenant doesn't overwrite our render.
  window.CRICCAST_SSE_URL     = '/api/events?matchId=' + encodeURIComponent(${JSON.stringify(matchId)});
  window.CRICCAST_STATE_URL   = '/api/state?matchId='  + encodeURIComponent(${JSON.stringify(matchId)});
</script>
`;
    html = html.replace('<head>', '<head>' + injection);

    const banner = `
<style>
  #public-banner {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: rgba(15,22,37,0.85); backdrop-filter: blur(8px);
    padding: 0.5rem 1rem; font-family: system-ui, sans-serif;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.8rem; color: #94a3b8; border-bottom: 1px solid #2d4060;
  }
  #public-banner .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #4ade80; display: inline-block; margin-right: 6px;
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  body { padding-top: 36px !important; }
</style>
<div id="public-banner">
  <span><span class="live-dot"></span> LIVE — Public View</span>
  <span>🏏 CricCast</span>
</div>
`;
    html = html.replace('<body>', '<body>' + banner);

    res.setHeader('Content-Type', 'text/html');
    html = html.replace(/TENANT_SLUG_PLACEHOLDER/g, encodeURIComponent(tenantSlug));
  res.send(html);
  } catch (err) {
    console.error('[match route] Error:', err.message);
    res.status(500).send('<h1>Server error</h1>');
  }
});

// ── OBS Overlay — no auth required, transparent bg ───────
/**
 * Public overlay route. Renders the chosen Scoreboard template and INJECTS a
 * complete bootstrap blob so the scoreboard can paint itself immediately
 * from a direct URL — with or without a Controller currently running. This
 * turns /match/:id/overlay into a real standalone viewer, not a
 * session-coupled one.
 *
 * Injected on window:
 *   CRICCAST_MATCH_ID, CRICCAST_TENANT_SLUG, CRICCAST_OVERLAY_MODE
 *   CRICCAST_SSE_URL, CRICCAST_STATE_URL
 *   CRICCAST_BOOT = {
 *     matchId, status, template, maxOvers,
 *     batTeam, bowlTeam,   // team objects with rosters from MySQL
 *     state,               // current ephemeral match state (may be empty)
 *     ts
 *   }
 */
router.get('/match/:matchId/overlay', async (req, res) => {
  const { matchId } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT m.id, m.overlay_template, m.status, m.max_overs,
              m.bat_team_id, m.bowl_team_id, m.tenant_id, t.slug
         FROM matches m
         JOIN tenants t ON t.id = m.tenant_id
        WHERE m.id = ?`,
      [matchId]
    );
    if (!rows.length) {
      return res.status(404).send(renderErrorPage('Match not found',
        'This match does not exist or has been deleted. Double-check the link from your Dashboard.'));
    }
    const match      = rows[0];
    const template   = match.overlay_template || 'Scoreboard';
    const tenantSlug = match.slug;

    const templateFile = path.join(__dirname, '..', template + '.html');
    if (!fs.existsSync(templateFile)) {
      return res.status(500).send(renderErrorPage('Overlay template missing',
        'The scoreboard template "' + template + '" does not exist on this server.'));
    }

    const boot = await buildMatchBootPayload(match);
    let html = fs.readFileSync(templateFile, 'utf8');

    const injection = `
<base href="/">
<script>
/* Injected by /match/:id/overlay */
  window.CRICCAST_MATCH_ID     = ${JSON.stringify(matchId)};
  window.CRICCAST_TENANT_SLUG  = ${JSON.stringify(tenantSlug)};
  window.CRICCAST_OVERLAY_MODE = true;
  // C3: include matchId so multi-match tenants get isolated streams.
  window.CRICCAST_SSE_URL      = '/api/events?tenant=TENANT_SLUG_PLACEHOLDER&matchId=' + encodeURIComponent(${JSON.stringify(matchId)});
  window.CRICCAST_STATE_URL    = '/api/state?tenant=TENANT_SLUG_PLACEHOLDER&matchId='  + encodeURIComponent(${JSON.stringify(matchId)});
  window.CRICCAST_BOOT         = ${safeJsonLiteral(boot)};
</script>
`;
    html = html.replace('<head>', '<head>' + injection);

    const overlayCss = `
<style>
  html, body { background: transparent !important; overflow: hidden !important; }
  #public-banner, nav, header, footer { display: none !important; }
</style>
`;
    html = html.replace('</head>', overlayCss + '</head>');

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    html = html.replace(/TENANT_SLUG_PLACEHOLDER/g, encodeURIComponent(tenantSlug));
    res.send(html);
  } catch (err) {
    console.error('[overlay]', err);
    res.status(500).send(renderErrorPage('Error loading overlay',
      'Something went wrong on the server. Please try again in a moment.'));
  }
});

/**
 * Public snapshot endpoint — same payload as the overlay bootstrap blob,
 * but returned as JSON. Used by scoreboard-core as a lazy-load fallback
 * (e.g. scoreboard served from a different path, or when the page wants a
 * fresh picture without a full reload).
 */
router.get('/api/match/:matchId/snapshot', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT m.id, m.overlay_template, m.status, m.max_overs,
              m.bat_team_id, m.bowl_team_id, m.tenant_id, t.slug
         FROM matches m
         JOIN tenants t ON t.id = m.tenant_id
        WHERE m.id = ?`,
      [req.params.matchId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Match not found' });
    const boot = await buildMatchBootPayload(rows[0]);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ ok: true, boot });
  } catch (err) {
    console.error('[snapshot]', err);
    res.status(500).json({ error: err.message });
  }
});

async function buildMatchBootPayload(match) {
  const tenantId   = match.tenant_id;
  const tenantSlug = match.slug;

  async function loadTeamByShortId(shortId) {
    if (!shortId) return null;
    const [[t]] = await db.query(
      `SELECT id, short_id, name, short_name, logo_type, logo_value, color, captain_photo
         FROM teams
        WHERE tenant_id = ? AND short_id = ?`,
      [tenantId, shortId]
    );
    if (!t) return null;
    const [players] = await db.query(
      `SELECT id, name, role, batting_order, photo, tags
         FROM players
        WHERE team_id = ?
        ORDER BY CASE WHEN batting_order = 0 THEN 1 ELSE 0 END,
                 batting_order, name`,
      [t.id]
    );
    return {
      id:            t.id,
      short_id:      t.short_id,
      name:          t.name,
      short_name:    t.short_name,
      color:         t.color || '#1e40af',
      logo:          (t.logo_type === 'url' && t.logo_value)
                        ? { type: 'url', value: '/' + t.logo_value }
                        : null,
      captain_photo: t.captain_photo ? '/' + t.captain_photo : '',
      players: players.map(p => ({
        id:            p.id,
        name:          p.name,
        role:          p.role || 'UNASSIGNED',
        batting_order: p.batting_order || 0,
        photo:         p.photo ? '/' + p.photo : '',
        tags:          parseTagsValue(p.tags),
      })),
    };
  }

  const [batTeam, bowlTeam] = await Promise.all([
    loadTeamByShortId(match.bat_team_id),
    loadTeamByShortId(match.bowl_team_id),
  ]);

  let state = {};
  try {
    if (sm && typeof sm.getState === 'function') {
      state = sm.getState(tenantSlug) || {};
    }
  } catch { /* state is optional */ }

  return {
    matchId:  match.id,
    status:   match.status,
    template: match.overlay_template || 'Scoreboard',
    maxOvers: match.max_overs,
    batTeam,
    bowlTeam,
    state,
    ts:       Date.now(),
  };
}

function parseTagsValue(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

function safeJsonLiteral(v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function renderErrorPage(title, message) {
  const t = String(title || 'Error').replace(/</g, '&lt;');
  const m = String(message || '').replace(/</g, '&lt;');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t} - CricCast</title>
<style>
  body{margin:0;height:100vh;background:#0f1625;color:#e2e8f0;font-family:system-ui,sans-serif;
       display:flex;align-items:center;justify-content:center;padding:2rem;}
  .box{max-width:480px;text-align:center;background:#1e2a3a;border:1px solid #2d4060;
       border-radius:16px;padding:2rem;}
  h1{font-size:1.5rem;margin:0 0 1rem;color:#fca5a5;}
  p{margin:0;line-height:1.6;color:#94a3b8;}
</style></head><body><div class="box"><h1>${t}</h1><p>${m}</p></div></body></html>`;
}

// ── Scorer Controller — auth required ────────────────────
router.get('/match/:matchId/score', requireAuth, async (req, res) => {
  const { matchId } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT id FROM matches WHERE id=? AND tenant_id=?',
      [matchId, req.user.tenant_id]
    );
    if (!rows.length) return res.status(403).send('<h1>Access denied</h1>');
    res.redirect('/Controller-offline.html?matchId=' + encodeURIComponent(matchId));
  } catch (err) {
    res.status(500).send('<h1>Server error</h1>');
  }
});

// ── Match links API ───────────────────────────────────────
router.get('/api/match/:matchId/links', requireAuth, async (req, res) => {
  const { matchId } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT m.id, m.overlay_template, m.status, t.slug FROM matches m JOIN tenants t ON t.id=m.tenant_id WHERE m.id=? AND m.tenant_id=?',
      [matchId, req.user.tenant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Match not found' });

    const slug    = rows[0].slug;
    const baseUrl = req.protocol + '://' + req.get('host');

    res.json({
      ok: true,
      links: {
        scorer:  baseUrl + '/match/' + matchId + '/score',
        public:  baseUrl + '/match/' + matchId,
        overlay: baseUrl + '/match/' + matchId + '/overlay',
      },
      template: rows[0].overlay_template,
      status:   rows[0].status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Scorecard — finished match summary ───────────────────
// PUBLIC endpoint (no auth — embedded in public match pages) but now honours
// tenant scoping when a tenant is resolved from the URL (subdomain/path).
// If no tenant context (e.g. shareable link on the bare apex), the scorecard
// falls back to returning the match by id alone — matching legacy behaviour.
// We also strip sensitive internal columns from the match row before sending.
router.get('/match/:matchId/scorecard', async (req, res) => {
  const { matchId } = req.params;
  const tenantId    = req.tenant?.id || null;
  try {
    const baseSql = `
      SELECT m.*, t.name AS bat_team_name, t2.name AS bowl_team_name
      FROM matches m
      LEFT JOIN teams t  ON t.short_id=m.bat_team_id  AND t.tenant_id=m.tenant_id
      LEFT JOIN teams t2 ON t2.short_id=m.bowl_team_id AND t2.tenant_id=m.tenant_id
      WHERE m.id=?`;
    const [[match]] = tenantId
      ? await db.query(baseSql + ' AND m.tenant_id=?', [matchId, tenantId])
      : await db.query(baseSql, [matchId]);

    if (!match) return res.status(404).json({ error: 'Match not found' });

    // Never leak internal tenant_id over a public endpoint.
    delete match.tenant_id;

    const [balls] = await db.query(
      'SELECT inning, over_num, ball_num, runs, type, batsman, bowler, chip, created_at ' +
      'FROM ball_events WHERE match_id=? ORDER BY inning, over_num, ball_num',
      [matchId]
    );

    const [[stateRow]] = await db.query(
      'SELECT state_json FROM match_state WHERE match_id=?',
      [matchId]
    );
    const state = stateRow ? JSON.parse(stateRow.state_json) : null;

    res.json({ ok: true, match, balls, finalState: state?.match || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
