'use strict';

const db = require('../db/connection');

async function tenantResolver(req, res, next) {
  let slug = null;

  // 1. Subdomain-based (e.g. slug.criccast.app)
  const baseDomain = process.env.BASE_DOMAIN || 'criccast.app';
  const host = req.hostname || '';
  if (host !== baseDomain && host.endsWith('.' + baseDomain)) {
    slug = host.slice(0, -(baseDomain.length + 1)).toLowerCase();
    if (slug === 'www') slug = null;
  }

  // 2. Path-based (e.g. /t/slug/...)
  if (!slug) {
    const match = req.path.match(/^\/t\/([a-z0-9-]+)(\/|$)/i);
    if (match) slug = match[1].toLowerCase();
  }

  // 3. Resolve by slug from DB
  if (slug) {
    try {
      const [rows] = await db.query(
        'SELECT id, slug, name, plan, max_matches, max_teams FROM tenants WHERE slug = ? LIMIT 1',
        [slug]
      );
      if (!rows.length) {
        // N5 — don't echo the slug in the 404 message: that lets an
        // unauthenticated attacker enumerate which slugs exist by
        // probing /t/<slug>/ paths.
        return res.status(404).json({ error: 'Club not found' });
      }
      req.tenant = rows[0];
      return next();
    } catch (err) {
      console.error('[tenantResolver] DB error:', err.message);
      req.tenant = null;
      return next();
    }
  }

  // 4. FALLBACK: single-domain hosting (khantaxiservice.com etc.)
  //    Resolve tenant from the authenticated user's session.
  //    Without this, ALL /api/club/* routes return 403 "No tenant context"
  //    on any deployment that doesn't use subdomains or /t/slug/ prefixes.
  if (req.user && req.user.tenant_id) {
    try {
      const [rows] = await db.query(
        'SELECT id, slug, name, plan, max_matches, max_teams FROM tenants WHERE id = ? LIMIT 1',
        [req.user.tenant_id]
      );
      if (rows.length) {
        req.tenant = rows[0];
        return next();
      }
    } catch (err) {
      console.error('[tenantResolver] Fallback DB error:', err.message);
    }
  }

  req.tenant = null;
  return next();
}

module.exports = tenantResolver;
