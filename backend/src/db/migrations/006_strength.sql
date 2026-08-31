-- Per-exercise detail for manually logged gym sessions.
-- `sets` is a JSON array of reps per set, e.g. [10, 12, 8] — set count varies.
CREATE TABLE IF NOT EXISTS strength_exercises (
  id           TEXT PRIMARY KEY,
  activity_id  TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  rest_s       INTEGER,
  sets         TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_strength_ex_activity ON strength_exercises(activity_id);
CREATE INDEX IF NOT EXISTS idx_strength_ex_user ON strength_exercises(user_id);
