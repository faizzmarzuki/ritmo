-- API keys become per-user so every account brings its own OpenAI/Spotify
-- credentials. Values are AES-256-GCM encrypted with TOKEN_ENC_KEY.
CREATE TABLE IF NOT EXISTS user_api_keys (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, key)
);

-- Keys saved while they were still server-wide belong to the first (owner) account.
-- Copy only when an owner exists (rows without one would violate NOT NULL and
-- brick boot before /api/auth/register can create the first account), and rename
-- instead of dropping so any uncopied rows survive for manual recovery. No app
-- code ever wrote to app_settings without a user, so app_settings_legacy is
-- expected to be empty; it exists on every install because 003 always creates it.
INSERT INTO user_api_keys (user_id, key, value)
  SELECT (SELECT id FROM users ORDER BY created_at LIMIT 1), key, value
  FROM app_settings
  WHERE EXISTS (SELECT 1 FROM users);

-- Rows the owner absorbed are removed; anything left in app_settings_legacy was
-- saved before any account existed and is kept for manual recovery only.
DELETE FROM app_settings WHERE EXISTS (SELECT 1 FROM users);

ALTER TABLE app_settings RENAME TO app_settings_legacy;
