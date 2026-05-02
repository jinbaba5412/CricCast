-- ============================================================
-- CricCast — Session 1 (L0 + L1 partial)
-- Tournament / Season / Group foundations, match lifecycle,
-- extended ball_events, tenant and match settings, player stats.
--
-- Safe to run multiple times — every ALTER checks INFORMATION_SCHEMA
-- before applying. Safe on live DBs — no data loss anywhere.
-- ============================================================

-- ─── helper pattern used throughout ──────────────────────────
-- SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS ...);
-- SET @sql := IF(@col=0, 'ALTER ...', 'SELECT ''already'' ');
-- PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- ──────────────────────────────────────────────────────────────


-- ============================================================
-- TABLE: tournaments
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id     CHAR(36)     NOT NULL,
  name          VARCHAR(100) NOT NULL,
  format        ENUM('league','knockout','hybrid') NOT NULL DEFAULT 'league',
  current_season INT         NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
);


-- ============================================================
-- TABLE: seasons  (one or more per tournament — isolated stats)
-- ============================================================
CREATE TABLE IF NOT EXISTS seasons (
  id             CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id      CHAR(36)     NOT NULL,
  tournament_id  CHAR(36)     NOT NULL,
  season_number  INT          NOT NULL,
  name           VARCHAR(100) NULL,      -- optional "2026 Spring"
  status         ENUM('upcoming','active','completed','archived')
                              NOT NULL DEFAULT 'upcoming',
  starts_on      DATE         NULL,
  ends_on        DATE         NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tournament_season (tournament_id, season_number),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id)     REFERENCES tenants(id)     ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
);


-- ============================================================
-- TABLE: groups  (league groups within a season)
-- ============================================================
CREATE TABLE IF NOT EXISTS `groups` (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id  CHAR(36)     NOT NULL,
  season_id  CHAR(36)     NOT NULL,
  name       VARCHAR(50)  NOT NULL,    -- "Group A"
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_season_name (season_id, name),
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant (tenant_id)
);


-- ============================================================
-- TABLE: group_teams  (team ↔ group membership per season)
-- ============================================================
CREATE TABLE IF NOT EXISTS group_teams (
  group_id    CHAR(36) NOT NULL,
  team_id     CHAR(36) NOT NULL,
  seed        INT      NOT NULL DEFAULT 0,   -- for knockout seeding
  PRIMARY KEY (group_id, team_id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id)  REFERENCES teams(id)    ON DELETE CASCADE
);


-- ============================================================
-- TABLE: tenant_settings  (per-tenant defaults that carry into
-- every new match unless overridden)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id         CHAR(36) NOT NULL,
  super_ball_enabled TINYINT(1) NOT NULL DEFAULT 1,
  powerplay_enabled  TINYINT(1) NOT NULL DEFAULT 1,
  powerplay_mode     ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  free_hit_enabled   TINYINT(1) NOT NULL DEFAULT 1,
  penalty_runs_enabled TINYINT(1) NOT NULL DEFAULT 1,
  tie_allowed        TINYINT(1) NOT NULL DEFAULT 0,  -- admin must explicitly allow ties
  custom_overs_default TINYINT NOT NULL DEFAULT 20,
  extra_json         JSON     NULL,  -- forward-compat bucket
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: match_settings  (per-match overrides; falls back to
-- tenant_settings via the app layer)
-- ============================================================
CREATE TABLE IF NOT EXISTS match_settings (
  match_id           CHAR(36) NOT NULL,
  tenant_id          CHAR(36) NOT NULL,
  super_ball_enabled TINYINT(1) NULL,
  powerplay_enabled  TINYINT(1) NULL,
  powerplay_mode     ENUM('auto','manual') NULL,
  free_hit_enabled   TINYINT(1) NULL,
  penalty_runs_enabled TINYINT(1) NULL,
  tie_allowed        TINYINT(1) NULL,
  custom_overs       TINYINT  NULL,
  extra_json         JSON     NULL,
  PRIMARY KEY (match_id),
  FOREIGN KEY (match_id)  REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);


-- ============================================================
-- TABLE: player_match_stats  (aggregated per player per match —
-- rolled up from ball_events on match completion so aggregation
-- queries stay fast across seasons)
-- ============================================================
CREATE TABLE IF NOT EXISTS player_match_stats (
  match_id        CHAR(36) NOT NULL,
  tenant_id       CHAR(36) NOT NULL,
  player_id       CHAR(36) NOT NULL,
  team_id         CHAR(36) NOT NULL,

  -- Batting
  runs_scored     INT   NOT NULL DEFAULT 0,
  balls_faced     INT   NOT NULL DEFAULT 0,
  fours           INT   NOT NULL DEFAULT 0,
  sixes           INT   NOT NULL DEFAULT 0,
  is_out          TINYINT(1) NOT NULL DEFAULT 0,

  -- Bowling
  overs_bowled    DECIMAL(4,1) NOT NULL DEFAULT 0.0,  -- 3.4 = 3 overs 4 balls
  runs_conceded   INT   NOT NULL DEFAULT 0,
  wickets_taken   INT   NOT NULL DEFAULT 0,
  maidens         INT   NOT NULL DEFAULT 0,

  -- Fielding
  catches         INT   NOT NULL DEFAULT 0,
  run_outs        INT   NOT NULL DEFAULT 0,
  stumpings       INT   NOT NULL DEFAULT 0,

  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, player_id),
  FOREIGN KEY (match_id)  REFERENCES matches(id)  ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)  ON DELETE CASCADE,
  INDEX idx_player_tenant (player_id, tenant_id),
  INDEX idx_team (team_id)
);


-- ============================================================
-- matches — lifecycle + tournament + scheduling columns
-- ============================================================
-- status enum extended: scheduled, ready, live, completed
-- Existing rows: 'setup' ≡ 'ready', 'finished' ≡ 'completed'
-- The app layer keeps accepting 'setup' and 'finished' as aliases,
-- but new writes always use the new values.
ALTER TABLE matches
  MODIFY COLUMN status
    ENUM('scheduled','ready','setup','live','completed','finished')
      NOT NULL DEFAULT 'ready';

-- Migrate legacy rows to new canonical values. Idempotent.
UPDATE matches SET status = 'ready'     WHERE status = 'setup';
UPDATE matches SET status = 'completed' WHERE status = 'finished';

-- Tournament linkage
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='tournament_id');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN tournament_id CHAR(36) NULL AFTER tenant_id,
                       ADD INDEX idx_tournament (tournament_id),
                       ADD FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL',
  'SELECT ''matches.tournament_id already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='season_id');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN season_id CHAR(36) NULL AFTER tournament_id,
                       ADD INDEX idx_season (season_id),
                       ADD FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL',
  'SELECT ''matches.season_id already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='group_id');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN group_id CHAR(36) NULL AFTER season_id,
                       ADD INDEX idx_group (group_id),
                       ADD FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL',
  'SELECT ''matches.group_id already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='stage');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN stage
      ENUM(''custom'',''group'',''round_of_16'',''quarter'',''semi'',''final'',''3rd_place'')
      NOT NULL DEFAULT ''custom'' AFTER group_id',
  'SELECT ''matches.stage already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Scheduling
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='scheduled_date');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN scheduled_date DATE NULL AFTER stage,
                       ADD COLUMN scheduled_time TIME NULL AFTER scheduled_date,
                       ADD INDEX idx_sched (tenant_id, scheduled_date)',
  'SELECT ''matches.scheduled_date already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Round number (for league round-robin / knockout bracket order)
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='round_num');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN round_num INT NOT NULL DEFAULT 0 AFTER scheduled_time',
  'SELECT ''matches.round_num already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Bye flag: for league byes (no opponent, auto-win)
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='is_bye');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN is_bye TINYINT(1) NOT NULL DEFAULT 0 AFTER round_num',
  'SELECT ''matches.is_bye already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Bracket next-match linkage (knockout progression)
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='next_match_id');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN next_match_id CHAR(36) NULL AFTER is_bye,
                       ADD COLUMN next_slot ENUM(''bat'',''bowl'') NULL AFTER next_match_id',
  'SELECT ''matches.next_match_id already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Winner short_id (denormalised so points-table query is one JOIN instead of two)
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matches' AND COLUMN_NAME='winner_team_id');
SET @sql := IF(@col=0,
  'ALTER TABLE matches ADD COLUMN winner_team_id VARCHAR(10) NULL AFTER next_slot,
                       ADD COLUMN result_type ENUM(''normal'',''tie'',''no_result'',''bye'',''super_over'')
                         NOT NULL DEFAULT ''normal'' AFTER winner_team_id',
  'SELECT ''matches.winner_team_id already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;


-- ============================================================
-- ball_events — dismissal + super over + free hit + seq
-- ============================================================
-- Extend `type` enum: add 'penalty' for penalty runs
ALTER TABLE ball_events
  MODIFY COLUMN type
    ENUM('run','wide','noball','wicket','bye','legbye','penalty','runout')
      NOT NULL DEFAULT 'run';

-- BUG FIXED: original combined `ADD COLUMN seq INT DEFAULT 0` +
-- `ADD UNIQUE KEY uq_match_seq (match_id, seq)` blew up on any DB
-- with existing ball_events rows: every row got seq=0 and the
-- unique key add failed with "Duplicate entry" on the second ball
-- per match. We now do it in three guarded steps:
--   1. Add the column with DEFAULT 0 (no unique key yet).
--   2. Backfill seq with a per-match running counter ordered by
--      (inning, over_num, ball_num, created_at) so existing data
--      gets a deterministic, monotonic sequence.
--   3. Add the unique key once every row has a unique seq.
-- Every step is idempotent — re-running the patch is safe.
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ball_events' AND COLUMN_NAME='seq');
SET @sql := IF(@col=0,
  'ALTER TABLE ball_events ADD COLUMN seq INT NOT NULL DEFAULT 0 AFTER ball_num',
  'SELECT ''ball_events.seq column already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Backfill any rows that still have seq=0 (or duplicates) with a
-- per-match running counter. Uses a session variable trick that
-- works on MySQL 5.7+ and 8.x. Only touches rows where the seq
-- value is suspect (multiple zeros / duplicates within a match).
UPDATE ball_events be
JOIN (
  SELECT id,
         (@s := IF(@m = match_id, @s + 1, 1)) AS new_seq,
         (@m := match_id) AS m
  FROM ball_events,
       (SELECT @s := 0, @m := '') AS init
  ORDER BY match_id, inning, over_num, ball_num, created_at, id
) ranked ON ranked.id = be.id
SET be.seq = ranked.new_seq
WHERE be.match_id IN (
  SELECT match_id FROM (
    SELECT match_id
      FROM ball_events
     GROUP BY match_id, seq
    HAVING COUNT(*) > 1
  ) dup
);

-- Now add the unique key — guaranteed safe after the backfill.
SET @key := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA=DATABASE()
               AND TABLE_NAME='ball_events'
               AND INDEX_NAME='uq_match_seq');
SET @sql := IF(@key=0,
  'ALTER TABLE ball_events ADD UNIQUE KEY uq_match_seq (match_id, seq)',
  'SELECT ''ball_events.uq_match_seq already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ball_events' AND COLUMN_NAME='dismissal_type');
SET @sql := IF(@col=0,
  'ALTER TABLE ball_events
      ADD COLUMN dismissal_type
        ENUM(''bowled'',''caught'',''lbw'',''run_out'',''stumped'',''hit_wicket'') NULL
        AFTER chip,
      ADD COLUMN dismissal_subtype
        ENUM(''edge'',''top_edge'',''high_ball'',''direct_catch'') NULL
        AFTER dismissal_type,
      ADD COLUMN catch_by
        ENUM(''field'',''keeper'') NULL AFTER dismissal_subtype,
      ADD COLUMN catch_zone TINYINT NULL AFTER catch_by,    -- 1..12 or NULL
      ADD COLUMN fielder_id CHAR(36) NULL AFTER catch_zone,
      ADD COLUMN is_free_hit TINYINT(1) NOT NULL DEFAULT 0 AFTER fielder_id,
      ADD COLUMN is_super_over TINYINT(1) NOT NULL DEFAULT 0 AFTER is_free_hit',
  'SELECT ''ball_events.dismissal_type already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;


-- ============================================================
-- Seed tenant_settings for existing tenants with sensible defaults
-- ============================================================
INSERT INTO tenant_settings (tenant_id)
SELECT id FROM tenants
 WHERE id NOT IN (SELECT tenant_id FROM tenant_settings);
