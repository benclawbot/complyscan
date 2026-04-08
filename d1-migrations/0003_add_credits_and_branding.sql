-- Add user credits for credit-based purchases
ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 0;

-- Track per-scan unlock/purchase for users (subscription unlock is tracked via subscribers)
ALTER TABLE report_purchases ADD COLUMN user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_purchases_scan_id_unique ON report_purchases(scan_id);

-- White-label branding for agencies (and optionally users)
CREATE TABLE IF NOT EXISTS brandings (
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  agency_name TEXT,
  logo_url TEXT,
  logo_data_url TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (owner_type, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_brandings_owner ON brandings(owner_type, owner_id);

