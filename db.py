import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path(__file__).resolve().parent / "osint_history.sqlite3"

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS searches(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT,
                query_type TEXT NOT NULL,
                query_value TEXT NOT NULL,
                keyword TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()

def log_search(user_id: int, username: str, query_type: str, query_value: str, keyword: str = ""):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """INSERT INTO searches(user_id, username, query_type, query_value, keyword, created_at)
               VALUES(?,?,?,?,?,?)""",
            (user_id, username or "", query_type, query_value, keyword or "",
             datetime.now(timezone.utc).isoformat())
        )
        conn.commit()

def get_history(user_id: int, limit: int = 15):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            """SELECT query_type, query_value, keyword, created_at
               FROM searches WHERE user_id=? ORDER BY id DESC LIMIT ?""",
            (user_id, limit)
        )
        return cur.fetchall()
