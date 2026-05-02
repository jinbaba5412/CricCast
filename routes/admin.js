'use strict';

const express = require('express');
const db      = require('../db/connection');
const { requireSaasAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireSaasAdmin);

router.get('/', async (req, res) => {
  try {
    const [[{ tenantCount }]] = await db.query('SELECT COUNT(*) AS tenantCount FROM tenants');
    const [[{ matchCount  }]] = await db.query('SELECT COUNT(*) AS matchCount  FROM matches');
    const [[{ ballCount   }]] = await db.query('SELECT COUNT(*) AS ballCount   FROM ball_events');
    const [tenants] = await db.query(`
      SELECT t.id, t.slug, t.name, t.plan, t.max_matches, t.max_teams, t.created_at,
             COUNT(DISTINCT u.id) AS user_count,
             COUNT(DISTINCT m.id) AS match_count
      FROM tenants t
      LEFT JOIN users   u ON u.tenant_id = t.id
      LEFT JOIN matches m ON m.tenant_id = t.id
      GROUP BY t.id ORDER BY t.created_at DESC
    `);
    res.json({ ok: true, stats: { tenantCount, matchCount, ballCount }, tenants });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.get('/tenant/:id', async (req, res) => {
  try {
    const [[tenant]] = await db.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ ok: false, error: 'Tenant not found' });
    const [users]   = await db.query('SELECT id, email, role, created_at FROM users WHERE tenant_id = ?', [tenant.id]);
    const [matches] = await db.query(
      'SELECT id, bat_team_id, bowl_team_id, status, max_overs, created_at FROM matches WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20',
      [tenant.id]
    );
    res.json({ ok: true, tenant, users, matches });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.patch('/tenant/:id', async (req, res) => {
  const { plan, max_matches, max_teams } = req.body || {};
  const allowed = {};
  // Plan — whitelist valid values
  if (plan !== undefined && plan !== null && plan !== '') {
    if (plan !== 'free' && plan !== 'pro') return res.status(400).json({ ok: false, error: 'Plan must be "free" or "pro"' });
    allowed.plan = plan;
  }
  // Numeric limits — accept only positive integers, skip if absent/empty
  if (max_matches !== undefined && max_matches !== null && max_matches !== '') {
    const v = parseInt(max_matches, 10);
    if (isNaN(v) || v < 1) return res.status(400).json({ ok: false, error: 'max_matches must be a positive integer' });
    allowed.max_matches = v;
  }
  if (max_teams !== undefined && max_teams !== null && max_teams !== '') {
    const v = parseInt(max_teams, 10);
    if (isNaN(v) || v < 1) return res.status(400).json({ ok: false, error: 'max_teams must be a positive integer' });
    allowed.max_teams = v;
  }
  if (!Object.keys(allowed).length) return res.status(400).json({ ok: false, error: 'No valid fields to update' });
  try {
    const setClauses = Object.keys(allowed).map(k => `${k} = ?`).join(', ');
    await db.query(`UPDATE tenants SET ${setClauses} WHERE id = ?`, [...Object.values(allowed), req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.delete('/tenant/:id', async (req, res) => {
  try {
    const [[tenant]] = await db.query('SELECT slug FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ ok: false, error: 'Not found' });

    await db.query('DELETE FROM tenants WHERE id = ?', [req.params.id]);

    // BUG FIXED (M3): previously the DB row was dropped (with ON DELETE
    // CASCADE across users/teams/matches/players/ball_events) but the
    // tenant's per-slug directories on disk were left behind forever.
    // Over time these accumulate and can leak old uploads/score data.
    // Clean both directories now, with a slug sanity-check to prevent
    // accidental traversal (e.g. slug='../..').
    const fs   = require('fs');
    const path = require('path');
    const slug = tenant.slug || '';
    const safe = /^[a-z0-9-]{3,30}$/.test(slug);
    if (safe) {
      for (const base of ['criccast_data', 'criccast_uploads']) {
        const dir = path.join(__dirname, '..', base, slug);
        try {
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        } catch (e) {
          console.error('[admin] cleanup failed for', dir, ':', e.message);
        }
      }
    }

    const log = require('../lib/logger');
    log.info('ADMIN', 'Tenant deleted', { slug: tenant.slug, id: req.params.id, files_cleaned: safe });
    res.json({ ok: true, deleted: tenant.slug });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.get('/analytics', async (req, res) => {
  try {
    const [dailySignups]  = await db.query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS new_tenants
      FROM tenants WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY day ORDER BY day ASC
    `);
    const [dailyBalls]    = await db.query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS balls_bowled
      FROM ball_events WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY day ORDER BY day ASC
    `);
    const [[{ count: activeMatches }]] = await db.query(
      `SELECT COUNT(*) AS count FROM matches WHERE status = 'live'`
    );
    const [snapshots] = await db.query(`
      SELECT snapshot_date, tenant_count, active_matches, balls_today, new_tenants
      FROM analytics_snapshots ORDER BY snapshot_date DESC LIMIT 30
    `).catch(() => [[]]);
    res.json({ ok: true, dailySignups, dailyBalls, activeMatches, snapshots });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.get('/upgrade-requests', async (req, res) => {
  try {
    const [requests] = await db.query(`
      SELECT ur.id, ur.status, ur.message, ur.created_at,
             t.slug AS tenant_slug, t.name AS tenant_name, t.plan AS current_plan,
             u.email AS requested_by_email
      FROM upgrade_requests ur
      JOIN tenants t ON t.id = ur.tenant_id
      JOIN users   u ON u.id = ur.requested_by
      ORDER BY ur.created_at DESC
    `);
    res.json({ ok: true, requests });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/upgrade-requests/:id/approve', express.json(), async (req, res) => {
  // IMPROVED (L3): previously this hardcoded plan='pro', max_matches=20,
  // max_teams=50 with no flexibility. Now accepts optional plan, max_matches,
  // max_teams from the request body and falls back to the old pro-plan
  // defaults for backwards compatibility. Values are whitelisted/clamped.
  const body = req.body || {};
  const plan        = (body.plan === 'free' || body.plan === 'pro') ? body.plan : 'pro';
  const maxMatches  = Math.max(1, Math.min(1000, parseInt(body.max_matches, 10) || 20));
  const maxTeams    = Math.max(1, Math.min(1000, parseInt(body.max_teams,   10) || 50));

  try {
    const [[row]] = await db.query('SELECT tenant_id FROM upgrade_requests WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Request not found' });
    await db.query(
      `UPDATE tenants SET plan=?, max_matches=?, max_teams=? WHERE id=?`,
      [plan, maxMatches, maxTeams, row.tenant_id]
    );
    await db.query(
      `UPDATE upgrade_requests SET status='approved', resolved_at=NOW() WHERE id=?`,
      [req.params.id]
    );
    res.json({ ok: true, applied: { plan, max_matches: maxMatches, max_teams: maxTeams } });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/upgrade-requests/:id/reject', async (req, res) => {
  try {
    await db.query(`UPDATE upgrade_requests SET status='rejected', resolved_at=NOW() WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /admin/api/me — returns the logged-in saas admin's email for display in the panel
router.get('/me', (req, res) => {
  res.json({ ok: true, email: req.session?.saasAdmin?.email || '' });
});

module.exports = router;
