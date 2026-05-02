-- CricCast SaaS — Full Schema
-- Run once on a fresh DB. Safe to re-run (IF NOT EXISTS).

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS tenants (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  slug         VARCHAR(50)  NOT NULL UNIQUE,
  name         VARCHAR(100) NOT NULL,
  plan         ENUM('free','pro') NOT NULL DEFAULT 'free',
  max_matches  SMALLINT     NOT NULL DEFAULT 5,
  max_teams    SMALLINT     NOT NULL DEFAULT 10,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_slug (slug)
);

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id     CHAR(36)     NOT NULL,
  email         VARCHAR(191) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('scorer','admin','saas_admin') NOT NULL DEFAULT 'scorer',
  name          VARCHAR(100) NOT NULL DEFAULT '',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenant_email (tenant_id, email),
  INDEX idx_email (email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id    CHAR(36)     NOT NULL,
  short_id     VARCHAR(10)  NOT NULL,
  name         VARCHAR(100) NOT NULL,
  short_name   VARCHAR(10)  NOT NULL,
  logo_type    ENUM('url','emoji','none') NOT NULL DEFAULT 'none',
  logo_value   VARCHAR(255) NOT NULL DEFAULT '',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenant_shortid (tenant_id, short_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS players (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id    CHAR(36)     NOT NULL,
  team_id      CHAR(36)     NOT NULL,
  name         VARCHAR(100) NOT NULL,
  role         ENUM('C','VC','BAT','BOWL','AR','WK') NOT NULL DEFAULT 'BAT',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (team_id)   REFERENCES teams(id)   ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_team (team_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id        CHAR(36)     NOT NULL,
  bat_team_id      VARCHAR(10)  NOT NULL,
  bowl_team_id     VARCHAR(10)  NOT NULL,
  max_overs        TINYINT      NOT NULL DEFAULT 20,
  status           ENUM('setup','live','finished') NOT NULL DEFAULT 'setup',
  overlay_template VARCHAR(30)  NOT NULL DEFAULT 'Scoreboard',
  toss_winner      VARCHAR(10)  NULL,
  toss_election    ENUM('bat','field') NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant_status (tenant_id, status)
);

CREATE TABLE IF NOT EXISTS match_state (
  match_id   CHAR(36)     NOT NULL,
  tenant_id  CHAR(36)     NOT NULL,
  state_json MEDIUMTEXT   NOT NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ball_events (
  id           CHAR(36)    NOT NULL DEFAULT (UUID()),
  match_id     CHAR(36)    NOT NULL,
  tenant_id    CHAR(36)    NOT NULL,
  inning       TINYINT     NOT NULL DEFAULT 1,
  over_num     TINYINT     NOT NULL,
  ball_num     TINYINT     NOT NULL,
  runs         TINYINT     NOT NULL DEFAULT 0,
  type         ENUM('run','wide','noball','wicket','bye','legbye') NOT NULL DEFAULT 'run',
  batsman      VARCHAR(80) NOT NULL,
  bowler       VARCHAR(80) NOT NULL,
  chip         VARCHAR(5)  NULL,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  INDEX idx_match_order (match_id, inning, over_num, ball_num)
);

-- BUG FIXED (regression): schema_complete.sql previously kept the OLD column
-- names (session_id, data) that connect-mysql does NOT understand. The
-- fix already applied in schema.sql was missed here, so anyone running
-- schema_complete.sql on a fresh install got ER_BAD_FIELD_ERROR on every
-- page load. Now matches schema.sql: columns are 'sid' and 'session'.
CREATE TABLE IF NOT EXISTS sessions (
  sid         VARCHAR(128) NOT NULL,
  expires     INT(11) UNSIGNED NOT NULL,
  session     MEDIUMTEXT,
  PRIMARY KEY (sid)
);

SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────────────────────────────────────────────────
-- Phase 4 tables (saas_admins, upgrade_requests, analytics)
-- ─────────────────────────────────────────────────────────
-- Phase 4 additions — run in phpMyAdmin after Phase 1-3 schema

CREATE TABLE IF NOT EXISTS saas_admins (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS upgrade_requests (
  id           CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id    CHAR(36)     NOT NULL,
  requested_by CHAR(36)     NOT NULL,
  status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  message      TEXT         NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at  TIMESTAMP    NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id)    REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id             CHAR(36)  NOT NULL DEFAULT (UUID()),
  snapshot_date  DATE      NOT NULL UNIQUE,
  tenant_count   INT       NOT NULL DEFAULT 0,
  active_matches INT       NOT NULL DEFAULT 0,
  balls_today    INT       NOT NULL DEFAULT 0,
  new_tenants    INT       NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_date (snapshot_date)
);
