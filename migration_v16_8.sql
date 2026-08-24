PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS online_sessions (
  session_id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_online_sessions_last_seen ON online_sessions(last_seen);
