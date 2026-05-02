'use strict';

/**
 * CricCast — Tournament / Season / Group routes.
 *
 * Layer: L1 (server API) — depends only on L0 (schema).
 * Consumers (L2+): fixture generator, Controller scheduled-matches bar,
 * points table, progression engine.
 *
 * All routes are admin-only and tenant-scoped.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const { requireAuth, requireRole, requireTenantMatch } = require('../middleware/auth');

const router = express.Router();
const clubGuard   = [requireAuth, requireRole('admin'), requireTenantMatch];
const scorerGuard = [requireAuth, requireTenantMatch];

// ═════════════════════════════════════════════════════════════
// TOURNAMENTS
// ═════════════════════════════════════════════════════════════

router.get('/tournaments', scorerGuard, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.name, t.format, t.current_season, t.created_at,
              (SELECT COUNT(*) FROM seasons  s WHERE s.tournament_id = t.id) AS season_count,
              (SELECT COUNT(*) FROM matches  m WHERE m.tournament_id = t.id) AS match_count
         FROM tournaments t
        WHERE t.tenant_id = ?
        ORDER BY t.created_at DESC`,
      [req.tenant.id]
    );
    res.json({ ok: true, tournaments: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tournaments', clubGuard, express.json(), async (req, res) => {
  const { name, format } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const fmt = ['league', 'knockout', 'hybrid'].includes(format) ? format : 'league';

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const tId = uuidv4();
    await conn.query(
      `INSERT INTO tournaments (id, tenant_id, name, format, current_season)
       VALUES (?,?,?,?,1)`,
      [tId, req.tenant.id, name.trim(), fmt]
    );
    // Create Season 1 automatically — tournaments without seasons are a footgun.
    const sId = uuidv4();
    await conn.query(
      `INSERT INTO seasons (id, tenant_id, tournament_id, season_number, status)
       VALUES (?,?,?,?, 'active')`,
      [sId, req.tenant.id, tId, 1]
    );
    await conn.commit();
    res.json({ ok: true, id: tId, seasonId: sId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.put('/tournaments/:id', clubGuard, express.json(), async (req, res) => {
  const { name, format } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const fmt = ['league', 'knockout', 'hybrid'].includes(format) ? format : null;
  try {
    const fields = ['name = ?'];
    const vals = [name.trim()];
    if (fmt) { fields.push('format = ?'); vals.push(fmt); }
    vals.push(req.params.id, req.tenant.id);
    const [r] = await db.query(
      `UPDATE tournaments SET ${fields.join(', ')} WHERE id=? AND tenant_id=?`,
      vals
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Tournament not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/tournaments/:id', clubGuard, async (req, res) => {
  try {
    const [r] = await db.query(
      'DELETE FROM tournaments WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Tournament not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════
// SEASONS
// ═════════════════════════════════════════════════════════════

router.get('/tournaments/:tid/seasons', scorerGuard, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS match_count
         FROM seasons s
        WHERE s.tenant_id = ? AND s.tournament_id = ?
        ORDER BY s.season_number DESC`,
      [req.tenant.id, req.params.tid]
    );
    res.json({ ok: true, seasons: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/tournaments/:tid/seasons', clubGuard, express.json(), async (req, res) => {
  const { name, startsOn, endsOn } = req.body || {};
  try {
    // Verify tournament belongs to this tenant before creating the season.
    const [[t]] = await db.query(
      'SELECT id, current_season FROM tournaments WHERE id=? AND tenant_id=?',
      [req.params.tid, req.tenant.id]
    );
    if (!t) return res.status(404).json({ error: 'Tournament not found' });

    const nextNum = (t.current_season || 0) + 1;
    const sId = uuidv4();
    await db.query(
      `INSERT INTO seasons (id, tenant_id, tournament_id, season_number, name,
                            status, starts_on, ends_on)
       VALUES (?,?,?,?,?, 'upcoming', ?, ?)`,
      [sId, req.tenant.id, req.params.tid, nextNum,
       name && name.trim() ? name.trim() : null,
       startsOn || null, endsOn || null]
    );
    await db.query(
      'UPDATE tournaments SET current_season=? WHERE id=?', [nextNum, req.params.tid]
    );
    res.json({ ok: true, id: sId, seasonNumber: nextNum });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/seasons/:id', clubGuard, express.json(), async (req, res) => {
  const { name, status, startsOn, endsOn } = req.body || {};
  const validStatus = ['upcoming', 'active', 'completed', 'archived'];
  const fields = [], vals = [];
  if (name !== undefined)  { fields.push('name = ?');      vals.push(name ? name.trim() : null); }
  if (status !== undefined && validStatus.includes(status)) { fields.push('status = ?');    vals.push(status); }
  if (startsOn !== undefined) { fields.push('starts_on = ?'); vals.push(startsOn || null); }
  if (endsOn   !== undefined) { fields.push('ends_on = ?');   vals.push(endsOn   || null); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id, req.tenant.id);
  try {
    const [r] = await db.query(
      `UPDATE seasons SET ${fields.join(', ')} WHERE id=? AND tenant_id=?`,
      vals
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Season not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/seasons/:id', clubGuard, async (req, res) => {
  try {
    const [r] = await db.query(
      'DELETE FROM seasons WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Season not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════
// GROUPS (within a season)
// ═════════════════════════════════════════════════════════════

router.get('/seasons/:sid/groups', scorerGuard, async (req, res) => {
  try {
    const [groups] = await db.query(
      `SELECT g.id, g.name, g.created_at,
              (SELECT COUNT(*) FROM group_teams gt WHERE gt.group_id = g.id) AS team_count
         FROM \`groups\` g
        WHERE g.tenant_id = ? AND g.season_id = ?
        ORDER BY g.name`,
      [req.tenant.id, req.params.sid]
    );
    // Pull team details for each group in one query.
    if (!groups.length) return res.json({ ok: true, groups: [] });
    const ids = groups.map(g => g.id);
    const [members] = await db.query(
      `SELECT gt.group_id, gt.team_id, gt.seed, t.name, t.short_id
         FROM group_teams gt
         JOIN teams t ON t.id = gt.team_id
        WHERE gt.group_id IN (?)
        ORDER BY gt.seed, t.name`,
      [ids]
    );
    const byGroup = new Map();
    for (const m of members) {
      if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, []);
      byGroup.get(m.group_id).push({
        id: m.team_id, name: m.name, short_id: m.short_id, seed: m.seed,
      });
    }
    const out = groups.map(g => ({ ...g, teams: byGroup.get(g.id) || [] }));
    res.json({ ok: true, groups: out });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/seasons/:sid/groups', clubGuard, express.json(), async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const [[s]] = await db.query(
      'SELECT id FROM seasons WHERE id=? AND tenant_id=?',
      [req.params.sid, req.tenant.id]
    );
    if (!s) return res.status(404).json({ error: 'Season not found' });

    const gId = uuidv4();
    await db.query(
      `INSERT INTO \`groups\` (id, tenant_id, season_id, name)
       VALUES (?,?,?,?)`,
      [gId, req.tenant.id, req.params.sid, name.trim()]
    );
    res.json({ ok: true, id: gId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A group with that name already exists in this season' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/groups/:id', clubGuard, async (req, res) => {
  try {
    const [r] = await db.query(
      'DELETE FROM `groups` WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * PUT /groups/:id/teams  — replace the team list for a group in one call.
 * Body: { teams: [{ teamId, seed }] }
 * Transactional: old rows cleared, new rows inserted; on any error rolls back.
 */
router.put('/groups/:id/teams', clubGuard, express.json(), async (req, res) => {
  const { teams } = req.body || {};
  if (!Array.isArray(teams)) return res.status(400).json({ error: 'teams must be an array' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[g]] = await conn.query(
      'SELECT id FROM `groups` WHERE id=? AND tenant_id=?',
      [req.params.id, req.tenant.id]
    );
    if (!g) {
      await conn.rollback();
      return res.status(404).json({ error: 'Group not found' });
    }

    // Validate every incoming team_id belongs to this tenant.
    const teamIds = teams.map(t => t.teamId).filter(Boolean);
    if (teamIds.length) {
      const [rows] = await conn.query(
        'SELECT id FROM teams WHERE tenant_id=? AND id IN (?)',
        [req.tenant.id, teamIds]
      );
      if (rows.length !== teamIds.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'One or more team IDs are invalid' });
      }
    }

    await conn.query('DELETE FROM group_teams WHERE group_id = ?', [req.params.id]);
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      await conn.query(
        'INSERT INTO group_teams (group_id, team_id, seed) VALUES (?,?,?)',
        [req.params.id, t.teamId, Number.isFinite(+t.seed) ? +t.seed : i + 1]
      );
    }
    await conn.commit();
    res.json({ ok: true, count: teams.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ═════════════════════════════════════════════════════════════
// FIXTURE GENERATION (L2)
// ═════════════════════════════════════════════════════════════

const gen = require('../lib/fixtureGenerator');

/**
 * POST /api/club/seasons/:sid/fixtures/generate
 *
 * Body:
 *   { mode: 'round_robin' | 'knockout' | 'hybrid',
 *     groupId: <uuid>,                 // required for round_robin
 *     doubleRound: bool,               // round_robin only (home+away)
 *     teamIds: [<teamId>, ...],        // required for knockout (seeding order)
 *     startDate: 'YYYY-MM-DD',         // optional — auto-schedules
 *     daysBetweenRounds: 7,            // optional — default 7
 *     overlayTemplate: 'Scoreboard',
 *     maxOvers: 20 }
 *
 * Fixtures already in `matches` for this season/group that are NOT
 * 'scheduled' (i.e. already ready/live/completed) are LEFT UNTOUCHED.
 * Any existing 'scheduled' rows for this group are deleted and replaced.
 */
router.post('/seasons/:sid/fixtures/generate', clubGuard, express.json(), async (req, res) => {
  const body = req.body || {};
  const mode = ['round_robin', 'knockout', 'hybrid'].includes(body.mode) ? body.mode : null;
  if (!mode) return res.status(400).json({ error: 'mode must be round_robin | knockout | hybrid' });

  const overlayTemplate = typeof body.overlayTemplate === 'string' ? body.overlayTemplate : 'Scoreboard';
  const maxOvers        = parseInt(body.maxOvers, 10) || 20;
  const daysBetween     = Math.max(0, parseInt(body.daysBetweenRounds, 10) || 7);
  const startDate       = body.startDate && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) ? body.startDate : null;
  const doubleRound     = !!body.doubleRound;

  try {
    // ── Validate season ownership ─────────────────────────────
    const [[season]] = await db.query(
      'SELECT s.id, s.tournament_id, t.tenant_id FROM seasons s JOIN tournaments t ON t.id = s.tournament_id WHERE s.id=? AND s.tenant_id=?',
      [req.params.sid, req.tenant.id]
    );
    if (!season) return res.status(404).json({ error: 'Season not found' });

    // ── Collect teams ─────────────────────────────────────────
    let planned = [];
    const groupShortIdMap = new Map(); // short_id -> team_id (for linkage)

    async function resolveTeams(teamIdArray) {
      if (!teamIdArray.length) return [];
      const [rows] = await db.query(
        'SELECT id, short_id FROM teams WHERE tenant_id=? AND id IN (?)',
        [req.tenant.id, teamIdArray]
      );
      if (rows.length !== teamIdArray.length) throw new Error('One or more team IDs are invalid');
      for (const r of rows) groupShortIdMap.set(r.short_id, r.id);
      // preserve caller's order (for knockout seeding)
      const byId = new Map(rows.map(r => [r.id, r.short_id]));
      return teamIdArray.map(id => byId.get(id));
    }

    if (mode === 'round_robin') {
      if (!body.groupId) return res.status(400).json({ error: 'groupId is required for round_robin' });
      const [[g]] = await db.query(
        'SELECT id, season_id FROM `groups` WHERE id=? AND tenant_id=?',
        [body.groupId, req.tenant.id]
      );
      if (!g) return res.status(404).json({ error: 'Group not found' });
      if (g.season_id !== req.params.sid) {
        return res.status(400).json({ error: 'Group does not belong to this season' });
      }
      const [gTeams] = await db.query(
        `SELECT gt.team_id, t.short_id, gt.seed
           FROM group_teams gt JOIN teams t ON t.id = gt.team_id
          WHERE gt.group_id = ? ORDER BY gt.seed, t.name`,
        [body.groupId]
      );
      if (gTeams.length < 2) return res.status(400).json({ error: 'Group must have at least 2 teams' });
      for (const t of gTeams) groupShortIdMap.set(t.short_id, t.team_id);
      planned = gen.generateRoundRobin(gTeams.map(t => t.short_id), { stage: 'group', doubleRound });
      planned.forEach(m => { m.group_id = body.groupId; });
    }

    else if (mode === 'knockout') {
      if (!Array.isArray(body.teamIds) || body.teamIds.length < 2) {
        return res.status(400).json({ error: 'teamIds (≥2) required for knockout' });
      }
      const seededShortIds = await resolveTeams(body.teamIds);
      planned = gen.generateKnockout(seededShortIds);
    }

    else if (mode === 'hybrid') {
      // Hybrid: generate league stage now from all groups in this season.
      // Knockout phase is generated later by a separate call after standings
      // are known (POST /seasons/:sid/fixtures/knockout-from-standings — L5).
      const [groups] = await db.query(
        'SELECT id FROM `groups` WHERE season_id=? AND tenant_id=?',
        [req.params.sid, req.tenant.id]
      );
      if (!groups.length) return res.status(400).json({ error: 'Create at least one group before generating hybrid fixtures' });
      const bundle = [];
      for (const gr of groups) {
        const [teamsOfG] = await db.query(
          `SELECT gt.team_id, t.short_id, gt.seed
             FROM group_teams gt JOIN teams t ON t.id = gt.team_id
            WHERE gt.group_id = ? ORDER BY gt.seed, t.name`,
          [gr.id]
        );
        if (teamsOfG.length < 2) continue;
        for (const t of teamsOfG) groupShortIdMap.set(t.short_id, t.team_id);
        bundle.push({ group_id: gr.id, teamIds: teamsOfG.map(t => t.short_id) });
      }
      planned = gen.generateHybridLeagueStage(bundle, { doubleRound });
    }

    if (!planned.length) return res.status(400).json({ error: 'Nothing to generate' });

    // ── Clear previous *scheduled* rows for this season (optionally group) ──
    // Leaves any ready/live/completed fixtures alone to avoid wiping real data.
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (mode === 'round_robin') {
        await conn.query(
          `DELETE FROM matches WHERE tenant_id=? AND season_id=? AND group_id=? AND status='scheduled'`,
          [req.tenant.id, req.params.sid, body.groupId]
        );
      } else {
        await conn.query(
          `DELETE FROM matches WHERE tenant_id=? AND season_id=? AND status='scheduled'`,
          [req.tenant.id, req.params.sid]
        );
      }

      // ── Assign UUIDs + wire next_match_id for knockout/hybrid ──
      const { v4: uuidv4 } = require('uuid');
      for (const m of planned) m._id = uuidv4();
      // Build index by (round_index, bracket_slot) for knockout linkage.
      const byRoundSlot = new Map();
      for (const m of planned) {
        if (m.round_index !== undefined && m.bracket_slot !== undefined) {
          byRoundSlot.set(m.round_index + ':' + m.bracket_slot, m._id);
        }
      }
      for (const m of planned) {
        if (m.next_bracket_slot !== null && m.round_index !== undefined) {
          const parentKey = (m.round_index + 1) + ':' + m.next_bracket_slot;
          m._next_match_id = byRoundSlot.get(parentKey) || null;
          // slot mapping: pair p feeds into slot (2*floor(p/2) + p%2) of next
          // round's `currentSlots` → but in our final data model, it's simpler
          // to record 'bat' for even p and 'bowl' for odd p.
          m._next_slot = (m.bracket_slot % 2 === 0) ? 'bat' : 'bowl';
        }
      }

      // ── Schedule dates: one round per `daysBetween` days from startDate ──
      const rounds = planned.map(m => m.round_num);
      const maxRound = rounds.length ? Math.max(...rounds) : 1;
      function computeDate(roundNum) {
        if (!startDate) return null;
        const base = new Date(startDate + 'T00:00:00Z');
        base.setUTCDate(base.getUTCDate() + (roundNum - 1) * daysBetween);
        return base.toISOString().slice(0, 10);
      }

      // ── INSERT every row ──
      for (const m of planned) {
        const sched = computeDate(m.round_num);
        const status = m.is_bye ? 'completed' : (m.status || 'scheduled');
        const finishedAt = m.is_bye ? new Date() : null;
        await conn.query(
          `INSERT INTO matches
             (id, tenant_id, tournament_id, season_id, group_id, stage,
              scheduled_date, scheduled_time, round_num, is_bye,
              next_match_id, next_slot, winner_team_id, result_type,
              bat_team_id, bowl_team_id, max_overs, status,
              overlay_template, finished_at)
           VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?)`,
          [
            m._id, req.tenant.id, season.tournament_id, req.params.sid,
            m.group_id || null, m.stage,
            sched, null, m.round_num, m.is_bye ? 1 : 0,
            m._next_match_id || null, m._next_slot || null,
            m.winner_team_id || null, m.result_type || 'normal',
            // For "TBD" knockout matches with no teams yet, we write the
            // placeholder "TBD" marker. The bracket wiring upstream keeps
            // next_match_id so later rounds can be resolved.
            //
            // BUG FIXED: bye rows previously sent NULL for bowl_team_id,
            // but matches.bowl_team_id is declared NOT NULL in schema.sql
            // → INSERT failed with "Column 'bowl_team_id' cannot be null"
            // and the entire fixture generation rolled back. We now write
            // a sentinel 'BYE' short_id instead. The fixture-list query
            // and bracket logic treat is_bye=1 as the source of truth, so
            // the value is purely a placeholder for the NOT NULL slot.
            m.bat_short_id || 'TBD',
            m.bowl_short_id || (m.is_bye ? 'BYE' : 'TBD'),
            maxOvers, status, overlayTemplate, finishedAt,
          ]
        );
      }

      await conn.commit();

      // League byes: if a bye was auto-completed and this is a league format,
      // the match row already carries winner_team_id + result_type='bye' +
      // status='completed'. Points-table logic (Session 5) will treat those
      // as +1 W / +2 Pts without affecting NRR.

      res.json({
        ok: true,
        mode,
        maxRound,
        fixtures: planned.length,
        byes: planned.filter(m => m.is_bye).length,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/club/seasons/:sid/fixtures
 * Lists matches grouped by round for display in the Dashboard fixture view.
 */
router.get('/seasons/:sid/fixtures', scorerGuard, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT m.id, m.round_num, m.stage, m.scheduled_date, m.scheduled_time,
              m.status, m.is_bye, m.result_type, m.winner_team_id,
              m.bat_team_id, m.bowl_team_id, m.group_id,
              t1.name AS bat_name, t2.name AS bowl_name,
              g.name AS group_name
         FROM matches m
         LEFT JOIN teams t1 ON t1.short_id = m.bat_team_id AND t1.tenant_id = m.tenant_id
         LEFT JOIN teams t2 ON t2.short_id = m.bowl_team_id AND t2.tenant_id = m.tenant_id
         LEFT JOIN \`groups\` g ON g.id = m.group_id
        WHERE m.tenant_id = ? AND m.season_id = ?
        ORDER BY m.round_num, m.stage, m.scheduled_date, m.id`,
      [req.tenant.id, req.params.sid]
    );
    res.json({ ok: true, fixtures: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/club/scheduled-matches
 * Returns matches in 'scheduled' or 'ready' state for this tenant, ordered
 * by scheduled date. Used by the Controller header dropdown.
 */
router.get('/scheduled-matches', scorerGuard, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT m.id, m.bat_team_id, m.bowl_team_id, m.scheduled_date,
              m.scheduled_time, m.stage, m.status, m.overlay_template,
              m.max_overs, m.round_num,
              t1.name AS bat_team_name, t2.name AS bowl_team_name,
              tr.name AS tournament_name, s.season_number
         FROM matches m
         LEFT JOIN teams       t1 ON t1.short_id = m.bat_team_id  AND t1.tenant_id = m.tenant_id
         LEFT JOIN teams       t2 ON t2.short_id = m.bowl_team_id AND t2.tenant_id = m.tenant_id
         LEFT JOIN tournaments tr ON tr.id = m.tournament_id
         LEFT JOIN seasons     s  ON s.id  = m.season_id
        WHERE m.tenant_id = ?
          AND m.status IN ('scheduled','ready','setup')
          AND m.is_bye = 0
        ORDER BY
          -- N4 — drop dead 'live' branch; WHERE excludes it so this
          -- ORDER BY case never matched. Ready/setup take priority over
          -- merely-scheduled (no fixed start datetime).
          CASE m.status WHEN 'ready' THEN 0 WHEN 'setup' THEN 0 ELSE 1 END,
          COALESCE(m.scheduled_date, m.created_at),
          m.scheduled_time,
          m.created_at
        LIMIT 100`,
      [req.tenant.id]
    );
    res.json({ ok: true, matches: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
