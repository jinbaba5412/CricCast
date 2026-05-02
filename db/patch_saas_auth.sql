-- ============================================================
-- CricCast SaaS — Auth System Patch SQL  (v2 — phpMyAdmin safe)
-- ============================================================
-- Run this once in phpMyAdmin / MySQL.  Fully idempotent: safe on
-- fresh, partially-migrated, and fully-migrated DBs.
--
-- ── HOW TO IMPORT IN phpMyAdmin ──
-- 1. Select your database in the left pane (NOT the "phpmyadmin"
--    or "information_schema" DBs).
-- 2. Click the "Import" tab at the top.
-- 3. "Choose file" → patch_saas_auth.sql
-- 4. Format: SQL.  Leave everything else default.
-- 5. Click "Go".
--
-- BUG FIXED (v1 → v2):
--   • v1 used `PREPARE … EXECUTE … DEALLOCATE` blocks at the top
--     level. cPanel + phpMyAdmin's import splits on `;` between the
--     PREPARE and EXECUTE lines, breaking the prepared-statement
--     handle and aborting the import with "Unknown prepared
--     statement handler (s)".
--   • v1 also assumed `sessions` and `saas_admins` already existed.
--     If schema_phase4.sql had not been run yet, INSERT IGNORE INTO
--     saas_admins exploded with ER_NO_SUCH_TABLE.
--   • v2 wraps every dynamic step in a stored procedure (single
--     atomic block — phpMyAdmin imports it OK), and adds CREATE
--     TABLE IF NOT EXISTS guards so a partially-bootstrapped DB
--     still comes good.
-- ============================================================

-- ── 0. Ensure the auxiliary tables exist (idempotent) ──────
CREATE TABLE IF NOT EXISTS sessions (
  sid     VARCHAR(128) NOT NULL,
  expires INT(11) UNSIGNED NOT NULL,
  session MEDIUMTEXT,
  PRIMARY KEY (sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_admins (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 1. Rename legacy session columns (only if they exist) ──
-- connect-mysql expects `sid` and `session`. The original schema used
-- `session_id` and `data`. Each rename is wrapped in a stored
-- procedure so a single CALL replaces the PREPARE/EXECUTE dance and
-- survives phpMyAdmin's delimiter handling.
DROP PROCEDURE IF EXISTS _ccPatchRenameSession;

DELIMITER $$
CREATE PROCEDURE _ccPatchRenameSession()
BEGIN
  DECLARE has_session_id INT DEFAULT 0;
  DECLARE has_data       INT DEFAULT 0;

  SELECT COUNT(*) INTO has_session_id
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'sessions'
     AND COLUMN_NAME  = 'session_id';

  IF has_session_id = 1 THEN
    ALTER TABLE sessions
      CHANGE COLUMN session_id sid VARCHAR(128) NOT NULL;
  END IF;

  SELECT COUNT(*) INTO has_data
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'sessions'
     AND COLUMN_NAME  = 'data';

  IF has_data = 1 THEN
    ALTER TABLE sessions
      CHANGE COLUMN data session MEDIUMTEXT;
  END IF;
END$$
DELIMITER ;

CALL _ccPatchRenameSession();
DROP PROCEDURE _ccPatchRenameSession;

-- ── 2. Seed the SaaS super-admin row ────────────────────────
-- Password hash = "admin123" (bcrypt, 10 rounds). CHANGE IMMEDIATELY
-- after first login via /saas-admin/profile or `mysql > UPDATE …`.
INSERT IGNORE INTO saas_admins (id, email, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000099',
  'admin@criccast.app',
  '$2a$10$YdKSQ4d.sM0MqQ/hh/N8ZeK3P7m9Nc1JJKKv89.9mXOi75MKIhEJO'
);

-- ── 3. Demote the cross-tenant default admin in `users` ─────
-- The default admin was originally seeded with role='saas_admin' in
-- the per-tenant `users` table. With requireTenantMatch enforced it
-- can no longer cross tenants — and `saas_admin` has no meaning at
-- club level anyway. Demote to plain `admin` so they can manage the
-- default club.
UPDATE users
   SET role = 'admin'
 WHERE email = 'admin@criccast.app'
   AND role  = 'saas_admin';

-- ── 4. Verification queries (read-only — safe to ignore) ────
SELECT 'sessions columns' AS check_name, COLUMN_NAME, DATA_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'sessions';

SELECT 'saas_admins rows' AS check_name, id, email FROM saas_admins;

SELECT 'admin user role' AS check_name, email, role
  FROM users
 WHERE email = 'admin@criccast.app';
