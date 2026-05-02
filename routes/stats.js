'use strict';
/**
 * L5 — Read-only stats endpoints.
 *   GET /api/club/seasons/:sid/points-table          → standings + NRR
 *   GET /api/club/seasons/:sid/top-runs              → orderable leaderboard
 *   GET /api/club/seasons/:sid/top-wickets
 *   GET /api/club/tournaments/:tid/points-table      → current season
 *   GET /api/club/players/:id/stats                  → aggregated player
 *   GET /api/club/match/:id/snapshot                 → frozen scorecard
 *   GET /api/club/match/:id/scorecard                → same + ball-by-ball
 *
 * All tenant-scoped. Scorer role is enough (read).
 */

const express = require('express');
const db      = require('../db/connection');
const { requireAuth, requireTenantMatch } = require('../middleware/auth');

const router = express.Router();
const scorerGuard = [requireAuth, requireTenantMatch];

/** Ensure the season belongs to this tenant. */
async function ownsSeason(tenantId, sid) {
  const [rows] = await db.query(
    'SELECT id, tournament_id FROM seasons WHERE id=? AND tenant_id=?',
    [sid, tenantId]
  );
  return rows[0] || null;
}

async function ownsTournament(tenantId, tid) {
  const [rows] = await db.query(
    'SELECT id FROM tournaments WHERE id=? AND tenant_id=?', [tid, tenantId]
  );
  return rows[0] || null;
}

/* ── Points table ────────────────────────────────────────────────── */
router.get('/seasons/:sid/points-table', scorerGuard, async (req, res) => {
  try {
    if (!await ownsSeason(req.tenant.id, req.params.sid)) {
      return res.status(404).json({ error: 'Season not found' });
    }
    const [rows] = await db.query(
      `SELECT pt.*, t.name AS team_name, t.logo_type, t.logo_value, t.color
         FROM points_table pt
         LEFT JOIN teams t
           ON t.tenant_id = pt.tenant_id AND t.short_id = pt.team_short_id
        WHERE pt.tenant_id=? AND pt.season_id=?
        ORDER BY pt.points DESC, pt.nrr DESC, pt.wins DESC, pt.team_short_id ASC`,
      [req.tenant.id, req.params.sid]
    );
    res.json({ ok: true, table: rows });
  } catch (e) {
    console.error('[points-table]', e);
    res.status(500).json({ error: 'Failed to load points table' });
  }
});

router.get('/tournaments/:tid/points-table', scorerGuard, async (req, res) => {
  try {
    if (!await ownsTournament(req.tenant.id, req.params.tid)) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    // Default to the latest (highest season_number) season of this tournament.
    const [ss] = await db.query(
      `SELECT id FROM seasons WHERE tenant_id=? AND tournament_id=?
         ORDER BY season_number DESC LIMIT 1`,
      [req.tenant.id, req.params.tid]
    );
    if (!ss[0]) return res.json({ ok: true, table: [] });
    const [rows] = await db.query(
      `SELECT pt.*, t.name AS team_name, t.logo_type, t.logo_value, t.color
         FROM points_table pt
         LEFT JOIN teams t
           ON t.tenant_id = pt.tenant_id AND t.short_id = pt.team_short_id
        WHERE pt.tenant_id=? AND pt.season_id=?
        ORDER BY pt.points DESC, pt.nrr DESC, pt.wins DESC`,
      [req.tenant.id, ss[0].id]
    );
    res.json({ ok: true, season_id: ss[0].id, table: rows });
  } catch (e) {
    console.error('[tournament points-table]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

/* ── Leaderboards ────────────────────────────────────────────────── */
router.get('/seasons/:sid/top-runs', scorerGuard, async (req, res) => {
  try {
    if (!await ownsSeason(req.tenant.id, req.params.sid)) {
      return res.status(404).json({ error: 'Season not found' });
    }
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.team_id, t.name AS team_name, t.short_id AS team_short_id,
              SUM(pms.runs_scored) AS runs,
              SUM(pms.balls_faced) AS balls,
              SUM(pms.fours)       AS fours,
              SUM(pms.sixes)       AS sixes,
              COUNT(pms.match_id)  AS matches,
              SUM(pms.is_out)      AS dismissals
         FROM player_match_stats pms
         JOIN players p ON p.id = pms.player_id
         JOIN matches m ON m.id = pms.match_id
         LEFT JOIN teams t ON t.id = pms.team_id
        WHERE pms.tenant_id=? AND m.season_id=?
        GROUP BY p.id
        ORDER BY runs DESC, sixes DESC, fours DESC
        LIMIT ?`,
      [req.tenant.id, req.params.sid, limit]
    );
    res.json({ ok: true, leaders: rows });
  } catch (e) {
    console.error('[top-runs]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/seasons/:sid/top-wickets', scorerGuard, async (req, res) => {
  try {
    if (!await ownsSeason(req.tenant.id, req.params.sid)) {
      return res.status(404).json({ error: 'Season not found' });
    }
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.team_id, t.name AS team_name, t.short_id AS team_short_id,
              SUM(pms.wickets_taken) AS wickets,
              SUM(pms.runs_conceded) AS runs_conceded,
              SUM(pms.overs_bowled)  AS overs,
              COUNT(pms.match_id)    AS matches
         FROM player_match_stats pms
         JOIN players p ON p.id = pms.player_id
         JOIN matches m ON m.id = pms.match_id
         LEFT JOIN teams t ON t.id = pms.team_id
        WHERE pms.tenant_id=? AND m.season_id=?
        GROUP BY p.id
        HAVING wickets > 0
        ORDER BY wickets DESC, runs_conceded ASC
        LIMIT ?`,
      [req.tenant.id, req.params.sid, limit]
    );
    res.json({ ok: true, leaders: rows });
  } catch (e) {
    console.error('[top-wickets]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

/* ── Per-player aggregated profile ───────────────────────────────── */
router.get('/players/:id/stats', scorerGuard, async (req, res) => {
  try {
    const playerId = req.params.id;
    // Ownership check via team→tenant join.
    const [[p]] = await db.query(
      `SELECT p.id, p.name, p.team_id, p.role, t.name AS team_name
         FROM players p JOIN teams t ON t.id = p.team_id
        WHERE p.id=? AND p.tenant_id=?`,
      [playerId, req.tenant.id]
    );
    if (!p) return res.status(404).json({ error: 'Player not found' });

    // Optional filters: ?tournamentId=&seasonId=
    const vals = [req.tenant.id, playerId];
    let extra  = '';
    if (req.query.seasonId) {
      extra += ' AND m.season_id = ?';
      vals.push(req.query.seasonId);
    }
    if (req.query.tournamentId) {
      extra += ' AND m.tournament_id = ?';
      vals.push(req.query.tournamentId);
    }

    const [[totals]] = await db.query(
      `SELECT COUNT(*) AS matches,
              SUM(pms.runs_scored) AS runs,
              SUM(pms.balls_faced) AS balls,
              SUM(pms.fours)       AS fours,
              SUM(pms.sixes)       AS sixes,
              SUM(pms.is_out)      AS outs,
              SUM(pms.overs_bowled) AS overs,
              SUM(pms.runs_conceded) AS conceded,
              SUM(pms.wickets_taken) AS wickets,
              SUM(pms.catches)       AS catches,
              SUM(pms.run_outs)      AS run_outs,
              SUM(pms.stumpings)     AS stumpings
         FROM player_match_stats pms
         JOIN matches m ON m.id = pms.match_id
        WHERE pms.tenant_id=? AND pms.player_id=?` + extra,
      vals
    );

    const [perMatch] = await db.query(
      `SELECT pms.match_id, pms.runs_scored, pms.balls_faced, pms.fours,
              pms.sixes, pms.is_out, pms.overs_bowled, pms.runs_conceded,
              pms.wickets_taken, pms.catches, pms.run_outs, pms.stumpings,
              m.finished_at, m.season_id, m.tournament_id
         FROM player_match_stats pms
         JOIN matches m ON m.id = pms.match_id
        WHERE pms.tenant_id=? AND pms.player_id=?` + extra + `
        ORDER BY m.finished_at DESC
        LIMIT 50`,
      vals
    );

    res.json({ ok: true, player: p, totals, per_match: perMatch });
  } catch (e) {
    console.error('[player stats]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

/* ── Completed match snapshot + scorecard ────────────────────────── */
router.get('/match/:id/snapshot', scorerGuard, async (req, res) => {
  try {
    const [[snap]] = await db.query(
      `SELECT ms.*, m.bat_team_id, m.bowl_team_id, m.max_overs,
              m.tournament_id, m.season_id, m.stage
         FROM match_snapshots ms
         JOIN matches m ON m.id = ms.match_id
        WHERE ms.match_id=? AND ms.tenant_id=?`,
      [req.params.id, req.tenant.id]
    );
    if (!snap) return res.status(404).json({ error: 'No snapshot (match not completed?)' });
    let parsed = null;
    try { parsed = JSON.parse(snap.snapshot); } catch {}
    res.json({
      ok: true,
      match_id: snap.match_id,
      winner:   snap.winner,
      win_desc: snap.win_desc,
      captured_at: snap.captured_at,
      meta: {
        bat_team_id:  snap.bat_team_id,
        bowl_team_id: snap.bowl_team_id,
        max_overs:    snap.max_overs,
        tournament_id: snap.tournament_id,
        season_id:     snap.season_id,
        stage:         snap.stage,
      },
      snapshot: parsed,
    });
  } catch (e) {
    console.error('[snapshot]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/match/:id/scorecard', scorerGuard, async (req, res) => {
  try {
    const [[snap]] = await db.query(
      `SELECT snapshot, winner, win_desc, captured_at
         FROM match_snapshots
        WHERE match_id=? AND tenant_id=?`,
      [req.params.id, req.tenant.id]
    );
    let parsed = null;
    if (snap && snap.snapshot) {
      try { parsed = JSON.parse(snap.snapshot); } catch {}
    }
    const [pms] = await db.query(
      `SELECT pms.*, p.name AS player_name, t.short_id AS team_short_id, t.name AS team_name
         FROM player_match_stats pms
         JOIN players p ON p.id = pms.player_id
         LEFT JOIN teams t ON t.id = pms.team_id
        WHERE pms.match_id=? AND pms.tenant_id=?
        ORDER BY pms.team_id, pms.runs_scored DESC`,
      [req.params.id, req.tenant.id]
    );
    res.json({
      ok: true,
      completed:   !!snap,
      winner:      snap && snap.winner,
      win_desc:    snap && snap.win_desc,
      captured_at: snap && snap.captured_at,
      snapshot:    parsed,
      player_stats: pms,
    });
  } catch (e) {
    console.error('[scorecard]', e);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
