'use strict';
const db = require('../db/connection');
(async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [[{ tenant_count }]]  = await db.query('SELECT COUNT(*) AS tenant_count FROM tenants');
    const [[{ active_matches }]]= await db.query(`SELECT COUNT(*) AS active_matches FROM matches WHERE status='live'`);
    const [[{ balls_today }]]   = await db.query(`SELECT COUNT(*) AS balls_today FROM ball_events WHERE DATE(created_at)=?`, [today]);
    const [[{ new_tenants }]]   = await db.query(`SELECT COUNT(*) AS new_tenants FROM tenants WHERE DATE(created_at)=?`, [today]);
    await db.query(`INSERT INTO analytics_snapshots (snapshot_date,tenant_count,active_matches,balls_today,new_tenants) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE tenant_count=VALUES(tenant_count),active_matches=VALUES(active_matches),balls_today=VALUES(balls_today),new_tenants=VALUES(new_tenants)`, [today, tenant_count, active_matches, balls_today, new_tenants]);
    console.log('[ANALYTICS] Snapshot recorded for', today); process.exit(0);
  } catch (err) { console.error('[ANALYTICS] Error:', err.message); process.exit(1); }
})();
