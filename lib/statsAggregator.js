/**
 * L5 — Stats aggregator + points-table builder.
 *
 * When a match transitions to status='completed', the Controller has
 * already POSTed its full snapshot to /api/state. This module is called
 * by routes/club.js inside the status handler to:
 *
 *   1. Freeze the snapshot into match_snapshots
 *   2. Derive player_match_stats rows from allBalls/batsmanStats/bowlerStats
 *   3. Recompute points_table for the season
 *   4. Propagate the winner into any downstream knockout fixture
 *      (next_match_id / next_slot wiring)
 *
 * All DB operations are parameterised and tenant-scoped.
 */
'use strict';

const db = require('../db/connection');

const POINTS_WIN = 2;
const POINTS_TIE = 1;
const POINTS_NR  = 1;

function toFixed1(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

/** Parse a progress snapshot (state.match) into per-innings totals. */
function splitInnings(m) {
  const inn1 = {
    batTeamId:  m.inning1BatTeamId  || null,
    bowlTeamId: m.inning1BowlTeamId || null,
    runs:       m.inning1Runs       || 0,
    wickets:    m.inning1Wickets    || 0,
    balls:      m.inning1Balls      || 0,
    allBalls:   Array.isArray(m.inning1AllBalls) ? m.inning1AllBalls : [],
    batStats:   m.inning1BatStats   || {},
    bowlStats:  m.inning1BowlStats  || {},
  };
  const inn2 = {
    batTeamId:  m.batTeamId  || null,
    bowlTeamId: m.bowlTeamId || null,
    runs:       m.runs       || 0,
    wickets:    m.wickets    || 0,
    balls:      m.balls      || 0,
    allBalls:   Array.isArray(m.allBalls) ? m.allBalls : [],
    batStats:   m.batsmanStats || {},
    bowlStats:  m.bowlerStats  || {},
  };
  return [inn1, inn2];
}

/**
 * Persist the raw snapshot JSON + winner metadata.
 * Called before the status='completed' UPDATE is committed, inside the
 * same connection.
 */
async function saveSnapshot(conn, { matchId, tenantId, state, winner, winDesc }) {
  const json = JSON.stringify(state || {});
  await conn.query(
    `INSERT INTO match_snapshots (match_id, tenant_id, snapshot, winner, win_desc)
         VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
         snapshot = VALUES(snapshot),
         winner   = VALUES(winner),
         win_desc = VALUES(win_desc),
         captured_at = CURRENT_TIMESTAMP`,
    [matchId, tenantId, json, winner || null, winDesc || null]
  );
}

/**
 * Derive and upsert per-player stats from the snapshot. We deliberately
 * IGNORE super-over balls (is_super_over=true) so main-match aggregates
 * aren't polluted — SO is a tie-breaker, not part of the innings.
 *
 * Player id resolution: we look up (tenant, team, name) → players.id.
 * Unknown names (custom fielders typed in the modal) are skipped.
 */
async function savePlayerStats(conn, { matchId, tenantId, state }) {
  if (!state || typeof state !== 'object') return;
  const innings = splitInnings(state);

  // Preload name→id maps for both team rosters.
  const teamIds = [
    state.batTeamId, state.bowlTeamId,
    state.inning1BatTeamId, state.inning1BowlTeamId,
  ].filter(Boolean);
  if (!teamIds.length) return;

  const [players] = await conn.query(
    `SELECT id, team_id, name FROM players
       WHERE tenant_id = ? AND team_id IN (?)`,
    [tenantId, teamIds]
  );
  const nameById = new Map();           // (teamId|name) → playerId
  for (const p of players) nameById.set(p.team_id + '|' + p.name, p.id);

  // Accumulator per playerId.
  const acc = new Map(); // playerId → stats row
  function touch(playerId, teamId) {
    if (!acc.has(playerId)) {
      acc.set(playerId, {
        match_id: matchId, tenant_id: tenantId,
        player_id: playerId, team_id: teamId,
        runs_scored: 0, balls_faced: 0, fours: 0, sixes: 0, is_out: 0,
        overs_bowled: 0, runs_conceded: 0, wickets_taken: 0, maidens: 0,
        catches: 0, run_outs: 0, stumpings: 0,
      });
    }
    return acc.get(playerId);
  }

  for (const inn of innings) {
    const batTeamId  = inn.batTeamId;
    const bowlTeamId = inn.bowlTeamId;
    if (!batTeamId && !bowlTeamId) continue;

    // Batting stats come from batStats map.
    for (const [name, s] of Object.entries(inn.batStats || {})) {
      const pid = nameById.get(batTeamId + '|' + name);
      if (!pid) continue;
      const row = touch(pid, batTeamId);
      row.runs_scored += (s.runs  || 0);
      row.balls_faced += (s.balls || 0);
      row.fours       += (s.fours || 0);
      row.sixes       += (s.sixes || 0);
      if (s.out) row.is_out = 1;
    }

    // Bowling stats come from bowlStats map.
    for (const [name, s] of Object.entries(inn.bowlStats || {})) {
      const pid = nameById.get(bowlTeamId + '|' + name);
      if (!pid) continue;
      const row = touch(pid, bowlTeamId);
      row.overs_bowled  = toFixed1(row.overs_bowled + (s.balls || 0) / 6);
      row.runs_conceded += (s.runs    || 0);
      row.wickets_taken += (s.wickets || 0);
    }

    // Fielding stats from allBalls.
    for (const b of inn.allBalls || []) {
      if (b && b.is_super_over) continue;
      if ((b.type === 'wicket' || b.type === 'runout') && b.fielder) {
        const pid = nameById.get(bowlTeamId + '|' + b.fielder);
        if (!pid) continue;
        const row = touch(pid, bowlTeamId);
        if (b.type === 'runout' || b.dismissal_type === 'run_out') row.run_outs += 1;
        else if (b.dismissal_type === 'stumped' || (b.how === 'stumped')) row.stumpings += 1;
        else row.catches += 1;
      }
    }
  }

  if (acc.size === 0) return;

  const rows = [...acc.values()];
  // Upsert in one go — use VALUES + ON DUPLICATE KEY.
  for (const r of rows) {
    await conn.query(
      `INSERT INTO player_match_stats
         (match_id, tenant_id, player_id, team_id,
          runs_scored, balls_faced, fours, sixes, is_out,
          overs_bowled, runs_conceded, wickets_taken, maidens,
          catches, run_outs, stumpings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         runs_scored   = VALUES(runs_scored),
         balls_faced   = VALUES(balls_faced),
         fours         = VALUES(fours),
         sixes         = VALUES(sixes),
         is_out        = VALUES(is_out),
         overs_bowled  = VALUES(overs_bowled),
         runs_conceded = VALUES(runs_conceded),
         wickets_taken = VALUES(wickets_taken),
         maidens       = VALUES(maidens),
         catches       = VALUES(catches),
         run_outs      = VALUES(run_outs),
         stumpings     = VALUES(stumpings),
         updated_at    = CURRENT_TIMESTAMP`,
      [r.match_id, r.tenant_id, r.player_id, r.team_id,
       r.runs_scored, r.balls_faced, r.fours, r.sixes, r.is_out,
       r.overs_bowled, r.runs_conceded, r.wickets_taken, r.maidens,
       r.catches, r.run_outs, r.stumpings]
    );
  }
}

/**
 * Rebuild the points_table for a given season. Called every time a
 * match in that season completes.
 *
 * NRR uses standard ICC formula:
 *   NRR = (runs_for / overs_faced) - (runs_against / overs_bowled)
 * An all-out team's overs are counted as the full allocation.
 */
async function rebuildPointsTable(conn, { tenantId, seasonId }) {
  // Pull all completed fixtures in this season with both sides' totals.
  const [fx] = await conn.query(
    `SELECT m.id, m.bat_team_id, m.bowl_team_id, m.max_overs,
            m.is_bye, m.result_type, m.winner_team_id,
            ms.snapshot
       FROM matches m
       LEFT JOIN match_snapshots ms ON ms.match_id = m.id
      WHERE m.tenant_id = ? AND m.season_id = ?
        AND m.status = 'completed'`,
    [tenantId, seasonId]
  );

  // short_id is already what matches.bat_team_id stores. Accumulate per
  // short_id so bye fixtures (one side only) line up correctly.
  const stand = new Map(); // short_id -> row
  function touch(sid) {
    if (!sid) return null;
    if (!stand.has(sid)) stand.set(sid, {
      tenant_id: tenantId, season_id: seasonId, team_short_id: sid,
      matches_played: 0, wins: 0, losses: 0, ties: 0, no_result: 0,
      points: 0, runs_for: 0, overs_faced: 0, runs_against: 0,
      overs_bowled: 0,
    });
    return stand.get(sid);
  }

  for (const m of fx) {
    // Bye: only the winning team plays + gets a win + points, no NRR impact.
    if (m.is_bye) {
      const w = touch(m.winner_team_id);
      if (w) { w.matches_played += 1; w.wins += 1; w.points += POINTS_WIN; }
      continue;
    }
    const a = touch(m.bat_team_id);
    const b = touch(m.bowl_team_id);
    if (!a || !b) continue;
    a.matches_played += 1; b.matches_played += 1;

    // Tie / NR first — they don't consult the snapshot for margin but do
    // need NRR contribution from both innings totals when possible.
    let snapshot = null;
    try { snapshot = m.snapshot ? JSON.parse(m.snapshot) : null; } catch {}
    const s = snapshot && snapshot.match;

    // Helper: overs-faced used in NRR. All-out → full allocation.
    function oversForInnings(runs, wickets, balls, maxOv, squad) {
      const ao = (wickets || 0) >= 10;
      const ovActual = (balls || 0) / 6;
      return ao ? (maxOv || ovActual) : ovActual;
    }

    if (s) {
      const inn1 = {
        runs:    s.inning1Runs    || 0,
        balls:   s.inning1Balls   || 0,
        wickets: s.inning1Wickets || 0,
        batSid:  m.bat_team_id,   // NB: final m.bat_team_id maps to ACTUAL
                                  // 2nd-innings bat. But match_snapshots
                                  // keeps inning1BatTeamId — prefer that.
      };
      if (s.inning1BatTeamId) inn1.batSid = s.inning1BatTeamId;
      const inn2 = {
        runs:    s.runs    || 0,
        balls:   s.balls   || 0,
        wickets: s.wickets || 0,
        batSid:  s.batTeamId || m.bat_team_id,
      };
      // For NRR we need the bat/bowl mapping: each team's runs FOR come
      // from the innings where batSid matches them; runs AGAINST from
      // the other innings.
      const aSid = a.team_short_id, bSid = b.team_short_id;
      function feed(row, forInn, againstInn) {
        row.runs_for     += (forInn.runs    || 0);
        row.overs_faced  += oversForInnings(forInn.runs, forInn.wickets, forInn.balls, m.max_overs);
        row.runs_against += (againstInn.runs || 0);
        row.overs_bowled += oversForInnings(againstInn.runs, againstInn.wickets, againstInn.balls, m.max_overs);
      }
      if (inn1.batSid === aSid) { feed(a, inn1, inn2); feed(b, inn2, inn1); }
      else                      { feed(a, inn2, inn1); feed(b, inn1, inn2); }
    }

    // Result points.
    if (m.result_type === 'tie') {
      a.ties += 1; b.ties += 1;
      a.points += POINTS_TIE; b.points += POINTS_TIE;
    } else if (m.result_type === 'no_result') {
      a.no_result += 1; b.no_result += 1;
      a.points += POINTS_NR; b.points += POINTS_NR;
    } else {
      // normal / super_over: winner_team_id identifies winner. Super Over
      // awards the win to whichever side won the SO — already captured in
      // m.winner_team_id by the Controller snapshot.
      const wSid = m.winner_team_id;
      if (wSid && stand.has(wSid)) {
        const loser = (wSid === a.team_short_id) ? b : a;
        stand.get(wSid).wins += 1;
        stand.get(wSid).points += POINTS_WIN;
        loser.losses += 1;
      } else {
        // No winner recorded — count as NR so both sides still get a match played.
        a.no_result += 1; b.no_result += 1;
        a.points += POINTS_NR; b.points += POINTS_NR;
      }
    }
  }

  // Finalise NRR.
  for (const r of stand.values()) {
    const rpoF = r.overs_faced  > 0 ? r.runs_for     / r.overs_faced  : 0;
    const rpoA = r.overs_bowled > 0 ? r.runs_against / r.overs_bowled : 0;
    r.nrr = Math.round((rpoF - rpoA) * 1000) / 1000;
    r.overs_faced  = toFixed1(r.overs_faced);
    r.overs_bowled = toFixed1(r.overs_bowled);
  }

  // Wipe + replace atomically.
  await conn.query(
    'DELETE FROM points_table WHERE tenant_id=? AND season_id=?',
    [tenantId, seasonId]
  );
  for (const r of stand.values()) {
    await conn.query(
      `INSERT INTO points_table
         (tenant_id, season_id, team_short_id, matches_played, wins, losses,
          ties, no_result, points, runs_for, overs_faced, runs_against,
          overs_bowled, nrr)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.tenant_id, r.season_id, r.team_short_id, r.matches_played, r.wins,
       r.losses, r.ties, r.no_result, r.points, r.runs_for, r.overs_faced,
       r.runs_against, r.overs_bowled, r.nrr]
    );
  }
}

/**
 * Knockout progression. If the just-completed match has next_match_id
 * set, write the winner's short_id into the parent's bat or bowl slot.
 */
async function propagateKnockoutWinner(conn, { matchRow }) {
  if (!matchRow || !matchRow.next_match_id || !matchRow.winner_team_id) return;
  const col = matchRow.next_slot === 'bowl' ? 'bowl_team_id' : 'bat_team_id';
  await conn.query(
    `UPDATE matches SET ${col} = ?,
            status = IF(status='scheduled','ready',status)
       WHERE id = ? AND tenant_id = ?`,
    [matchRow.winner_team_id, matchRow.next_match_id, matchRow.tenant_id]
  );
}

/**
 * Single entry-point called from routes/club.js when a match moves to
 * status='completed'. Runs everything in one transaction.
 */
async function onMatchCompleted({ conn, matchId, tenantId, matchRow, state }) {
  if (!conn || !matchId || !tenantId) return;
  // 1) snapshot
  await saveSnapshot(conn, {
    matchId, tenantId, state,
    winner:  (state && state.winner)  || null,
    winDesc: (state && state.winDesc) || null,
  });

  // 2) winner_team_id + result_type back into matches (best-effort from state)
  let winnerSid = matchRow.winner_team_id || null;
  let resultType = matchRow.result_type || 'normal';
  if (state && state.winner && !matchRow.winner_team_id) {
    // Heuristic: state.winner is a team name → map to bat/bowl short_id.
    const [rows] = await conn.query(
      'SELECT short_id, name FROM teams WHERE tenant_id=? AND (short_id=? OR short_id=?)',
      [tenantId, matchRow.bat_team_id, matchRow.bowl_team_id]
    );
    const hit = rows.find(t => t.name === state.winner);
    if (hit) winnerSid = hit.short_id;
    if (state.winDesc && /TIE/i.test(state.winDesc)) resultType = 'tie';
    else if (/SUPER OVER/i.test(state.winDesc || '')) resultType = 'super_over';
  }
  await conn.query(
    `UPDATE matches SET winner_team_id=?, result_type=? WHERE id=? AND tenant_id=?`,
    [winnerSid, resultType, matchId, tenantId]
  );
  matchRow.winner_team_id = winnerSid;
  matchRow.result_type    = resultType;

  // 3) player stats
  try { await savePlayerStats(conn, { matchId, tenantId, state }); }
  catch (e) { console.warn('[L5 savePlayerStats]', e.message); }

  // 4) points table for the season (if any)
  if (matchRow.season_id) {
    try { await rebuildPointsTable(conn, { tenantId, seasonId: matchRow.season_id }); }
    catch (e) { console.warn('[L5 rebuildPointsTable]', e.message); }
  }

  // 5) knockout progression
  try { await propagateKnockoutWinner(conn, { matchRow }); }
  catch (e) { console.warn('[L5 propagateKnockoutWinner]', e.message); }
}

module.exports = {
  onMatchCompleted,
  saveSnapshot,
  savePlayerStats,
  rebuildPointsTable,
  propagateKnockoutWinner,
};
