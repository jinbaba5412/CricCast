-- ═══════════════════════════════════════════════════════════════════
-- L5 — Points table + completed-match snapshot (idempotent)
-- ═══════════════════════════════════════════════════════════════════

-- TABLE: points_table — one row per (tenant, season, team). Rebuilt
-- whenever a match in that season transitions to 'completed'. Bye wins
-- add +1W/+2Pts but do not affect NRR.
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
) ENGINE=InnoDB;

-- TABLE: match_snapshots — frozen scorecard/ball-by-ball JSON captured
-- on 'completed' so the Dashboard can render completed matches without
-- depending on the live match_state row (which gets wiped on new match).
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
) ENGINE=InnoDB;
