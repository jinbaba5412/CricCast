'use strict';

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const crypto   = require('crypto');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');
const db       = require('../db/connection');
const { requireAuth, requireRole, requireTenantMatch } = require('../middleware/auth');

const router = express.Router();

// Admin-only endpoints (writes, user management, team/player CRUD).
const clubGuard   = [requireAuth, requireRole('admin'), requireTenantMatch];
// Read-only endpoints scorers also need (match list, squads, summary).
const scorerGuard = [requireAuth, requireTenantMatch];

// ── Per-tenant upload factory ────────────────────────────────
function makeUpload(req) {
  const slug    = req.tenant?.slug || 'default';
  const destDir = path.join(__dirname, '..', 'criccast_uploads', slug);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (r, f, cb) => cb(null, destDir),
    filename:    (r, f, cb) => {
      const ext = path.extname(f.originalname).toLowerCase() || '.jpg';
      cb(null, 'img_' + crypto.randomBytes(8).toString('hex') + ext);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (r, f, cb) => {
      if (/^image\//i.test(f.mimetype)) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    },
  });
}

// ── Shared enums / helpers ───────────────────────────────────
const VALID_ROLES = ['UNASSIGNED', 'BAT', 'BOWL', 'SPIN', 'AR', 'WK'];
const VALID_TAGS  = ['c', 'wk', 'vc'];

function normalizeRole(r) {
  const v = String(r || '').toUpperCase();
  return VALID_ROLES.includes(v) ? v : 'UNASSIGNED';
}
function parseTagsCol(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(t => VALID_TAGS.includes(t));
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter(t => VALID_TAGS.includes(t)) : [];
  } catch { return []; }
}
function sanitizeTags(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const t of input) {
    const v = String(t || '').toLowerCase();
    if (VALID_TAGS.includes(v) && !out.includes(v)) out.push(v);
  }
  return out;
}
function sanitizeOrder(n) {
  const i = parseInt(n, 10);
  if (Number.isNaN(i) || i < 0) return 0;
  return Math.min(i, 11);
}

/**
 * Enforce tag uniqueness within a team: max one captain, one wk, one vc.
 * `excludePlayerId` lets us allow a player to keep its own tag on update.
 * Throws with a 409-style error message on conflict.
 */
async function assertTagUniqueness(teamId, tags, excludePlayerId) {
  for (const tag of tags) {
    const [[row]] = await db.query(
      `SELECT id, name FROM players
        WHERE team_id = ?
          AND (id <> ? OR ? IS NULL)
          AND JSON_CONTAINS(COALESCE(tags, JSON_ARRAY()), JSON_QUOTE(?))
        LIMIT 1`,
      [teamId, excludePlayerId || '', excludePlayerId || null, tag]
    );
    if (row) {
      const label = tag === 'c' ? 'captain' : tag === 'wk' ? 'wicket-keeper' : 'vice-captain';
      const err = new Error(`Only one ${label} allowed per team. Currently: ${row.name}`);
      err.status = 409;
      err.field  = 'tags';
      throw err;
    }
  }
}

async function assertRoleUniqueness(teamId, role, excludePlayerId) {
  // Only 'WK' role needs uniqueness at the role level (captain/VC are tags).
  if (role !== 'WK') return;
  const [[row]] = await db.query(
    `SELECT id, name FROM players
      WHERE team_id = ? AND role = 'WK'
        AND (id <> ? OR ? IS NULL) LIMIT 1`,
    [teamId, excludePlayerId || '', excludePlayerId || null]
  );
  if (row) {
    const err = new Error(`Only one wicket-keeper role allowed per team. Currently: ${row.name}`);
    err.status = 409;
    err.field  = 'role';
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════
// TEAMS
// ═════════════════════════════════════════════════════════════

// GET /api/club/teams
router.get('/teams', scorerGuard, async (req, res) => {
  try {
    const [teams] = await db.query(
      `SELECT t.id, t.short_id, t.name, t.short_name,
              t.logo_type, t.logo_value, t.color, t.captain_photo,
              t.bar_logo_mode,
              COUNT(p.id) AS player_count
       FROM teams t
       LEFT JOIN players p ON p.team_id = t.id
       WHERE t.tenant_id = ?
       GROUP BY t.id
       ORDER BY t.name`,
      [req.tenant.id]
    );
    res.json({ ok: true, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/club/teams — logo_type ∈ {url, none} (emoji dropped by design)
router.post('/teams', clubGuard, express.json(), async (req, res) => {
  const { shortId, name, shortName, logoType, logoValue, color, captainPhoto, barLogoMode } = req.body || {};
  if (!shortId || !name || !shortName) {
    return res.status(400).json({ error: 'shortId, name, shortName are required' });
  }
  if (!/^[A-Z0-9]{1,10}$/.test(shortId)) {
    return res.status(400).json({ error: 'shortId must be 1-10 uppercase letters/numbers' });
  }
  const lt  = (logoType === 'url') ? 'url' : 'none';
  const col = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#1e40af';
  // D2: validate bar logo display mode (controls broadcast-bar render).
  const blm = ['auto','logo','captain','both'].includes(barLogoMode) ? barLogoMode : 'auto';

  const [countRows] = await db.query(
    'SELECT COUNT(*) AS cnt FROM teams WHERE tenant_id = ?', [req.tenant.id]
  );
  if (countRows[0].cnt >= req.tenant.max_teams) {
    return res.status(429).json({ error: 'Team limit reached (' + req.tenant.max_teams + '). Upgrade your plan.' });
  }

  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO teams
         (id, tenant_id, short_id, name, short_name, logo_type, logo_value, color, captain_photo, bar_logo_mode)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, req.tenant.id, shortId.toUpperCase(), name, shortName,
       lt, lt === 'url' ? (logoValue || '') : '',
       col, captainPhoto || '', blm]
    );
    res.json({ ok: true, id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A team with that ID already exists', field: 'shortId' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/club/teams/:id
router.put('/teams/:id', clubGuard, express.json(), async (req, res) => {
  const { name, shortName, logoType, logoValue, color, captainPhoto, barLogoMode } = req.body || {};
  const lt  = (logoType === 'url') ? 'url' : 'none';
  const col = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#1e40af';
  // D2: validate bar logo display mode.
  const blm = ['auto','logo','captain','both'].includes(barLogoMode) ? barLogoMode : 'auto';
  try {
    const [result] = await db.query(
      `UPDATE teams
          SET name=?, short_name=?, logo_type=?, logo_value=?, color=?, captain_photo=?, bar_logo_mode=?
        WHERE id=? AND tenant_id=?`,
      [name, shortName, lt, lt === 'url' ? (logoValue || '') : '',
       col, captainPhoto || '', blm, req.params.id, req.tenant.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/club/teams/:id
router.delete('/teams/:id', clubGuard, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM teams WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Team not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/club/teams/:id/logo
router.post('/teams/:id/logo', clubGuard, (req, res) => {
  const upload = makeUpload(req);
  upload.single('photo')(req, res, async (err) => {
    if (err)       return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: photo)' });

    const slug = req.tenant.slug;
    const url  = 'criccast_uploads/' + slug + '/' + req.file.filename;
    try {
      const [r] = await db.query(
        'UPDATE teams SET logo_type=?, logo_value=? WHERE id=? AND tenant_id=?',
        ['url', url, req.params.id, req.tenant.id]
      );
      if (r.affectedRows === 0) return res.status(404).json({ error: 'Team not found' });
      res.json({ ok: true, url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// POST /api/club/teams/:id/captain-photo  — portrait used on scoreboard overlays
router.post('/teams/:id/captain-photo', clubGuard, (req, res) => {
  const upload = makeUpload(req);
  upload.single('photo')(req, res, async (err) => {
    if (err)       return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: photo)' });

    const slug = req.tenant.slug;
    const url  = 'criccast_uploads/' + slug + '/' + req.file.filename;
    try {
      const [r] = await db.query(
        'UPDATE teams SET captain_photo=? WHERE id=? AND tenant_id=?',
        [url, req.params.id, req.tenant.id]
      );
      if (r.affectedRows === 0) return res.status(404).json({ error: 'Team not found' });
      res.json({ ok: true, url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// ═════════════════════════════════════════════════════════════
// PLAYERS
// ═════════════════════════════════════════════════════════════

// GET /api/club/teams/:teamId/players  — ordered by batting_order, then name
router.get('/teams/:teamId/players', scorerGuard, async (req, res) => {
  try {
    const [teams] = await db.query(
      'SELECT id FROM teams WHERE id=? AND tenant_id=?',
      [req.params.teamId, req.tenant.id]
    );
    if (!teams.length) return res.status(404).json({ error: 'Team not found' });

    const [rows] = await db.query(
      `SELECT id, name, display_name, role, batting_order, photo, tags
         FROM players
        WHERE team_id=?
        ORDER BY
          CASE WHEN batting_order = 0 THEN 1 ELSE 0 END,
          batting_order, name`,
      [req.params.teamId]
    );
    const players = rows.map(p => ({
      id:            p.id,
      name:          p.name,
      // D11 (B-BOWLER-NAME-FORMAT): expose optional broadcast-friendly
      // form. Empty string means the renderer falls back to `name`.
      display_name:  p.display_name || '',
      role:          p.role,
      batting_order: p.batting_order,
      photo:         p.photo || '',
      tags:          parseTagsCol(p.tags),
      stats:         null,
    }));
    res.json({ ok: true, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/club/teams/:teamId/players
router.post('/teams/:teamId/players', clubGuard, express.json(), async (req, res) => {
  const { name, displayName, role, battingOrder, photo, tags } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  const playerRole = normalizeRole(role);
  const order      = sanitizeOrder(battingOrder);
  const tagList    = sanitizeTags(tags);
  // D11 (B-BOWLER-NAME-FORMAT): trim + cap to 60 chars to match column.
  const dispName   = String(displayName || '').trim().slice(0, 60);

  try {
    const [teams] = await db.query(
      'SELECT id FROM teams WHERE id=? AND tenant_id=?',
      [req.params.teamId, req.tenant.id]
    );
    if (!teams.length) return res.status(404).json({ error: 'Team not found' });

    await assertRoleUniqueness(req.params.teamId, playerRole, null);
    await assertTagUniqueness(req.params.teamId, tagList, null);

    const id = uuidv4();
    await db.query(
      `INSERT INTO players
         (id, tenant_id, team_id, name, display_name, role, batting_order, photo, tags)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, req.tenant.id, req.params.teamId, name.trim(), dispName,
       playerRole, order, photo || '', JSON.stringify(tagList)]
    );
    res.json({ ok: true, id });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, field: err.field });
  }
});

// PUT /api/club/players/:id
router.put('/players/:id', clubGuard, express.json(), async (req, res) => {
  const { name, displayName, role, battingOrder, photo, tags } = req.body || {};
  const playerRole = normalizeRole(role);
  const order      = sanitizeOrder(battingOrder);
  const tagList    = sanitizeTags(tags);
  const dispName   = String(displayName || '').trim().slice(0, 60);

  try {
    // Verify player belongs to tenant and find its team.
    const [[row]] = await db.query(
      'SELECT team_id FROM players WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (!row) return res.status(404).json({ error: 'Player not found' });

    await assertRoleUniqueness(row.team_id, playerRole, req.params.id);
    await assertTagUniqueness(row.team_id, tagList, req.params.id);

    const [result] = await db.query(
      `UPDATE players
          SET name=?, display_name=?, role=?, batting_order=?, photo=?, tags=?
        WHERE id=? AND tenant_id=?`,
      [name ? name.trim() : '', dispName, playerRole, order, photo || '',
       JSON.stringify(tagList), req.params.id, req.tenant.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Player not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, field: err.field });
  }
});

// DELETE /api/club/players/:id
router.delete('/players/:id', clubGuard, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM players WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Player not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/club/players/:id/photo
router.post('/players/:id/photo', clubGuard, (req, res) => {
  const upload = makeUpload(req);
  upload.single('photo')(req, res, async (err) => {
    if (err)       return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: photo)' });

    const slug = req.tenant.slug;
    const url  = 'criccast_uploads/' + slug + '/' + req.file.filename;
    try {
      const [r] = await db.query(
        'UPDATE players SET photo=? WHERE id=? AND tenant_id=?',
        [url, req.params.id, req.tenant.id]
      );
      if (r.affectedRows === 0) return res.status(404).json({ error: 'Player not found' });
      res.json({ ok: true, url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// ═════════════════════════════════════════════════════════════
// IMPORT / EXPORT  (full teams + players)
// ═════════════════════════════════════════════════════════════

// GET /api/club/teams/export — returns the full club roster as JSON
router.get('/teams/export', clubGuard, async (req, res) => {
  try {
    const [teams] = await db.query(
      `SELECT id, short_id, name, short_name, logo_type, logo_value, color, captain_photo
         FROM teams WHERE tenant_id=? ORDER BY name`,
      [req.tenant.id]
    );
    const [players] = await db.query(
      `SELECT id, team_id, name, display_name, role, batting_order, photo, tags
         FROM players WHERE tenant_id=?`,
      [req.tenant.id]
    );

    const playersByTeam = new Map();
    for (const p of players) {
      if (!playersByTeam.has(p.team_id)) playersByTeam.set(p.team_id, []);
      playersByTeam.get(p.team_id).push({
        name:          p.name,
        display_name:  p.display_name || '',
        role:          p.role,
        batting_order: p.batting_order,
        photo:         p.photo || '',
        tags:          parseTagsCol(p.tags),
        stats:         null,
      });
    }

    const out = {
      schema:     'criccast.teams/v1',
      exported_at: new Date().toISOString(),
      teams: teams.map(t => ({
        short_id:      t.short_id,
        name:          t.name,
        short_name:    t.short_name,
        logo_type:     t.logo_type,
        logo_value:    t.logo_value,
        color:         t.color,
        captain_photo: t.captain_photo,
        players:       (playersByTeam.get(t.id) || [])
                        .sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99)),
      })),
    };

    res.setHeader('Content-Disposition',
      'attachment; filename="criccast-teams-' + req.tenant.slug + '.json"');
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/club/teams/import — validates and imports JSON.
 * Behaviour requested: if a team's short_id already exists in this club,
 * reject the import and ask the admin to pick a new short_id. Nothing is
 * written unless the entire payload is clean.
 */
router.post('/teams/import', clubGuard, express.json({ limit: '2mb' }), async (req, res) => {
  const payload = req.body || {};
  if (payload.schema && payload.schema !== 'criccast.teams/v1') {
    return res.status(400).json({ error: 'Unsupported schema: ' + payload.schema });
  }
  const incoming = Array.isArray(payload.teams) ? payload.teams : [];
  if (incoming.length === 0) {
    return res.status(400).json({ error: 'No teams in payload' });
  }

  // ── Structural validation (fail-fast) ───────────────────────
  const errors = [];
  for (let i = 0; i < incoming.length; i++) {
    const t = incoming[i] || {};
    if (!t.short_id || !/^[A-Z0-9]{1,10}$/.test(t.short_id)) {
      errors.push({ index: i, field: 'short_id', reason: 'must be 1-10 uppercase letters/numbers' });
    }
    if (!t.name || !t.short_name) {
      errors.push({ index: i, field: 'name', reason: 'name and short_name are required' });
    }
    if (t.color && !/^#[0-9a-fA-F]{6}$/.test(t.color)) {
      errors.push({ index: i, field: 'color', reason: 'color must be #RRGGBB' });
    }
    if (!Array.isArray(t.players)) {
      errors.push({ index: i, field: 'players', reason: 'players must be an array' });
    }
  }
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  // ── short_id collisions ─────────────────────────────────────
  const shortIds = incoming.map(t => t.short_id.toUpperCase());
  const uniqueIn = new Set(shortIds);
  if (uniqueIn.size !== shortIds.length) {
    return res.status(400).json({ error: 'Duplicate short_id within the uploaded file' });
  }

  const [existing] = await db.query(
    `SELECT short_id FROM teams WHERE tenant_id=? AND short_id IN (?)`,
    [req.tenant.id, shortIds]
  );
  if (existing.length) {
    return res.status(409).json({
      error:    'Some short_ids already exist in this club. Choose new IDs and retry.',
      conflicts: existing.map(r => r.short_id),
    });
  }

  // ── Quota check ─────────────────────────────────────────────
  const [[{ cnt }]] = await db.query(
    'SELECT COUNT(*) AS cnt FROM teams WHERE tenant_id=?', [req.tenant.id]
  );
  if (cnt + incoming.length > req.tenant.max_teams) {
    return res.status(429).json({
      error: 'Importing would exceed your team quota (' + req.tenant.max_teams + ').',
    });
  }

  // ── Write (transactional) ───────────────────────────────────
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const imported = [];
    for (const t of incoming) {
      const teamId = uuidv4();
      const lt  = (t.logo_type === 'url') ? 'url' : 'none';
      const col = /^#[0-9a-fA-F]{6}$/.test(t.color || '') ? t.color : '#1e40af';
      await conn.query(
        `INSERT INTO teams
           (id, tenant_id, short_id, name, short_name, logo_type, logo_value, color, captain_photo)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [teamId, req.tenant.id, t.short_id.toUpperCase(), t.name, t.short_name,
         lt, lt === 'url' ? (t.logo_value || '') : '',
         col, t.captain_photo || '']
      );

      // Players: enforce uniqueness in-memory while inserting.
      const seenTags = new Set();
      let hasWk = false;
      for (const p of (t.players || [])) {
        const pRole = normalizeRole(p.role);
        const pTags = sanitizeTags(p.tags);
        for (const tag of pTags) {
          if (seenTags.has(tag)) {
            throw Object.assign(
              new Error(`Team ${t.short_id}: duplicate "${tag}" tag`),
              { status: 400 }
            );
          }
          seenTags.add(tag);
        }
        if (pRole === 'WK') {
          if (hasWk) {
            throw Object.assign(
              new Error(`Team ${t.short_id}: more than one WK role`),
              { status: 400 }
            );
          }
          hasWk = true;
        }
        await conn.query(
          `INSERT INTO players
             (id, tenant_id, team_id, name, display_name, role, batting_order, photo, tags)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [uuidv4(), req.tenant.id, teamId, String(p.name || '').trim(),
           String(p.display_name || '').trim().slice(0, 60),
           pRole, sanitizeOrder(p.batting_order), p.photo || '',
           JSON.stringify(pTags)]
        );
      }
      imported.push({ short_id: t.short_id, id: teamId, players: (t.players || []).length });
    }
    await conn.commit();
    res.json({ ok: true, imported });
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ═════════════════════════════════════════════════════════════
// MATCHES
// ═════════════════════════════════════════════════════════════

/**
 * GET /api/club/matches
 * Optional query filters:
 *   status=scheduled|ready|live|completed  (CSV allowed, aliases accepted)
 *   tournamentId=<uuid>                    (restrict to one tournament)
 *   seasonId=<uuid>                        (restrict to one season)
 *   scheduledFrom=YYYY-MM-DD               (inclusive lower bound on scheduled_date)
 *   scheduledTo=YYYY-MM-DD                 (inclusive upper bound)
 *   limit=<1..200>                         (default 50)
 */
router.get('/matches', scorerGuard, async (req, res) => {
  try {
    const wheres = ['m.tenant_id = ?'];
    const vals   = [req.tenant.id];

    if (req.query.status) {
      const list = String(req.query.status)
        .split(',').map(s => canonicalStatus(s)).filter(Boolean);
      if (list.length) {
        wheres.push(`m.status IN (${list.map(() => '?').join(',')})`);
        vals.push(...list);
      }
    }
    if (req.query.tournamentId) {
      wheres.push('m.tournament_id = ?'); vals.push(req.query.tournamentId);
    }
    if (req.query.seasonId) {
      wheres.push('m.season_id = ?'); vals.push(req.query.seasonId);
    }
    if (req.query.scheduledFrom) {
      wheres.push('m.scheduled_date >= ?'); vals.push(req.query.scheduledFrom);
    }
    if (req.query.scheduledTo) {
      wheres.push('m.scheduled_date <= ?'); vals.push(req.query.scheduledTo);
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const [matches] = await db.query(
      `SELECT m.id, m.bat_team_id, m.bowl_team_id, m.max_overs,
              m.status, m.overlay_template, m.toss_winner, m.toss_election,
              m.created_at, m.finished_at,
              m.tournament_id, m.season_id, m.group_id, m.stage,
              m.scheduled_date, m.scheduled_time, m.round_num,
              m.is_bye, m.winner_team_id, m.result_type,
              t1.name AS bat_team_name, t2.name AS bowl_team_name,
              tr.name AS tournament_name, s.season_number
       FROM matches m
       LEFT JOIN teams       t1 ON t1.short_id = m.bat_team_id  AND t1.tenant_id = m.tenant_id
       LEFT JOIN teams       t2 ON t2.short_id = m.bowl_team_id AND t2.tenant_id = m.tenant_id
       LEFT JOIN tournaments tr ON tr.id = m.tournament_id
       LEFT JOIN seasons     s  ON s.id  = m.season_id
       WHERE ${wheres.join(' AND ')}
       ORDER BY
         CASE m.status
           WHEN 'live'      THEN 0
           WHEN 'ready'     THEN 1
           WHEN 'setup'     THEN 1
           WHEN 'scheduled' THEN 2
           WHEN 'completed' THEN 3
           WHEN 'finished'  THEN 3
           ELSE 4 END,
         COALESCE(m.scheduled_date, m.created_at) DESC,
         m.created_at DESC
       LIMIT ?`,
      [...vals, limit]
    );

    // Normalise legacy status values on the way out so clients see only
    // canonical lifecycle states.
    const mapped = matches.map(m => ({
      ...m,
      status: canonicalStatus(m.status) || m.status,
    }));

    // D10 (B-DASH-NOLIVE): if any of these matches is the one currently
    // being scored, attach a `liveScore` snapshot from the in-memory
    // state cache so the dashboard can show "123/4 in 12.3" without
    // each row hitting /api/state separately.
    try {
      const sm    = require('../lib/stateManager');
      const live  = sm && sm.getState ? sm.getState(req.tenant.slug) : null;
      const lm    = live && live.match;
      if (lm && lm.matchId) {
        const balls = Number(lm.balls) || 0;
        const overs = Math.floor(balls / 6) + '.' + (balls % 6);
        const score = {
          runs:    Number(lm.runs)    || 0,
          wickets: Number(lm.wickets) || 0,
          balls,
          overs,
          batTeamId:  lm.batTeamId  || null,
          bowlTeamId: lm.bowlTeamId || null,
          inning:     lm.inning     || 1,
          target:     lm.target     || 0,
          isFinished: !!lm.isFinished,
        };
        for (const row of mapped) {
          if (row.id === lm.matchId) row.liveScore = score;
        }
      }
    } catch (_e) { /* best-effort enrichment */ }

    res.json({ ok: true, matches: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Lifecycle helpers ──────────────────────────────────────────────
const LEGACY_STATUS_ALIASES = { setup: 'ready', finished: 'completed' };
function canonicalStatus(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  return LEGACY_STATUS_ALIASES[s] || s;
}
const ALLOWED_STATUS = ['scheduled', 'ready', 'live', 'completed'];
// Forward-only transitions. 'scheduled' is for tournament fixtures;
// a one-off/custom match is created directly in 'ready'.
const STATUS_TRANSITIONS = {
  scheduled: ['ready', 'live', 'completed'],
  ready:     ['live',  'completed'],
  live:      ['completed'],
  completed: [], // terminal
};

const VALID_STAGES = ['custom','group','round_of_16','quarter','semi','final','3rd_place'];

// Valid overlay templates (Scoreboard3 intentionally omitted — file does not exist)
const VALID_TEMPLATES = [
  'Scoreboard','Scoreboard1','Scoreboard2',
  'Scoreboard4','Scoreboard5','Scoreboard6','Scoreboard7',
  'Scoreboard8','Scoreboard9','Scoreboard10','Scoreboard11',
  'Scoreboard12','Scoreboard13','Scoreboard14','Scoreboard15',
  'Scoreboard16','Scoreboard17','Scoreboard18','Scoreboard19','Scoreboard20',
];

// POST /api/club/matches
// Accepts both the legacy custom-match payload and the extended tournament
// linkage fields: tournamentId / seasonId / groupId / stage / scheduledDate /
// scheduledTime / roundNum / initialStatus.
router.post('/matches', clubGuard, express.json(), async (req, res) => {
  const {
    batTeamId, bowlTeamId, maxOvers, overlayTemplate,
    tossWinner, tossElection,
    tournamentId, seasonId, groupId, stage,
    scheduledDate, scheduledTime, roundNum,
    initialStatus,
  } = req.body || {};

  if (!batTeamId || !bowlTeamId) {
    return res.status(400).json({ error: 'batTeamId and bowlTeamId are required' });
  }
  if (batTeamId === bowlTeamId) {
    return res.status(400).json({ error: 'Batting and bowling teams must be different' });
  }

  // Only *active* matches (live or ready-to-start) count toward quota.
  // Scheduled fixtures don't — a club running a 30-match tournament must be
  // able to schedule all of them without hitting the active cap.
  const [activeRows] = await db.query(
    "SELECT COUNT(*) AS cnt FROM matches WHERE tenant_id=? AND status IN ('ready','setup','live')",
    [req.tenant.id]
  );
  if (activeRows[0].cnt >= req.tenant.max_matches) {
    return res.status(429).json({
      error: 'Active match limit reached (' + req.tenant.max_matches + '). Finish or delete a match first.',
    });
  }

  const template    = VALID_TEMPLATES.includes(overlayTemplate) ? overlayTemplate : 'Scoreboard';
  const stageVal    = VALID_STAGES.includes(stage) ? stage : (tournamentId ? 'group' : 'custom');
  const statusWant  = canonicalStatus(initialStatus) || (scheduledDate ? 'scheduled' : 'ready');
  if (!ALLOWED_STATUS.includes(statusWant)) {
    return res.status(400).json({ error: 'initialStatus must be one of: ' + ALLOWED_STATUS.join(', ') });
  }
  // 'scheduled' requires a scheduledDate.
  if (statusWant === 'scheduled' && !scheduledDate) {
    return res.status(400).json({ error: 'scheduledDate is required when initialStatus=scheduled' });
  }

  // If tournament linkage provided, verify ownership.
  if (tournamentId) {
    const [[t]] = await db.query(
      'SELECT id FROM tournaments WHERE id=? AND tenant_id=?', [tournamentId, req.tenant.id]
    );
    if (!t) return res.status(400).json({ error: 'Invalid tournamentId' });
  }
  if (seasonId) {
    const [[s]] = await db.query(
      'SELECT id, tournament_id FROM seasons WHERE id=? AND tenant_id=?', [seasonId, req.tenant.id]
    );
    if (!s) return res.status(400).json({ error: 'Invalid seasonId' });
    if (tournamentId && s.tournament_id !== tournamentId) {
      return res.status(400).json({ error: 'seasonId does not belong to that tournament' });
    }
  }
  if (groupId) {
    const [[g]] = await db.query(
      'SELECT id, season_id FROM `groups` WHERE id=? AND tenant_id=?', [groupId, req.tenant.id]
    );
    if (!g) return res.status(400).json({ error: 'Invalid groupId' });
    if (seasonId && g.season_id !== seasonId) {
      return res.status(400).json({ error: 'groupId does not belong to that season' });
    }
  }

  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO matches
         (id, tenant_id, tournament_id, season_id, group_id, stage,
          scheduled_date, scheduled_time, round_num,
          bat_team_id, bowl_team_id, max_overs, status, overlay_template,
          toss_winner, toss_election)
       VALUES (?,?,?,?,?,?, ?,?,?, ?,?,?,?,?, ?,?)`,
      [id, req.tenant.id, tournamentId || null, seasonId || null, groupId || null, stageVal,
       scheduledDate || null, scheduledTime || null, parseInt(roundNum) || 0,
       batTeamId, bowlTeamId, parseInt(maxOvers) || 20, statusWant, template,
       tossWinner || null, tossElection || null]
    );
    res.json({ ok: true, id, template, status: statusWant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/club/matches/:id/status — forward-only lifecycle transition.
 *
 * Canonical states: scheduled → ready → live → completed.
 * Legacy aliases 'setup'→'ready', 'finished'→'completed' accepted for
 * compatibility. Backward or sideways moves are rejected. On transition
 * into 'completed' we timestamp `finished_at` and broadcast a lifecycle
 * SSE event so any open Controller/scoreboard can react (e.g. close).
 */
router.put('/matches/:id/status', clubGuard, express.json(), async (req, res) => {
  const target = canonicalStatus(req.body && req.body.status);
  if (!target || !ALLOWED_STATUS.includes(target)) {
    return res.status(400).json({ error: 'status must be one of: ' + ALLOWED_STATUS.join(', ') });
  }
  try {
    const [[row]] = await db.query(
      'SELECT status FROM matches WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (!row) return res.status(404).json({ error: 'Match not found' });

    const current = canonicalStatus(row.status);
    if (current === target) return res.json({ ok: true, status: target, unchanged: true });

    const allowedNext = STATUS_TRANSITIONS[current] || [];
    if (!allowedNext.includes(target)) {
      return res.status(409).json({
        error: `Cannot transition from "${current}" to "${target}". Allowed next: ${allowedNext.join(', ') || '(none)'}`,
      });
    }

    // L5: when transitioning to 'completed', run the full stats pipeline
    // inside a transaction so points_table + player_match_stats +
    // match_snapshots + knockout-propagation all either succeed together
    // or all roll back.
    if (target === 'completed' && current !== 'completed') {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          `UPDATE matches SET status='completed',
                  finished_at = IFNULL(finished_at, CURRENT_TIMESTAMP)
             WHERE id=? AND tenant_id=?`,
          [req.params.id, req.tenant.id]
        );
        const [mrows] = await conn.query(
          `SELECT * FROM matches WHERE id=? AND tenant_id=?`,
          [req.params.id, req.tenant.id]
        );
        const mrow = mrows && mrows[0];
        const [srows] = await conn.query(
          `SELECT state_json FROM match_state WHERE match_id=?`,
          [req.params.id]
        );
        let _state = null;
        try {
          const srow = srows && srows[0];
          _state = srow && srow.state_json ? JSON.parse(srow.state_json) : null;
        } catch {}
        const matchState = (_state && (_state.match || _state)) || null;
        const agg = require('../lib/statsAggregator');
        await agg.onMatchCompleted({
          conn,
          matchId:  req.params.id,
          tenantId: req.tenant.id,
          matchRow: mrow,
          state:    matchState,
        });
        await conn.commit();
      } catch (err) {
        try { await conn.rollback(); } catch {}
        console.error('[L5 onMatchCompleted]', err);
        return res.status(500).json({
          error: 'Match marked completed but stats pipeline failed: ' + err.message,
        });
      } finally {
        conn.release();
      }
    } else {
      const finishedAt = target === 'completed' ? new Date() : null;
      await db.query(
        'UPDATE matches SET status=?, finished_at=? WHERE id=? AND tenant_id=?',
        [target, finishedAt, req.params.id, req.tenant.id]
      );
    }

    // Fire lifecycle event on the tenant's SSE stream. Scoreboards and
    // Controllers can subscribe and close themselves on 'completed'.
    try {
      const sm = require('../lib/stateManager');
      if (sm && typeof sm.writeEvent === 'function') {
        sm.writeEvent(req.tenant.slug, 'match:lifecycle', {
          matchId: req.params.id,
          from:    current,
          to:      target,
          at:      Date.now(),
        });
      }
    } catch { /* best effort — never block the response */ }

    res.json({ ok: true, status: target });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/club/matches/:id
 * Removes the match row (cascades to ball_events, match_settings,
 * player_match_stats via FK ON DELETE CASCADE). Also broadcasts a
 * match:deleted SSE event so any open Controller / scoreboard viewing
 * that match can clear itself gracefully instead of lingering on stale
 * state.
 */
router.delete('/matches/:id', clubGuard, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM matches WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Match not found' });

    try {
      const sm = require('../lib/stateManager');
      if (sm && typeof sm.writeEvent === 'function') {
        sm.writeEvent(req.tenant.slug, 'match:deleted', {
          matchId: req.params.id,
          at:      Date.now(),
        });
      }
    } catch { /* best effort */ }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/club/match/:matchId/state-seed
 * ─────────────────────────────────────────────────────────────
 * The missing endpoint that Controller-offline.html needs. Returns
 * the MySQL-sourced snapshot of a match: both teams with nested
 * players (ordered by batting_order). This is the SINGLE SOURCE
 * OF TRUTH for the Controller. Calling it replaces any stale
 * team data the Controller may still hold from an older session.
 */
router.get('/match/:matchId/state-seed', scorerGuard, async (req, res) => {
  try {
    const [[match]] = await db.query(
      `SELECT id, bat_team_id, bowl_team_id, max_overs, overlay_template,
              status, toss_winner, toss_election,
              stage, scheduled_date, scheduled_time, round_num,
              tournament_id, season_id
         FROM matches
        WHERE id=? AND tenant_id=?`,
      [req.params.matchId, req.tenant.id]
    );
    if (!match) return res.status(404).json({ error: 'Match not found' });

    async function loadTeam(shortId) {
      if (!shortId) return null;
      const [[t]] = await db.query(
        `SELECT id, short_id, name, short_name, logo_type, logo_value, color, captain_photo, bar_logo_mode
           FROM teams WHERE tenant_id=? AND short_id=?`,
        [req.tenant.id, shortId]
      );
      if (!t) return null;
      const [players] = await db.query(
        `SELECT id, name, display_name, role, batting_order, photo, tags
           FROM players
          WHERE team_id=?
          ORDER BY
            CASE WHEN batting_order = 0 THEN 1 ELSE 0 END,
            batting_order, name`,
        [t.id]
      );
      return {
        id:            t.id,
        short_id:      t.short_id,
        name:          t.name,
        short_name:    t.short_name,
        logo:          { type: t.logo_type, value: t.logo_value },
        color:         t.color,
        captain_photo: t.captain_photo || '',
        bar_logo_mode: t.bar_logo_mode || 'auto',
        players: players.map(p => ({
          id:            p.id,
          name:          p.name,
          // D11 (B-BOWLER-NAME-FORMAT): pass through to Controller so it
          // can populate window.match.bowler from the broadcast-friendly
          // form when present.
          display_name:  p.display_name || '',
          role:          p.role,
          batting_order: p.batting_order,
          photo:         p.photo || '',
          tags:          parseTagsCol(p.tags),
          stats:         null,
        })),
      };
    }

    const [batTeam, bowlTeam] = await Promise.all([
      loadTeam(match.bat_team_id),
      loadTeam(match.bowl_team_id),
    ]);

    res.json({
      ok: true,
      seed: {
        matchId:         match.id,
        status:          match.status,
        maxOvers:        match.max_overs,
        overlayTemplate: match.overlay_template,
        tossWinner:      match.toss_winner,
        tossElection:    match.toss_election,
        // D7 (B-FIXTURE-AUTOSTAGE): surface fixture metadata so the
        // Controller can pre-fill matchStage / scheduled date instead
        // of leaving them blank on the setup screen.
        matchStage:      match.stage || '',
        scheduledDate:   match.scheduled_date || '',
        scheduledTime:   match.scheduled_time || '',
        roundNum:        match.round_num || 0,
        tournamentId:    match.tournament_id || null,
        seasonId:        match.season_id || null,
        batTeam,
        bowlTeam,
        fetchedAt:       new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// USERS / SCORERS
// ═════════════════════════════════════════════════════════════

router.get('/users', clubGuard, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE tenant_id=? ORDER BY created_at',
      [req.tenant.id]
    );
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', clubGuard, express.json(), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  const validRoles = ['scorer', 'admin'];
  const userRole = validRoles.includes(role) ? role : 'scorer';
  const emailNorm = email.toLowerCase().trim();

  try {
    const [[dupGlobal]] = await db.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1', [emailNorm]
    );
    if (dupGlobal) {
      return res.status(409).json({ error: 'That email is already registered on CricCast.' });
    }

    const bcrypt = require('bcryptjs');
    const hash   = await bcrypt.hash(password, 10);
    const id     = uuidv4();
    await db.query(
      'INSERT INTO users (id, tenant_id, email, password_hash, role, name) VALUES (?,?,?,?,?,?)',
      [id, req.tenant.id, emailNorm, hash, userRole, name.trim()]
    );
    res.json({ ok: true, id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with that email already exists in this club' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', clubGuard, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot remove your own account' });
  }
  try {
    const [[target]] = await db.query(
      'SELECT role FROM users WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (target.role === 'admin') {
      const [[{ adminCount }]] = await db.query(
        "SELECT COUNT(*) AS adminCount FROM users WHERE tenant_id=? AND role='admin'",
        [req.tenant.id]
      );
      if (adminCount <= 1) {
        return res.status(400).json({
          error: 'Cannot remove the last admin of this club. Promote another user to admin first.',
        });
      }
    }

    const [result] = await db.query(
      'DELETE FROM users WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// DASHBOARD SUMMARY
// ═════════════════════════════════════════════════════════════

router.get('/summary', scorerGuard, async (req, res) => {
  try {
    const [[teamsRow]]   = await db.query('SELECT COUNT(*) AS c FROM teams   WHERE tenant_id=?', [req.tenant.id]);
    const [[playersRow]] = await db.query('SELECT COUNT(*) AS c FROM players WHERE tenant_id=?', [req.tenant.id]);
    const [[liveRow]]    = await db.query("SELECT COUNT(*) AS c FROM matches WHERE tenant_id=? AND status='live'",     [req.tenant.id]);
    const [[totalRow]]   = await db.query("SELECT COUNT(*) AS c FROM matches WHERE tenant_id=? AND status='finished'", [req.tenant.id]);
    const [[usersRow]]   = await db.query('SELECT COUNT(*) AS c FROM users   WHERE tenant_id=?', [req.tenant.id]);

    const [recent] = await db.query(
      `SELECT m.id, m.status, m.created_at, m.overlay_template,
              t1.name AS bat_team, t2.name AS bowl_team
       FROM matches m
       LEFT JOIN teams t1 ON t1.short_id=m.bat_team_id  AND t1.tenant_id=m.tenant_id
       LEFT JOIN teams t2 ON t2.short_id=m.bowl_team_id AND t2.tenant_id=m.tenant_id
       WHERE m.tenant_id=?
       ORDER BY m.created_at DESC LIMIT 5`,
      [req.tenant.id]
    );

    res.json({
      ok: true,
      tenant: { name: req.tenant.name, plan: req.tenant.plan, slug: req.tenant.slug },
      stats: {
        teams:           teamsRow.c,
        players:         playersRow.c,
        liveMatches:     liveRow.c,
        finishedMatches: totalRow.c,
        users:           usersRow.c,
        maxTeams:        req.tenant.max_teams,
        maxMatches:      req.tenant.max_matches,
      },
      recentMatches: recent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// PHASE 4 — QUOTA + UPGRADE
// ═════════════════════════════════════════════════════════════

const { getQuotaSummary } = require('../middleware/quotaCheck');

router.get('/quota', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const summary = await getQuotaSummary(req.user.tenant_id);
    const [[tenant]] = await db.query(
      'SELECT plan, max_matches, max_teams FROM tenants WHERE id = ?', [req.user.tenant_id]
    );
    res.json({
      ok: true,
      plan:    tenant.plan,
      matches: { used: summary.matchCount, max: tenant.max_matches },
      teams:   { used: summary.teamCount,  max: tenant.max_teams   },
    });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/upgrade-request', requireAuth, requireRole('admin'), express.json(), async (req, res) => {
  const { message } = req.body || {};
  try {
    const [[existing]] = await db.query(
      `SELECT id FROM upgrade_requests WHERE tenant_id = ? AND status = 'pending'`,
      [req.user.tenant_id]
    );
    if (existing) {
      return res.status(409).json({ ok: false, error: 'You already have a pending upgrade request.' });
    }
    await db.query(
      `INSERT INTO upgrade_requests (tenant_id, requested_by, message) VALUES (?, ?, ?)`,
      [req.user.tenant_id, req.user.id, message || null]
    );
    const log = require('../lib/logger');
    log.info('UPGRADE', 'Request submitted', { tenant: req.user.tenant_id });
    res.json({ ok: true, message: 'Upgrade request submitted. We will review and contact you within 24 hours.' });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
