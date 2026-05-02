'use strict';
const db = require('../db/connection');
(async () => {
  try {
    const [result] = await db.query(`UPDATE matches SET status='finished', finished_at=NOW() WHERE status IN ('setup','live') AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`);
    console.log('[CLEANUP] Marked', result.affectedRows, 'stale matches as finished');
    process.exit(0);
  } catch (err) { console.error('[CLEANUP] Error:', err.message); process.exit(1); }
})();
