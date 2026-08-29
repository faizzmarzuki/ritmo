-- ── identity ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  json    TEXT NOT NULL DEFAULT '{}'
);

-- ── provider connections ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,            -- garmin
  mode          TEXT,                     -- official | connect (garmin only)
  external_id   TEXT,                     -- athlete id / garmin user id
  status        TEXT NOT NULL DEFAULT 'connected',
  access_token  TEXT,                     -- AES-GCM encrypted
  refresh_token TEXT,                     -- AES-GCM encrypted
  token_secret  TEXT,                     -- AES-GCM encrypted (OAuth 1.0a)
  expires_at    INTEGER,                  -- unix seconds
  scope         TEXT,
  last_sync_at  TEXT,
  last_error    TEXT,
  meta          TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_conn_external ON connections(provider, external_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  state      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  provider   TEXT NOT NULL,
  verifier   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── activities ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  name           TEXT,
  sport          TEXT,                   -- run | ride | swim | walk | strength | other
  sport_raw      TEXT,
  start_time     TEXT NOT NULL,          -- ISO 8601 UTC
  start_local    TEXT,
  date_key       TEXT NOT NULL,          -- YYYY-MM-DD, local
  timezone       TEXT,
  duration_s     INTEGER DEFAULT 0,
  moving_s       INTEGER DEFAULT 0,
  distance_m     REAL DEFAULT 0,
  elevation_m    REAL DEFAULT 0,
  calories       INTEGER DEFAULT 0,
  avg_hr         INTEGER,
  max_hr         INTEGER,
  avg_speed_ms   REAL,
  avg_pace_s_km  REAL,
  steps          INTEGER,
  raw_path       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_act_user_date ON activities(user_id, date_key);
CREATE INDEX IF NOT EXISTS idx_act_user_start ON activities(user_id, start_time);

CREATE TABLE IF NOT EXISTS activity_streams (
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,            -- heartrate | velocity | altitude | ...
  data        TEXT NOT NULL,            -- JSON array
  PRIMARY KEY (activity_id, kind)
);

-- ── daily wellness ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_metrics (
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key           TEXT NOT NULL,
  provider           TEXT NOT NULL,
  steps              INTEGER,
  distance_m         REAL,
  floors             INTEGER,
  calories_active    INTEGER,
  calories_bmr       INTEGER,
  resting_hr         INTEGER,
  min_hr             INTEGER,
  max_hr             INTEGER,
  avg_hr             INTEGER,
  stress_avg         INTEGER,
  stress_max         INTEGER,
  bb_high            INTEGER,
  bb_low             INTEGER,
  bb_charged         INTEGER,
  bb_drained         INTEGER,
  intensity_minutes  INTEGER,
  raw_path           TEXT,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date_key, provider)
);

CREATE TABLE IF NOT EXISTS hr_samples (
  user_id  TEXT NOT NULL,
  ts       TEXT NOT NULL,
  bpm      INTEGER NOT NULL,
  source   TEXT NOT NULL,
  PRIMARY KEY (user_id, ts, source)
);
CREATE INDEX IF NOT EXISTS idx_hr_user_ts ON hr_samples(user_id, ts);

CREATE TABLE IF NOT EXISTS body_battery_samples (
  user_id TEXT NOT NULL,
  ts      TEXT NOT NULL,
  level   INTEGER,
  stress  INTEGER,
  PRIMARY KEY (user_id, ts)
);
CREATE INDEX IF NOT EXISTS idx_bb_user_ts ON body_battery_samples(user_id, ts);

CREATE TABLE IF NOT EXISTS sleep_records (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key    TEXT NOT NULL,
  provider    TEXT NOT NULL,
  start_ts    TEXT,
  end_ts      TEXT,
  total_min   INTEGER,
  deep_min    INTEGER,
  light_min   INTEGER,
  rem_min     INTEGER,
  awake_min   INTEGER,
  score       INTEGER,
  raw_path    TEXT,
  PRIMARY KEY (user_id, date_key, provider)
);

CREATE TABLE IF NOT EXISTS user_metrics (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key    TEXT NOT NULL,
  provider    TEXT NOT NULL,
  vo2max      REAL,
  fitness_age REAL,
  PRIMARY KEY (user_id, date_key, provider)
);

CREATE TABLE IF NOT EXISTS body_comp (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts           TEXT NOT NULL,
  date_key     TEXT NOT NULL,
  weight_kg    REAL,
  bmi          REAL,
  body_fat_pct REAL,
  muscle_kg    REAL,
  source       TEXT NOT NULL DEFAULT 'manual'
);
CREATE INDEX IF NOT EXISTS idx_bodycomp_user_ts ON body_comp(user_id, ts);

-- ── nutrition ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key   TEXT NOT NULL,
  slot       TEXT NOT NULL,             -- breakfast | lunch | snack | dinner
  name       TEXT NOT NULL,
  eaten_at   TEXT NOT NULL,
  photo_path TEXT,
  note       TEXT,
  source     TEXT NOT NULL DEFAULT 'manual',  -- manual | photo-agent
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date_key);

CREATE TABLE IF NOT EXISTS food_items (
  id         TEXT PRIMARY KEY,
  meal_id    TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  portion    TEXT,
  grams      REAL,
  kcal       REAL NOT NULL DEFAULT 0,
  protein    REAL DEFAULT 0,
  carbs      REAL DEFAULT 0,
  fat        REAL DEFAULT 0,
  fiber      REAL DEFAULT 0,
  sugar      REAL DEFAULT 0,
  confidence REAL,
  source     TEXT NOT NULL DEFAULT 'manual',
  position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_food_meal ON food_items(meal_id);

CREATE TABLE IF NOT EXISTS food_analyses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  image_sha   TEXT NOT NULL,
  photo_path  TEXT,
  provider    TEXT,
  model       TEXT,
  prompt_ver  TEXT,
  result      TEXT NOT NULL,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  latency_ms  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_analysis_sha ON food_analyses(user_id, image_sha);

CREATE TABLE IF NOT EXISTS hydration_events (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  ts       TEXT NOT NULL,
  ml       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hydration_user_date ON hydration_events(user_id, date_key);

-- ── habits ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  archived   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goal_logs (
  user_id  TEXT NOT NULL,
  goal_id  TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (goal_id, date_key)
);

-- ── operational ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  external_id  TEXT,
  received_at  TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  error        TEXT,
  payload      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_events(status, received_at);

CREATE TABLE IF NOT EXISTS sync_runs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  provider    TEXT NOT NULL,
  kind        TEXT NOT NULL,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  items       INTEGER DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'running',
  error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_user ON sync_runs(user_id, started_at);
