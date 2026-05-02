'use strict';

/**
 * CricCast — Tenant + per-match settings.
 *
 * Layer: L1. Feeds L3 (gameplay enforcement) and L4 (powerplay / free hit /
 * super over engines). Effective config for any match is computed by merging
 * match_settings ON TOP OF tenant_settings — NULL values in match_settings
 * fall back to the tenant default.
 */

const express = require('express');
const db = require('../db/connection');
const { requireAuth, requireRole, requireTenantMatch } = require('../middleware/auth');

const router = express.Router();
const clubGuard   = [requireAuth, requireRole('admin'), requireTenantMatch];
const scorerGuard = [requireAuth, requireTenantMatch];

const BOOL_FIELDS = [
  'super_ball_enabled',
  'powerplay_enabled',
  'free_hit_enabled',
  'penalty_runs_enabled',
  'tie_allowed',
];
const POWERPLAY_MODES = ['auto', 'manual'];

function toBool01(v) {
  if (v === true || v === 1 || v === '1' || v === 'true') return 1;
  if (v === false || v === 0 || v === '0' || v === 'false') return 0;
  return null;
}

// ─── Effective-settings helper (shared with controller/match APIs) ────
async function loadEffectiveSettings(tenantId, matchId) {
  const [[tenant]] = await db.query(
    'SELECT * FROM tenant_settings WHERE tenant_id=?', [tenantId]
  );
  const base = tenant || {
    super_ball_enabled: 1, powerplay_enabled: 1, powerplay_mode: 'auto',
    free_hit_enabled: 1, penalty_runs_enabled: 1, tie_allowed: 0,
    custom_overs_default: 20,
  };

  let overrides = null;
  if (matchId) {
    const [[row]] = await db.query(
      'SELECT * FROM match_settings WHERE match_id=? AND tenant_id=?',
      [matchId, tenantId]
    );
    overrides = row || null;
  }
  const pick = (k) => (overrides && overrides[k] != null) ? overrides[k] : base[k];

  return {
    super_ball_enabled:   !!pick('super_ball_enabled'),
    powerplay_enabled:    !!pick('powerplay_enabled'),
    powerplay_mode:       pick('powerplay_mode') || 'auto',
    free_hit_enabled:     !!pick('free_hit_enabled'),
    penalty_runs_enabled: !!pick('penalty_runs_enabled'),
    tie_allowed:          !!pick('tie_allowed'),
    custom_overs:         overrides && overrides.custom_overs != null
                            ? overrides.custom_overs
                            : base.custom_overs_default,
  };
}
// P3 — `module.exports.loadEffectiveSettings = ...` used to live here,
// but the bottom of the file does `module.exports = router` which
// overwrote the whole exports object and silently dropped the helper.
// Helper is now attached AFTER `module.exports = router` (see EOF) so
// any consumer (e.g. routes/club.js seed builders) gets the function.

// ═════════════════════════════════════════════════════════════
// TENANT DEFAULTS
// ═════════════════════════════════════════════════════════════

router.get('/settings', scorerGuard, async (req, res) => {
  try {
    const [[row]] = await db.query(
      'SELECT * FROM tenant_settings WHERE tenant_id=?', [req.tenant.id]
    );
    if (!row) {
      // First call — create defaults and return them.
      await db.query('INSERT IGNORE INTO tenant_settings (tenant_id) VALUES (?)', [req.tenant.id]);
      const [[fresh]] = await db.query(
        'SELECT * FROM tenant_settings WHERE tenant_id=?', [req.tenant.id]
      );
      return res.json({ ok: true, settings: fresh });
    }
    res.json({ ok: true, settings: row });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', clubGuard, express.json(), async (req, res) => {
  const body = req.body || {};
  const fields = [], vals = [];
  for (const k of BOOL_FIELDS) {
    if (body[k] !== undefined) {
      const v = toBool01(body[k]);
      if (v === null) return res.status(400).json({ error: `${k} must be boolean` });
      fields.push(`${k} = ?`); vals.push(v);
    }
  }
  if (body.powerplay_mode !== undefined) {
    if (!POWERPLAY_MODES.includes(body.powerplay_mode)) {
      return res.status(400).json({ error: 'powerplay_mode must be auto|manual' });
    }
    fields.push('powerplay_mode = ?'); vals.push(body.powerplay_mode);
  }
  if (body.custom_overs_default !== undefined) {
    const n = parseInt(body.custom_overs_default, 10);
    if (!Number.isFinite(n) || n < 1 || n > 90) {
      return res.status(400).json({ error: 'custom_overs_default must be 1..90' });
    }
    fields.push('custom_overs_default = ?'); vals.push(n);
  }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

  // Upsert.
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT IGNORE INTO tenant_settings (tenant_id) VALUES (?)', [req.tenant.id]);
    vals.push(req.tenant.id);
    await conn.query(`UPDATE tenant_settings SET ${fields.join(', ')} WHERE tenant_id=?`, vals);
    await conn.commit();
    const [[row]] = await db.query('SELECT * FROM tenant_settings WHERE tenant_id=?', [req.tenant.id]);
    res.json({ ok: true, settings: row });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ═════════════════════════════════════════════════════════════
// PER-MATCH OVERRIDES + EFFECTIVE VIEW
// ═════════════════════════════════════════════════════════════

router.get('/match/:id/settings', scorerGuard, async (req, res) => {
  try {
    // Authorise — match must belong to tenant.
    const [[m]] = await db.query(
      'SELECT id FROM matches WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (!m) return res.status(404).json({ error: 'Match not found' });
    const effective = await loadEffectiveSettings(req.tenant.id, req.params.id);
    const [[overrides]] = await db.query(
      'SELECT * FROM match_settings WHERE match_id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    res.json({ ok: true, overrides: overrides || null, effective });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/match/:id/settings', clubGuard, express.json(), async (req, res) => {
  const body = req.body || {};
  const cols = [], vals = [];
  for (const k of BOOL_FIELDS) {
    if (body[k] !== undefined) {
      const v = body[k] === null ? null : toBool01(body[k]);
      if (body[k] !== null && v === null) return res.status(400).json({ error: `${k} must be boolean or null` });
      cols.push(k); vals.push(v);
    }
  }
  if (body.powerplay_mode !== undefined) {
    if (body.powerplay_mode !== null && !POWERPLAY_MODES.includes(body.powerplay_mode)) {
      return res.status(400).json({ error: 'powerplay_mode must be auto|manual|null' });
    }
    cols.push('powerplay_mode'); vals.push(body.powerplay_mode);
  }
  if (body.custom_overs !== undefined) {
    if (body.custom_overs !== null) {
      const n = parseInt(body.custom_overs, 10);
      if (!Number.isFinite(n) || n < 1 || n > 90) {
        return res.status(400).json({ error: 'custom_overs must be 1..90' });
      }
      cols.push('custom_overs'); vals.push(n);
    } else {
      cols.push('custom_overs'); vals.push(null);
    }
  }

  try {
    // Authorise.
    const [[m]] = await db.query(
      'SELECT id FROM matches WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (!m) return res.status(404).json({ error: 'Match not found' });

    // Upsert via INSERT ... ON DUPLICATE KEY UPDATE.
    const insertCols = ['match_id', 'tenant_id', ...cols];
    const insertVals = [req.params.id, req.tenant.id, ...vals];
    const updateClause = cols.length
      ? cols.map(c => `${c} = VALUES(${c})`).join(', ')
      : 'match_id = match_id'; // no-op
    const placeholders = insertCols.map(() => '?').join(',');
    await db.query(
      `INSERT INTO match_settings (${insertCols.join(',')}) VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updateClause}`,
      insertVals
    );
    const effective = await loadEffectiveSettings(req.tenant.id, req.params.id);
    res.json({ ok: true, effective });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
// P3 — re-attach the helper AFTER the router export so it survives
// (the previous `module.exports = router` would otherwise wipe it).
module.exports.loadEffectiveSettings = loadEffectiveSettings;
