-- ============================================================
-- CricCast — D11 (B-BOWLER-NAME-FORMAT)
-- Adds players.display_name so admins can override the long
-- legal name with a short broadcast-friendly form (e.g.
-- "J. SMITH"). Empty string ⇒ fall back to players.name.
-- Safe to run multiple times.
-- ============================================================

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='players' AND COLUMN_NAME='display_name');
SET @sql := IF(@col=0,
  'ALTER TABLE players ADD COLUMN display_name VARCHAR(60) NOT NULL DEFAULT '''' AFTER name',
  'SELECT ''players.display_name already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
