-- Exercise library scraped from fitnessprogramer.com: one row per exercise
-- with its demo GIF (stored locally under data/exercise-gifs) and parsed info.
CREATE TABLE IF NOT EXISTS exercises (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  gif_url      TEXT,
  gif_path     TEXT,
  overview     TEXT,
  instructions TEXT,          -- JSON array of steps
  tips         TEXT,          -- JSON array
  mistakes     TEXT,          -- JSON array
  content_text TEXT,          -- full plain-text article body
  muscles      TEXT,          -- JSON array of primary muscle slugs
  equipment    TEXT,          -- JSON array of equipment slugs
  scraped_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);
