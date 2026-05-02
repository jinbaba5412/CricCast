'use strict';

const passport      = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt        = require('bcryptjs');
const db            = require('../db/connection');

passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const emailNorm = String(email || '').toLowerCase().trim();
      if (!emailNorm) return done(null, false, { message: 'Email required' });

      // ── Cross-tenant duplicate-account safety ────────────
      // The users table is UNIQUE on (tenant_id, email) but NOT on email
      // alone, so historically the same email could exist in two different
      // clubs. Signup and user-create now both block that globally
      // (routes/auth.js, routes/club.js), but legacy rows may still exist.
      // If we find more than one, refuse login with a clear error rather
      // than silently logging into whichever row came first — that would
      // put users in the wrong tenant.
      const [rows] = await db.query(
        'SELECT id, tenant_id, email, password_hash, role, name FROM users WHERE email = ? LIMIT 2',
        [emailNorm]
      );
      if (!rows.length) {
        return done(null, false, { message: 'No account found with that email' });
      }
      if (rows.length > 1) {
        return done(null, false, {
          message: 'This email exists on multiple clubs. Please contact support to resolve.',
        });
      }
      const user  = rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return done(null, false, { message: 'Incorrect password' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query(
      'SELECT id, tenant_id, email, role, name FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return done(null, false);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
