-- Personal food dictionary: corrections and hinted logs teach the vision agent
-- the user's own (Malaysian) foods, injected into every future analysis.
CREATE TABLE IF NOT EXISTS food_memory (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name_key     TEXT NOT NULL,            -- lowercased canonical name for matching
  display_name TEXT NOT NULL,            -- as the user typed it
  grams        REAL,
  kcal         REAL,
  protein      REAL,
  carbs        REAL,
  fat          REAL,
  fiber        REAL,
  sugar        REAL,
  times_used   INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name_key)
);
CREATE INDEX IF NOT EXISTS idx_food_memory_user ON food_memory(user_id, times_used DESC);
