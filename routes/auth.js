'use strict';

const express  = require('express');
const passport = require('passport');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db       = require('../db/connection');
const { clubUserLogout } = require('../middleware/auth');

const router = express.Router();

router.get('/signup', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'views', 'signup.html'));
});

router.post('/signup', express.json(), async (req, res) => {
  const { clubName, slug, email, password, name } = req.body || {};

  if (!clubName || !slug || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
    return res.status(400).json({ error: 'Slug must be 3-30 lowercase letters/numbers/hyphens' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const emailNorm = email.toLowerCase().trim();

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'Club URL already taken: ' + slug });
    }

    // BUG FIXED (C3 mitigation): Passport looks up users by email WITHOUT
    // tenant context. If two clubs each have an account with the same
    // email, the login always lands in whichever club was registered first.
    // We block that at signup time by enforcing email uniqueness across
    // ALL tenants at the application layer. This preserves the existing
    // (tenant_id, email) unique index in the schema (no migration needed)
    // while closing the login-collision hole.
    const [dupEmail] = await conn.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1', [emailNorm]
    );
    if (dupEmail.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'That email is already registered on CricCast.' });
    }

    const tenantId = uuidv4();
    await conn.query(
      'INSERT INTO tenants (id, slug, name, plan, max_matches, max_teams) VALUES (?, ?, ?, ?, ?, ?)',
      [tenantId, slug, clubName, 'free', 5, 10]
    );

    const userId       = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    await conn.query(
      'INSERT INTO users (id, tenant_id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, tenantId, emailNorm, passwordHash, 'admin', name || clubName + ' Admin']
    );

    const fs   = require('fs');
    const path = require('path');
    const dataDir   = path.join(__dirname, '..', 'criccast_data',    slug);
    const uploadDir = path.join(__dirname, '..', 'criccast_uploads', slug);
    [dataDir, uploadDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

    const htaPath = path.join(dataDir, '.htaccess');
    if (!fs.existsSync(htaPath)) fs.writeFileSync(htaPath, 'Deny from all\nOptions -Indexes\n');

    await conn.commit();
    console.log('[Auth] New tenant created:', slug, '| user:', emailNorm);

    // BUG FIXED (M1): sendWelcome() existed in lib/mailer.js but was never
    // invoked after signup, so welcome emails were silently never sent.
    // Wrapped in try/catch and fire-and-forget so SMTP problems never block
    // the signup success response.
    try {
      const { sendWelcome } = require('../lib/mailer');
      sendWelcome({ to: emailNorm, name: name || clubName + ' Admin', clubName, slug })
        .catch(e => console.error('[Auth] sendWelcome failed:', e.message));
    } catch (e) {
      console.error('[Auth] mailer unavailable:', e.message);
    }

    res.json({ ok: true, message: 'Club created! Redirecting to login.', slug });
  } catch (err) {
    await conn.rollback();
    console.error('[Auth] Signup error:', err.message);
    res.status(500).json({ error: 'Server error during signup' });
  } finally {
    conn.release();
  }
});

router.get('/login', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'views', 'login.html'));
});

router.post('/login', express.json(), (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);

      // BUG FIXED: Open redirect — validate next_url starts with '/'
      // Without this, ?next=https://evil.com would redirect users off-site (phishing).
      const raw_next = req.query.next || '';
      const next_url = raw_next.startsWith('/') ? raw_next : '/dashboard';
      res.json({ ok: true, redirect: next_url });
    });
  })(req, res, next);
});

// BUG FIXED: Previously only called req.logout() — left req.session.saasAdmin
// intact if the same browser was also a SaaS admin. Now uses clubUserLogout()
// which destroys the entire session.
router.post('/logout', clubUserLogout);

router.get('/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: {
      id:       req.user.id,
      name:     req.user.name,
      email:    req.user.email,
      role:     req.user.role,
      tenantId: req.user.tenant_id,
    }
  });
});

module.exports = router;
