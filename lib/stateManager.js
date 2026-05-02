'use strict';

const fs   = require('fs');
const path = require('path');
const db   = require('../db/connection');

/* ════════════════════════════════════════════════════════════════
   C3 — MULTI-MATCH CONCURRENCY (key by matchId)
   ──────────────────────────────────────────────────────────────
   A single tenant can now run two matches in parallel — e.g. one
   scorer is running the men's final on Field A while another
   handles the women's qualifier on Field B. The previous design
   stored one slot of state per tenant slug, so the second
   controller's pushes overwrote the first.

   New shape:
     _memMap         : Map<slug, defaultState>          (legacy)
     _matchStateMap  : Map<slug, Map<matchId, state>>   (per-match)
     _sseMap         : Map<slug, Set<res>>              (legacy)
     _sseMatchMap    : Map<slug+matchId, Set<res>>      (scoped)

   Disk layout:
     criccast_data/<slug>/score.json                 ← legacy default
     criccast_data/<slug>/state-<matchId>.json       ← per-match

   Backward compatibility:
     • getState(slug) (no matchId) returns the most-recently-pushed
       state — same as before for single-match tenants.
     • SSE clients without a matchId still get every state push for
       the tenant; clients that pass ?matchId=... only receive
       updates for that match.
════════════════════════════════════════════════════════════════ */

const _memMap          = new Map();
const _matchStateMap   = new Map();
const _sseMap          = new Map();
const _sseMatchMap     = new Map();
const _lastBroadcastMap = new Map();
let _io = null;
function setIO(io) { _io = io; }

function getDataDir(tenantSlug) {
  const dir = path.join(__dirname, '..', 'criccast_data', tenantSlug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getStateFile(tenantSlug) {
  return path.join(getDataDir(tenantSlug), 'score.json');
}

// C3: per-match disk file. We sanitise matchId to a-zA-Z0-9_- to keep
// it as a safe filename component.
function getMatchStateFile(tenantSlug, matchId) {
  const safe = String(matchId || '').replace(/[^A-Za-z0-9_\-]/g, '');
  if (!safe) return null;
  return path.join(getDataDir(tenantSlug), 'state-' + safe + '.json');
}

function _matchScopeKey(tenantSlug, matchId) {
  return tenantSlug + '::' + matchId;
}

function loadState(tenantSlug) {
  try {
    const raw    = fs.readFileSync(getStateFile(tenantSlug), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      _memMap.set(tenantSlug, parsed);
      return parsed;
    }
  } catch {}
  const empty = { match: null, teams: [], ts: 0 };
  _memMap.set(tenantSlug, empty);
  return empty;
}

// C3: try to load a per-match state from disk into the
// _matchStateMap cache. Returns the loaded state or null.
function _loadMatchState(tenantSlug, matchId) {
  const file = getMatchStateFile(tenantSlug, matchId);
  if (!file) return null;
  try {
    const raw    = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (!_matchStateMap.has(tenantSlug)) _matchStateMap.set(tenantSlug, new Map());
      _matchStateMap.get(tenantSlug).set(matchId, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

/**
 * getState(tenantSlug [, matchId])
 *   • Without matchId — returns the legacy "current" state slot.
 *   • With matchId — returns that match's snapshot (loading from
 *     disk if it isn't memoised yet). When a matchId is supplied
 *     but no per-match state exists yet, we return an EMPTY state
 *     instead of the legacy slot so a fresh match doesn't paint a
 *     sibling match's data on its scoreboards.
 *
 *   Also: if the legacy slot belongs to a DIFFERENT matchId than
 *   the one requested, treat it as a miss — same reason.
 */
function getState(tenantSlug, matchId) {
  if (matchId) {
    const cache = _matchStateMap.get(tenantSlug);
    const cached = cache && cache.get(matchId);
    if (cached) return cached;
    const loaded = _loadMatchState(tenantSlug, matchId);
    if (loaded) return loaded;
    // Legacy slot may belong to a sibling match — only return it if
    // it's the same matchId.
    if (!_memMap.has(tenantSlug)) loadState(tenantSlug);
    const legacy = _memMap.get(tenantSlug);
    if (legacy && legacy.matchId === matchId) return legacy;
    return { match: null, teams: [], ts: 0, matchId };
  }
  if (!_memMap.has(tenantSlug)) loadState(tenantSlug);
  return _memMap.get(tenantSlug);
}

async function setState(tenantSlug, tenantId, newState) {
  newState.ts = Math.floor(Date.now() / 1000);
  _memMap.set(tenantSlug, newState);

  try {
    fs.writeFileSync(getStateFile(tenantSlug), JSON.stringify(newState), 'utf8');
  } catch (e) {
    console.error('[StateManager] Disk write error for', tenantSlug, ':', e.message);
  }

  // C3: also store under the per-match slot so a sibling controller
  // pushing a different matchId won't overwrite this one.
  if (newState.matchId) {
    if (!_matchStateMap.has(tenantSlug)) _matchStateMap.set(tenantSlug, new Map());
    _matchStateMap.get(tenantSlug).set(newState.matchId, newState);
    const mfile = getMatchStateFile(tenantSlug, newState.matchId);
    if (mfile) {
      try {
        fs.writeFileSync(mfile, JSON.stringify(newState), 'utf8');
      } catch (e) {
        console.error('[StateManager] Per-match disk write error:', e.message);
      }
    }
  }

  if (tenantId && newState.matchId) {
    setStateInDB(tenantId, newState).catch(e =>
      console.error('[SM] setStateInDB:', e.message)
    );
    logNewBalls(tenantId, newState.matchId, newState).catch(e =>
      console.error('[SM] logNewBalls:', e.message)
    );
  }

  broadcast(tenantSlug, newState);
  return newState;
}

/**
 * logNewBalls — syncs ball_events table with allBalls[] in state.
 *
 * C2 (ball_events seq fix):
 *   The schema has  UNIQUE KEY uq_match_seq (match_id, seq)  with
 *   `seq INT NOT NULL DEFAULT 0`. The previous implementation inserted
 *   without supplying seq, so every row defaulted to 0 and the second
 *   row in any match collided on the unique key — silently swallowed
 *   by the catch block, leaving ball history empty after the first ball.
 *
 *   We now:
 *     1. Look up MAX(seq) for the match and use that as the watermark
 *        instead of COUNT(*) (which gets out-of-sync after any failed
 *        insert).
 *     2. Assign seq = i+1 (1-based) so it lines up with the controller's
 *        allBalls[] index and stays monotonic.
 *     3. Use INSERT ... ON DUPLICATE KEY UPDATE on (match_id, seq) so a
 *        controller "undo + redo" overwrites the prior log entry
 *        instead of failing the whole batch.
 */
async function logNewBalls(tenantId, matchId, newState) {
  if (!matchId || !tenantId) return;
  const newBalls = newState.match?.allBalls || [];
  if (!newBalls.length) return;

  try {
    const [[maxRow]] = await db.query(
      'SELECT COALESCE(MAX(seq), 0) AS maxSeq FROM ball_events WHERE match_id=?',
      [matchId]
    );
    const maxSeq = Number(maxRow.maxSeq) || 0;
    if (newBalls.length <= maxSeq) return; // controller is behind (undo); nothing new

    const { v4: uuidv4 } = require('uuid');
    const values = [];
    for (let i = maxSeq; i < newBalls.length; i++) {
      const b   = newBalls[i] || {};
      const seq = i + 1;                       // 1-based, matches array index+1
      values.push([
        uuidv4(),
        matchId,
        tenantId,
        b.inning  || 1,
        b.overNum || 0,
        b.ballNum || 0,
        seq,
        b.runs    || 0,
        b.type    || 'run',
        b.batsman || '',
        b.bowler  || '',
        b.chip    || null,
      ]);
    }
    if (!values.length) return;

    await db.query(
      `INSERT INTO ball_events
         (id, match_id, tenant_id, inning, over_num, ball_num, seq, runs, type, batsman, bowler, chip)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         inning   = VALUES(inning),
         over_num = VALUES(over_num),
         ball_num = VALUES(ball_num),
         runs     = VALUES(runs),
         type     = VALUES(type),
         batsman  = VALUES(batsman),
         bowler   = VALUES(bowler),
         chip     = VALUES(chip)`,
      [values]
    );
  } catch (e) {
    console.error('[StateManager] Ball logging error:', e.message);
  }
}

async function setStateInDB(tenantId, state) {
  if (!state.matchId) return;
  await db.query(
    `INSERT INTO match_state (match_id, tenant_id, state_json)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE state_json = VALUES(state_json)`,
    [state.matchId, tenantId, JSON.stringify(state)]
  );
}

/**
 * addSSEClient(tenantSlug, res [, matchId])
 *   C3: optional matchId scopes the client to a single match — only
 *   state pushes for that match (or untargeted broadcasts) reach it.
 *   Clients that don't pass a matchId keep the legacy behaviour
 *   (every state push for the tenant).
 */
function addSSEClient(tenantSlug, res, matchId) {
  if (!_sseMap.has(tenantSlug)) _sseMap.set(tenantSlug, new Set());
  _sseMap.get(tenantSlug).add(res);
  if (matchId) {
    res._ccMatchId = matchId;
    const key = _matchScopeKey(tenantSlug, matchId);
    if (!_sseMatchMap.has(key)) _sseMatchMap.set(key, new Set());
    _sseMatchMap.get(key).add(res);
  }
}

function removeSSEClient(tenantSlug, res) {
  if (_sseMap.has(tenantSlug)) _sseMap.get(tenantSlug).delete(res);
  if (res && res._ccMatchId) {
    const key = _matchScopeKey(tenantSlug, res._ccMatchId);
    const set = _sseMatchMap.get(key);
    if (set) set.delete(res);
  }
}

function getSSECount(tenantSlug, matchId) {
  if (matchId) {
    const key = _matchScopeKey(tenantSlug, matchId);
    const set = _sseMatchMap.get(key);
    return set ? set.size : 0;
  }
  return _sseMap.has(tenantSlug) ? _sseMap.get(tenantSlug).size : 0;
}

function writeSSE(res, chunk) {
  try {
    if (res.socket && !res.socket._noDelaySet) {
      res.socket.setNoDelay(true);
      res.socket._noDelaySet = true;
    }
    res.write(chunk);
    if (typeof res.flush === 'function') res.flush();
  } catch {}
}

function broadcast(tenantSlug, data) {
  const clients = _sseMap.get(tenantSlug);
  if (!clients || clients.size === 0) return;
  const msg = 'data: ' + JSON.stringify(data) + '\n\n';
  // C3: scope by matchId. A client that subscribed with ?matchId=...
  // only sees pushes for that match. Clients without a scope (legacy)
  // see every push for the tenant — same as before.
  const targetMatchId = data && data.matchId;
  for (const res of clients) {
    if (res._ccMatchId && targetMatchId && res._ccMatchId !== targetMatchId) continue;
    writeSSE(res, msg);
  }
}

function broadcastEvent(tenantSlug, payload) {
  const clients = _sseMap.get(tenantSlug);
  if (!clients || clients.size === 0) return;
  const msg = 'event: broadcast\ndata: ' + JSON.stringify(payload) + '\n\n';
  const _bmId = payload && payload.matchId;
  for (const res of clients) {
    if (_bmId && res._ccMatchId && res._ccMatchId !== _bmId) continue;
    writeSSE(res, msg);
  }
  const _lbKey = tenantSlug + ':' + (payload.matchId || '');
  _lastBroadcastMap.set(_lbKey, { ...payload, ts: Date.now() });
}

/**
 * writeEvent — emit a *named* SSE event (event: <name>) to every client
 * subscribed to this tenant's stream. Used for lifecycle signals
 * (match:lifecycle, match:deleted, ...) that are distinct from the
 * regular state pushes so the client can route them cleanly.
 */

function emitEvent(tenantSlug, eventType, payload) {
  // Socket.IO — instant push to all clients in tenant room
  if (_io) _io.to('tenant:' + tenantSlug).emit(eventType, payload);
  // SSE fallback
  writeEvent(tenantSlug, eventType, payload);
}

function writeEvent(tenantSlug, eventName, payload) {
  if (!eventName) return;
  const clients = _sseMap.get(tenantSlug);
  if (!clients || clients.size === 0) return;
  const data = JSON.stringify(payload == null ? {} : payload);
  const msg  = 'event: ' + eventName + '\ndata: ' + data + '\n\n';
  for (const res of clients) writeSSE(res, msg);
}

function getLastBroadcast(tenantSlug, matchId) {
  return _lastBroadcastMap.get(tenantSlug + ':' + (matchId || '')) || null;
}

module.exports = {
  setIO,
  getState,
  setState,
  loadState,
  addSSEClient,
  removeSSEClient,
  getSSECount,
  writeSSE,
  broadcast,
  broadcastEvent,
  writeEvent,
  getLastBroadcast,
  emitEvent,
};
