'use strict';
const db = require('../db/connection');

async function checkMatchQuota(req, res, next) {
  if (!req.tenant) return next();
  try {
    // N1 — schema enum is ('scheduled','ready','setup','live','completed','finished').
    // Modern writes use scheduled/ready/live/completed; 'setup' is legacy.
    // Counting only ('setup','live') let tenants create unlimited
    // 'scheduled'/'ready' matches without ever hitting the quota.
    // Active = anything not yet completed.
    const [[{ activeCount }]] = await db.query(
      `SELECT COUNT(*) AS activeCount FROM matches
         WHERE tenant_id = ?
           AND status IN ('scheduled','ready','setup','live')`,
      [req.tenant.id]
    );
    if (activeCount >= req.tenant.max_matches) {
      return res.status(403).json({
        ok: false,
        error: `Match limit reached (${req.tenant.max_matches} active matches on your ${req.tenant.plan} plan).`,
        quota: { used: activeCount, max: req.tenant.max_matches, plan: req.tenant.plan, canUpgrade: req.tenant.plan === 'free' }
      });
    }
    next();
  } catch (err) { next(err); }
}

async function checkTeamQuota(req, res, next) {
  if (!req.tenant) return next();
  try {
    const [[{ teamCount }]] = await db.query(
      'SELECT COUNT(*) AS teamCount FROM teams WHERE tenant_id = ?', [req.tenant.id]
    );
    if (teamCount >= req.tenant.max_teams) {
      return res.status(403).json({
        ok: false,
        error: `Team limit reached (${req.tenant.max_teams} teams on your ${req.tenant.plan} plan).`,
        quota: { used: teamCount, max: req.tenant.max_teams, plan: req.tenant.plan, canUpgrade: req.tenant.plan === 'free' }
      });
    }
    next();
  } catch (err) { next(err); }
}

async function getQuotaSummary(tenantId) {
  // N1 — see checkMatchQuota for status set rationale.
  const [[{ matchCount }]] = await db.query(
    `SELECT COUNT(*) AS matchCount FROM matches
       WHERE tenant_id = ?
         AND status IN ('scheduled','ready','setup','live')`,
    [tenantId]
  );
  const [[{ teamCount }]] = await db.query(
    'SELECT COUNT(*) AS teamCount FROM teams WHERE tenant_id = ?', [tenantId]
  );
  return { matchCount, teamCount };
}

module.exports = { checkMatchQuota, checkTeamQuota, getQuotaSummary };
