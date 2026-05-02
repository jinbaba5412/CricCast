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
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id     CHAR(36)     NOT NULL,
  short_id      VARCHAR(10)  NOT NULL,
  name          VARCHAR(100) NOT NULL,
  short_name    VARCHAR(10)  NOT NULL,
  logo_type     ENUM('url','emoji','none') NOT NULL DEFAULT 'none',
  logo_value    VARCHAR(255) NOT NULL DEFAULT '',
  color         CHAR(7)      NOT NULL DEFAULT '#1e40af',
  captain_photo VARCHAR(255) NOT NULL DEFAULT '',
  bar_logo_mode ENUM('auto','logo','captain','both') NOT NULL DEFAULT 'auto',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenant_shortid (tenant_id, short_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS players (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id     CHAR(36)     NOT NULL,
  team_id       CHAR(36)     NOT NULL,
  name          VARCHAR(100) NOT NULL,
  -- D11 (B-BOWLER-NAME-FORMAT): optional broadcast-friendly form
  -- (e.g. "J. SMITH"). Empty ⇒ render uses `name` as-is.
  display_name  VARCHAR(60)  NOT NULL DEFAULT '',
  role          ENUM('UNASSIGNED','BAT','BOWL','SPIN','AR','WK','C','VC')
                             NOT NULL DEFAULT 'UNASSIGNED',
  batting_order TINYINT      NOT NULL DEFAULT 0,
  photo         VARCHAR(255) NOT NULL DEFAULT '',
  tags          JSON         NULL,
  stats_json    JSON         NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (team_id)   REFERENCES teams(id)   ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_team (team_id),
  INDEX idx_team_order (team_id, batting_order)
);

-- Tournaments: one or many per tenant. Format is the competition shape,
-- current_season increments on new season creation.
CREATE TABLE IF NOT EXISTS tournaments (
  id             CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id      CHAR(36)     NOT NULL,
  name           VARCHAR(100) NOT NULL,
  format         ENUM('league','knockout','hybrid') NOT NULL DEFAULT 'league',
  current_season INT          NOT NULL DEFAULT 1,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS seasons (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id     CHAR(36)     NOT NULL,
  tournament_id CHAR(36)     NOT NULL,
  season_number INT          NOT NULL,
  name          VARCHAR(100) NULL,
  status        ENUM('upcoming','active','completed','archived') NOT NULL DEFAULT 'upcoming',
  starts_on     DATE         NULL,
  ends_on       DATE         NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tournament_season (tournament_id, season_number),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS `groups` (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id  CHAR(36)     NOT NULL,
  season_id  CHAR(36)     NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_season_name (season_id, name),
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS group_teams (
  group_id CHAR(36) NOT NULL,
  team_id  CHAR(36) NOT NULL,
  seed     INT      NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, team_id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id)  REFERENCES teams(id)    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id            CHAR(36) NOT NULL,
  super_ball_enabled   TINYINT(1) NOT NULL DEFAULT 1,
  powerplay_enabled    TINYINT(1) NOT NULL DEFAULT 1,
  powerplay_mode       ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  free_hit_enabled     TINYINT(1) NOT NULL DEFAULT 1,
  penalty_runs_enabled TINYINT(1) NOT NULL DEFAULT 1,
  tie_allowed          TINYINT(1) NOT NULL DEFAULT 0,
  custom_overs_default TINYINT    NOT NULL DEFAULT 20,
  extra_json           JSON       NULL,
  updated_at           TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Matches are the core play unit. Can be linked to tournament/season/group
-- (for tournament play) OR left unlinked (for one-off / custom matches).
-- status enum: scheduled (fixture only) → ready (teams locked, ready to start)
--              → live (scoring in progress) → completed (final).
-- 'setup' and 'finished' remain as legacy aliases the app normalises on read.
CREATE TABLE IF NOT EXISTS matches (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id        CHAR(36)     NOT NULL,
  tournament_id    CHAR(36)     NULL,
  season_id        CHAR(36)     NULL,
  group_id         CHAR(36)     NULL,
  stage            ENUM('custom','group','round_of_16','quarter','semi','final','3rd_place')
                                NOT NULL DEFAULT 'custom',
  scheduled_date   DATE         NULL,
  scheduled_time   TIME         NULL,
  round_num        INT          NOT NULL DEFAULT 0,
  is_bye           TINYINT(1)   NOT NULL DEFAULT 0,
  next_match_id    CHAR(36)     NULL,
  next_slot        ENUM('bat','bowl') NULL,
  winner_team_id   VARCHAR(10)  NULL,
  result_type      ENUM('normal','tie','no_result','bye','super_over')
                                NOT NULL DEFAULT 'normal',
  bat_team_id      VARCHAR(10)  NOT NULL,
  bowl_team_id     VARCHAR(10)  NOT NULL,
  max_overs        TINYINT      NOT NULL DEFAULT 20,
  status           ENUM('scheduled','ready','setup','live','completed','finished')
                                NOT NULL DEFAULT 'ready',
  overlay_template VARCHAR(30)  NOT NULL DEFAULT 'Scoreboard',
  toss_winner      VARCHAR(10)  NULL,
  toss_election    ENUM('bat','field') NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at      TIMESTAMP    NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
  FOREIGN KEY (season_id)     REFERENCES seasons(id)     ON DELETE SET NULL,
  FOREIGN KEY (group_id)      REFERENCES `groups`(id)    ON DELETE SET NULL,
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tournament   (tournament_id),
  INDEX idx_season       (season_id),
  INDEX idx_group        (group_id),
  INDEX idx_sched        (tenant_id, scheduled_date)
);

CREATE TABLE IF NOT EXISTS match_settings (
  match_id             CHAR(36) NOT NULL,
  tenant_id            CHAR(36) NOT NULL,
  super_ball_enabled   TINYINT(1) NULL,
  powerplay_enabled    TINYINT(1) NULL,
  powerplay_mode       ENUM('auto','manual') NULL,
  free_hit_enabled     TINYINT(1) NULL,
  penalty_runs_enabled TINYINT(1) NULL,
  tie_allowed          TINYINT(1) NULL,
  custom_overs         TINYINT    NULL,
  extra_json           JSON       NULL,
  PRIMARY KEY (match_id),
  FOREIGN KEY (match_id)  REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_match_stats (
  match_id      CHAR(36) NOT NULL,
  tenant_id     CHAR(36) NOT NULL,
  player_id     CHAR(36) NOT NULL,
  team_id       CHAR(36) NOT NULL,
  runs_scored   INT   NOT NULL DEFAULT 0,
  balls_faced   INT   NOT NULL DEFAULT 0,
  fours         INT   NOT NULL DEFAULT 0,
  sixes         INT   NOT NULL DEFAULT 0,
  is_out        TINYINT(1) NOT NULL DEFAULT 0,
  overs_bowled  DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  runs_conceded INT   NOT NULL DEFAULT 0,
  wickets_taken INT   NOT NULL DEFAULT 0,
  maidens       INT   NOT NULL DEFAULT 0,
  catches       INT   NOT NULL DEFAULT 0,
  run_outs      INT   NOT NULL DEFAULT 0,
  stumpings     INT   NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, player_id),
  FOREIGN KEY (match_id)  REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_player_tenant (player_id, tenant_id),
  INDEX idx_team (team_id)
);

CREATE TABLE IF NOT EXISTS match_state (
  match_id   CHAR(36)     NOT NULL,
  tenant_id  CHAR(36)     NOT NULL,
  state_json MEDIUMTEXT   NOT NULL,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- L5 points_table + match_snapshots
CREATE TABLE IF NOT EXISTS points_table (
  tenant_id        CHAR(36)     NOT NULL,
  season_id        CHAR(36)     NOT NULL,
  team_short_id    VARCHAR(10)  NOT NULL,
  matches_played   INT          NOT NULL DEFAULT 0,
  wins             INT          NOT NULL DEFAULT 0,
  losses           INT          NOT NULL DEFAULT 0,
  ties             INT          NOT NULL DEFAULT 0,
  no_result        INT          NOT NULL DEFAULT 0,
  points           INT          NOT NULL DEFAULT 0,
  runs_for         INT          NOT NULL DEFAULT 0,
  overs_faced      DECIMAL(7,1) NOT NULL DEFAULT 0.0,
  runs_against     INT          NOT NULL DEFAULT 0,
  overs_bowled     DECIMAL(7,1) NOT NULL DEFAULT 0.0,
  nrr              DECIMAL(6,3) NOT NULL DEFAULT 0.000,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, season_id, team_short_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  INDEX idx_season_pts (season_id, points DESC, nrr DESC)
);

CREATE TABLE IF NOT EXISTS match_snapshots (
  match_id    CHAR(36)   NOT NULL,
  tenant_id   CHAR(36)   NOT NULL,
  snapshot    MEDIUMTEXT NOT NULL,
  winner      VARCHAR(128) DEFAULT NULL,
  win_desc    VARCHAR(128) DEFAULT NULL,
  captured_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id),
  FOREIGN KEY (match_id)  REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant_time (tenant_id, captured_at DESC)
);

-- ball_events: append-only log, one row per ball bowled.
-- `seq` is a monotonic sequence per match — this is the future source of
-- truth for scorecards and conflict detection.  Old columns kept.
CREATE TABLE IF NOT EXISTS ball_events (
  id                CHAR(36)    NOT NULL DEFAULT (UUID()),
  match_id          CHAR(36)    NOT NULL,
  tenant_id         CHAR(36)    NOT NULL,
  inning            TINYINT     NOT NULL DEFAULT 1,
  over_num          TINYINT     NOT NULL,
  ball_num          TINYINT     NOT NULL,
  seq               INT         NOT NULL DEFAULT 0,
  runs              TINYINT     NOT NULL DEFAULT 0,
  type              ENUM('run','wide','noball','wicket','bye','legbye','penalty','runout')
                                NOT NULL DEFAULT 'run',
  batsman           VARCHAR(80) NOT NULL,
  bowler            VARCHAR(80) NOT NULL,
  chip              VARCHAR(5)  NULL,
  dismissal_type    ENUM('bowled','caught','lbw','run_out','stumped','hit_wicket') NULL,
  dismissal_subtype ENUM('edge','top_edge','high_ball','direct_catch') NULL,
  catch_by          ENUM('field','keeper') NULL,
  catch_zone        TINYINT     NULL,           -- 1..12 (mini-ground zones) or NULL
  fielder_id        CHAR(36)    NULL,
  is_free_hit       TINYINT(1)  NOT NULL DEFAULT 0,
  is_super_over     TINYINT(1)  NOT NULL DEFAULT 0,
  created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_seq (match_id, seq),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  INDEX idx_match_order (match_id, inning, over_num, ball_num)
);

-- BUG FIXED: connect-mysql session store expects columns named 'sid' and 'session',
-- not 'session_id' and 'data'. Using the wrong names causes ER_BAD_FIELD_ERROR on
-- every single page load, breaking the entire application on a fresh install.
CREATE TABLE IF NOT EXISTS sessions (
  sid         VARCHAR(128) NOT NULL,
  expires     INT(11) UNSIGNED NOT NULL,
  session     MEDIUMTEXT,
  PRIMARY KEY (sid)
);

-- ─────────────────────────────────────────────────────────
-- Phase 4 tables (saas_admins, upgrade_requests, analytics)
-- BUG FIXED: these were previously only in schema_phase4.sql and
-- schema_complete.sql. A fresh install running just schema.sql was
-- missing critical tables; then seed.sql (which references saas_admins)
-- failed, leaving the SaaS admin panel unreachable.
-- ─────────────────────────────────────────────────────────
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

SET FOREIGN_KEY_CHECKS = 1;
