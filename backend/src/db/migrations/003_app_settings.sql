-- Server-wide settings entered from the UI (API keys, etc.).
-- Values are AES-256-GCM encrypted with TOKEN_ENC_KEY before they land here.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
