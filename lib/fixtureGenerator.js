'use strict';

/**
 * CricCast — Fixture Generator (pure functions, no I/O).
 *
 * Layer: L1 helper. Consumers: routes/tournaments.js (fixture endpoint).
 * Outputs an array of `plannedMatch` objects ready to INSERT into matches.
 *
 * plannedMatch = {
 *   round_num, stage, is_bye,
 *   bat_short_id, bowl_short_id | null   // null when is_bye=1
 *   winner_team_id | null,               // set only for bye rows (auto-win)
 *   result_type,                         // 'normal' or 'bye'
 *   status,                              // 'scheduled' | 'completed' (for bye)
 *   bracket_slot | null,                 // knockout only — slot position 0..bracketSize-1
 *   next_bracket_slot | null,            // parent slot in the next round (for wiring later)
 * }
 *
 * None of these functions talk to the database or know about UUIDs; the
 * route layer assigns match IDs and turns `next_bracket_slot` into real
 * `next_match_id` FK values after all rows are inserted.
 */

// ─── helpers ─────────────────────────────────────────────────────────
function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Circle-method round-robin. Accepts an array of team short_ids.
 * If teams.length is odd, inserts a virtual BYE placeholder; the real
 * team paired with BYE each round produces a bye fixture.
 *
 * Returns: plannedMatch[]  (sorted by round_num).
 */
function generateRoundRobin(teamIds, opts = {}) {
  const stage       = opts.stage || 'group';
  const doubleRound = !!opts.doubleRound;
  const ids         = teamIds.slice();
  if (ids.length < 2) return [];

  // Pad with BYE sentinel if odd.
  const bye = '__BYE__';
  const list = ids.slice();
  if (list.length % 2 === 1) list.push(bye);

  const n        = list.length;
  const rounds   = n - 1;
  const half     = n / 2;
  const results  = [];

  // Build a rotating array: index 0 pinned, others rotate.
  let rot = list.slice(1);
  for (let r = 0; r < rounds; r++) {
    const roundArr = [list[0], ...rot];
    for (let i = 0; i < half; i++) {
      const home = roundArr[i];
      const away = roundArr[n - 1 - i];

      if (home === bye || away === bye) {
        const realTeam = home === bye ? away : home;
        results.push({
          round_num:         r + 1,
          stage,
          is_bye:            1,
          bat_short_id:      realTeam,
          bowl_short_id:     null,
          winner_team_id:    realTeam,
          result_type:       'bye',
          status:            'completed',
          bracket_slot:      null,
          next_bracket_slot: null,
        });
      } else {
        // Alternate home/away across rounds for fairness.
        const swap = (r % 2 === 1);
        results.push({
          round_num:         r + 1,
          stage,
          is_bye:            0,
          bat_short_id:      swap ? away : home,
          bowl_short_id:     swap ? home : away,
          winner_team_id:    null,
          result_type:       'normal',
          status:            'scheduled',
          bracket_slot:      null,
          next_bracket_slot: null,
        });
      }
    }
    // Rotate — keep index 0 pinned (that's `list[0]`), rotate the rest.
    rot = [rot[rot.length - 1], ...rot.slice(0, -1)];
  }

  if (doubleRound) {
    // Home & away — replay every fixture with teams swapped, rounds continue.
    const second = results.map(m => ({
      ...m,
      round_num: m.round_num + rounds,
      bat_short_id:  m.bowl_short_id || m.bat_short_id,  // bye keeps same team
      bowl_short_id: m.bowl_short_id ? m.bat_short_id : null,
    }));
    return results.concat(second);
  }
  return results;
}

/**
 * Knockout bracket with automatic bye seeding for any N ≥ 2.
 *
 * Seeding order: `teamIds[0]` is seed 1 (highest), `teamIds[N-1]` is seed N.
 *
 * bracketSize  = nextPow2(N)
 * byeCount     = bracketSize - N
 * The `byeCount` highest seeds skip R1 (they get a bye fixture that is
 * marked completed and winner = that seed). All other seeds play R1.
 *
 * Pairing inside a round follows "1-vs-last" standard seeding:
 *   seed 1  vs seed 16
 *   seed 8  vs seed 9
 *   seed 5  vs seed 12
 *   seed 4  vs seed 13
 *   seed 3  vs seed 14
 *   seed 6  vs seed 11
 *   seed 7  vs seed 10
 *   seed 2  vs seed 15
 * (this is the canonical single-elimination bracket ordering).
 *
 * Returns: plannedMatch[] for every round of the bracket, with
 * `bracket_slot` and `next_bracket_slot` set so the route layer can wire
 * `next_match_id` FKs after INSERTs are assigned real UUIDs.
 */
function generateKnockout(teamIds) {
  if (teamIds.length < 2) return [];

  const N           = teamIds.length;
  const bracketSize = nextPowerOfTwo(N);
  const byeCount    = bracketSize - N;

  // Canonical seeding order for bracketSize.
  const slotOrder = buildSeedOrder(bracketSize);  // returns seed-indices 1..bracketSize

  // Build the initial slot → seed/team mapping.
  // Slots 0..bracketSize-1. Slot `i` holds seed `slotOrder[i]`. If that seed
  // is greater than N, the slot is an auto-BYE.
  const slotTeam = new Array(bracketSize);  // short_id or null (bye)
  for (let i = 0; i < bracketSize; i++) {
    const seed = slotOrder[i];
    slotTeam[i] = (seed <= N) ? teamIds[seed - 1] : null; // null = auto-BYE
  }

  const results = [];
  const rounds  = Math.log2(bracketSize);
  const stageFor = (roundsLeft) => {
    if (roundsLeft === 1) return 'final';
    if (roundsLeft === 2) return 'semi';
    if (roundsLeft === 3) return 'quarter';
    if (roundsLeft === 4) return 'round_of_16';
    return 'group';
  };

  // R1 — emit one fixture per pair. If a slot holds null (auto-bye), the
  // real team auto-advances.  For every round AFTER R1 the bracket is
  // always fully structured (pairs-count / 2 matches), and participants
  // are TBD pointers back to R1 (or later) winners.
  const r1Slots = slotTeam.slice();
  const r1Pairs = r1Slots.length / 2;
  for (let p = 0; p < r1Pairs; p++) {
    const a = r1Slots[p * 2];
    const b = r1Slots[p * 2 + 1];
    const nextParent = (rounds > 1) ? Math.floor(p / 2) : null;
    if (a && b) {
      results.push({
        round_num:         1,
        stage:             stageFor(rounds),
        is_bye:            0,
        bat_short_id:      a,
        bowl_short_id:     b,
        winner_team_id:    null,
        result_type:       'normal',
        status:            'scheduled',
        bracket_slot:      p,
        next_bracket_slot: nextParent,
        round_index:       0,
      });
    } else if (a || b) {
      results.push({
        round_num:         1,
        stage:             stageFor(rounds),
        is_bye:            1,
        bat_short_id:      a || b,
        bowl_short_id:     null,
        winner_team_id:    a || b,
        result_type:       'bye',
        status:            'completed',
        bracket_slot:      p,
        next_bracket_slot: nextParent,
        round_index:       0,
      });
    }
  }

  // Rounds 2..N — always fully-scheduled matches. Participants TBD.
  let thisRoundPairs = r1Pairs;              // = slot count of round r+1
  for (let r = 1; r < rounds; r++) {
    const roundsLeft = rounds - r;
    const nextPairs  = thisRoundPairs / 2;
    for (let p = 0; p < nextPairs; p++) {
      const nextParent = (r < rounds - 1) ? Math.floor(p / 2) : null;
      results.push({
        round_num:         r + 1,
        stage:             stageFor(roundsLeft),
        is_bye:            0,
        bat_short_id:      null,     // resolved on winner propagation
        bowl_short_id:     null,
        winner_team_id:    null,
        result_type:       'normal',
        status:            'scheduled',
        bracket_slot:      p,
        next_bracket_slot: nextParent,
        round_index:       r,
      });
    }
    thisRoundPairs = nextPairs;
  }
  return results;
}

/**
 * buildSeedOrder(size)  — returns seed indices in bracket slot order.
 * e.g. size=8 → [1,8,5,4,3,6,7,2] which yields the canonical pairings
 *               (1v8)(4v5) | (3v6)(2v7).
 *
 * Built iteratively: start from [1,2] and double by inserting
 * complements around the midpoint.
 */
function buildSeedOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const next = [];
    const doubled = order.length * 2;
    for (const s of order) {
      next.push(s);
      next.push(doubled + 1 - s);
    }
    order = next;
  }
  return order;
}

/**
 * Hybrid: league stage feeds knockout. Top-K teams per group advance.
 * This function only emits the LEAGUE fixtures — the knockout bracket is
 * generated at league-end (separate API call in L5) once standings are
 * known. We still return a single array so the route layer can insert.
 *
 * Callers for hybrid should subsequently invoke generateKnockout with the
 * qualifying team ids after the league finishes.
 */
function generateHybridLeagueStage(groupedTeams, opts = {}) {
  // groupedTeams: [{ group_id, teamIds: [...] }, ...]
  const out = [];
  for (const g of groupedTeams) {
    const rr = generateRoundRobin(g.teamIds, { stage: 'group', doubleRound: !!opts.doubleRound });
    for (const m of rr) out.push({ ...m, group_id: g.group_id });
  }
  return out;
}

module.exports = {
  nextPowerOfTwo,
  buildSeedOrder,
  generateRoundRobin,
  generateKnockout,
  generateHybridLeagueStage,
};
