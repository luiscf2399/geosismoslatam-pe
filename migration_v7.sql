
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS source_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_key_time
  ON source_snapshots(source_key, fetched_at DESC);

CREATE TABLE IF NOT EXISTS emergency_declarations (
  decree TEXT PRIMARY KEY,
  cause TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  official_url TEXT,
  last_verified_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS emergency_districts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decree TEXT NOT NULL,
  department TEXT,
  province TEXT,
  district TEXT NOT NULL,
  ubigeo TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  source_url TEXT,
  UNIQUE(decree, department, province, district)
);

CREATE TABLE IF NOT EXISTS agri_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observed_at INTEGER NOT NULL,
  department TEXT,
  province TEXT,
  district TEXT,
  crop TEXT NOT NULL,
  variable TEXT NOT NULL,
  value REAL,
  unit TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT,
  official INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS impact_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_time INTEGER,
  department TEXT,
  province TEXT,
  district TEXT,
  category TEXT NOT NULL,
  affected REAL,
  unit TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT,
  official INTEGER NOT NULL DEFAULT 1,
  verified_at INTEGER
);

CREATE TABLE IF NOT EXISTS media_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  published_at INTEGER,
  outlet TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  department TEXT,
  province TEXT,
  district TEXT,
  category TEXT,
  verification_status TEXT NOT NULL DEFAULT 'secondary',
  ingested_at INTEGER NOT NULL
);
