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
