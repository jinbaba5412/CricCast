-- ============================================================
-- CricCast — Teams & Players schema upgrade
-- Safe to run multiple times: checks INFORMATION_SCHEMA before ALTER.
-- Adds:
--   teams.color            (hex, drives scoreboard bar colour)
--   teams.captain_photo    (url/path, overlays use it)
--   players.batting_order  (1..11, 0 = unassigned)
--   players.photo          (identification photo path)
--   players.tags           (JSON: ["c"], ["wk"], ["c","wk"], ["vc"] ...)
--   players.stats_json     (reserved for future stats system)
-- Extends players.role enum with UNASSIGNED and SPIN.
-- ============================================================

-- teams.color
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teams' AND COLUMN_NAME='color');
SET @sql := IF(@col=0,
  'ALTER TABLE teams ADD COLUMN color CHAR(7) NOT NULL DEFAULT ''#1e40af'' AFTER logo_value',
  'SELECT ''teams.color already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- teams.captain_photo
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teams' AND COLUMN_NAME='captain_photo');
SET @sql := IF(@col=0,
  'ALTER TABLE teams ADD COLUMN captain_photo VARCHAR(255) NOT NULL DEFAULT '''' AFTER color',
  'SELECT ''teams.captain_photo already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- players: extend role enum (idempotent — MODIFY is safe to re-run)
ALTER TABLE players
  MODIFY COLUMN role ENUM('UNASSIGNED','BAT','BOWL','SPIN','AR','WK','C','VC')
    NOT NULL DEFAULT 'UNASSIGNED';

-- players.batting_order
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='batting_order');
SET @sql := IF(@col=0,
  'ALTER TABLE players ADD COLUMN batting_order TINYINT NOT NULL DEFAULT 0 AFTER role',
  'SELECT ''players.batting_order already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- players.photo
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='photo');
SET @sql := IF(@col=0,
  'ALTER TABLE players ADD COLUMN photo VARCHAR(255) NOT NULL DEFAULT '''' AFTER batting_order',
  'SELECT ''players.photo already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- players.tags
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='tags');
SET @sql := IF(@col=0,
  'ALTER TABLE players ADD COLUMN tags JSON NULL AFTER photo',
  'SELECT ''players.tags already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- players.stats_json (reserved for future)
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='stats_json');
SET @sql := IF(@col=0,
  'ALTER TABLE players ADD COLUMN stats_json JSON NULL AFTER tags',
  'SELECT ''players.stats_json already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Index for ordering
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND INDEX_NAME='idx_team_order');
SET @sql := IF(@idx=0,
  'CREATE INDEX idx_team_order ON players(team_id, batting_order)',
  'SELECT ''idx_team_order already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- One-time purge of stale team master-data inside match_state.state_json
-- (so ghost teams from pre-upgrade Controller edits can't reappear).
-- The Controller will rebuild its team list from /api/club/match/:id/state-seed.
UPDATE match_state
   SET state_json = JSON_REMOVE(state_json, '$.teams')
 WHERE JSON_EXTRACT(state_json, '$.teams') IS NOT NULL;
