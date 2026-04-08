-- Migration 0002: Add legacy report_purchases table for one-time purchases
-- Run with: wrangler d1 migrations apply compliance-checker-db --local
-- Or apply via Cloudflare dashboard

CREATE TABLE IF NOT EXISTS report_purchases (
id TEXT PRIMARY KEY,
scan_id TEXT NOT NULL,
stripe_payment_intent TEXT,
purchased_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_report_purchases_scan_id ON report_purchases(scan_id);
