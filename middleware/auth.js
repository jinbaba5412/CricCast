'use strict';

const db = require('../db/connection');

// ─────────────────────────────────────────────────────────
//  requireAuth
//  Ensures a Passport club-user is logged in.
//  SaaS admin session (req.session.saasAdmin) is a SEPARATE
//  system — it never satisfies this guard.
// ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

// ─────────────────────────────────────────────────────────
//  requireRole
//  Hierarchical role check for club users.
//  Roles: scorer (1) < admin (2)
//  NOTE: 'saas_admin' is intentionally excluded from ROLES
//  here — a users-table row with role='saas_admin' must NOT
//  gain elevated club privileges through this guard.
// ─────────────────────────────────────────────────────────
function requireRole(role) {
  const ROLES = { scorer: 1, admin: 2 };   // saas_admin deliberately omitted
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userLevel   = ROLES[req.user.role] || 0;
    const neededLevel = ROLES[role]          || 99;
    if (userLevel >= neededLevel) return next();
    return res.status(403).json({ error: 'Insufficient role: need ' + role });
  };
}

// ─────────────────────────────────────────────────────────
//  requireTenantMatch
//  Verifies the authenticated club user belongs to the
//  resolved tenant.
//
//  BUG FIXED: Previous code had:
//    if (req.user.role === 'saas_admin') return next();
//  This meant any users-table row with role='saas_admin'
//  (the seeded admin@criccast.app) could bypass ALL tenant
//  isolation and read/write every club's data.
//  SaaS admins authenticate via req.session.saasAdmin (a
//  separate auth system) — they should never reach club
//  routes. The bypass is removed entirely.
// ─────────────────────────────────────────────────────────
function requireTenantMatch(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.tenant) return res.status(400).json({ error: 'No tenant context' });
  if (req.user.tenant_id !== req.tenant.id) {
    return res.status(403).json({ error: 'Access denied: wrong club' });
  }
  next();
}

// ─────────────────────────────────────────────────────────
//  requireSaasAdmin
//  Verifies the SaaS admin session token.
//  Completely independent of Passport / req.user.
// ─────────────────────────────────────────────────────────
function requireSaasAdmin(req, res, next) {
  if (!req.session?.saasAdmin) {
    if (req.accepts('html')) return res.redirect('/saas-admin/login');
    return res.status(403).json({ ok: false, error: 'SaaS admin access required' });
  }
  next();
}

// ─────────────────────────────────────────────────────────
//  saasAdminLogin  (POST /saas-admin/login handler)
//  Regenerates session after login to prevent session fixation.
// ─────────────────────────────────────────────────────────
async function saasAdminLogin(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password required' });
  try {
    const [[admin]] = await db.query(
      'SELECT id, email, password_hash FROM saas_admins WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    if (!admin) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const bcrypt = require('bcryptjs');
    const valid  = await bcrypt.compare(password, admin.password_hash);
    if (!valid)  return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    // Regenerate session to prevent session-fixation
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ ok: false, error: 'Session error' });
      req.session.saasAdmin = { id: admin.id, email: admin.email };
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ ok: false, error: 'Session save error' });
        res.json({ ok: true, redirect: '/saas-admin' });
      });
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────
//  saasAdminLogout  (POST /saas-admin/logout handler)
//
//  BUG FIXED: Previous code only deleted req.session.saasAdmin.
//  If the browser was also logged in as a club user via
//  Passport, that session remained — cross-system session leak.
//  Fix: destroy the whole session.
// ─────────────────────────────────────────────────────────
function saasAdminLogout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/saas-admin/login');
  });
}

// ─────────────────────────────────────────────────────────
//  clubUserLogout  (POST /logout handler)
//
//  BUG FIXED: Previous code only called req.logout().
//  If the browser also had an active SaaS admin session,
//  it survived this logout — cross-system session leak.
//  Fix: destroy the whole session.
// ─────────────────────────────────────────────────────────
function clubUserLogout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
}

// ─────────────────────────────────────────────────────────
//  requireClubAuth
//  Convenience guard for endpoints that previously ran
//  completely unauthenticated (legacy offline controller
//  posting state, broadcasts, records, uploads).
//
//  Ensures the request carries a valid Passport session,
//  that a tenant was resolved, and that the logged-in user
//  belongs to that tenant. Used on write endpoints that do
//  not need the full admin role check.
// ─────────────────────────────────────────────────────────
function requireClubAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  if (!req.tenant) {
    return res.status(400).json({ ok: false, error: 'No tenant context' });
  }
  if (req.user.tenant_id !== req.tenant.id) {
    return res.status(403).json({ ok: false, error: 'Access denied: wrong club' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireRole,
  requireTenantMatch,
  requireSaasAdmin,
  requireClubAuth,
  saasAdminLogin,
  saasAdminLogout,
  clubUserLogout,
};
