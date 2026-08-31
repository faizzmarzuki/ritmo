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
-- Deliberately no "WHERE EXISTS users" guard: if app_settings holds keys but no
-- account exists yet, user_id resolves to NULL and the NOT NULL constraint aborts
-- the whole migration (it runs in a transaction), keeping the table and its data
-- instead of silently dropping them below.
INSERT INTO user_api_keys (user_id, key, value)
  SELECT (SELECT id FROM users ORDER BY created_at LIMIT 1), key, value
  FROM app_settings;

DROP TABLE app_settings;
