-- ============================================================
-- CricCast — D2 (B-LOGO-OR-CAPTAIN)
-- Adds teams.bar_logo_mode so admins can choose what shows on
-- the broadcast bar: team logo, captain photo, both, or auto
-- (legacy behavior: captain if present, else logo).
-- Safe to run multiple times.
-- ============================================================

-- teams.bar_logo_mode
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='teams' AND COLUMN_NAME='bar_logo_mode');
SET @sql := IF(@col=0,
  'ALTER TABLE teams ADD COLUMN bar_logo_mode ENUM(''auto'',''logo'',''captain'',''both'') NOT NULL DEFAULT ''auto'' AFTER captain_photo',
  'SELECT ''teams.bar_logo_mode already exists'' AS info');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
