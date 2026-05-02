const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'routes', 'club.js');

let s = fs.readFileSync(FILE, 'utf8');
if (s.includes('statsAggregator')) {
  console.log('stats pipeline already wired, skipping');
  process.exit(0);
}

const target =
`    const finishedAt = target === 'completed' ? new Date() : null;
    await db.query(
      'UPDATE matches SET status=?, finished_at=? WHERE id=? AND tenant_id=?',
      [target, finishedAt, req.params.id, req.tenant.id]
    );`;

const i = s.indexOf(target);
if (i < 0) {
  console.error('status-update anchor not found');
  process.exit(1);
}

const replacement =
`    // L5: when transitioning to 'completed', run the full stats pipeline
    // inside a transaction so points_table + player_match_stats +
    // match_snapshots + knockout-propagation all either succeed together
    // or all roll back.
    if (target === 'completed' && current !== 'completed') {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          \`UPDATE matches SET status='completed',
                  finished_at = IFNULL(finished_at, CURRENT_TIMESTAMP)
             WHERE id=? AND tenant_id=?\`,
          [req.params.id, req.tenant.id]
        );
        const [mrows] = await conn.query(
          \`SELECT * FROM matches WHERE id=? AND tenant_id=?\`,
          [req.params.id, req.tenant.id]
        );
        const mrow = mrows && mrows[0];
        const [srows] = await conn.query(
          \`SELECT state_json FROM match_state WHERE match_id=?\`,
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
    }`;

s = s.slice(0, i) + replacement + s.slice(i + target.length);
fs.writeFileSync(FILE, s, 'utf8');
console.log('stats pipeline wired (', target.length, '->', replacement.length, 'bytes )');
