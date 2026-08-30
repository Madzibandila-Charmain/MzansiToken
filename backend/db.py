"""
db.py - Persistance layer for the tokenizer leaderboard

"""
import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_DIR = Path(__file__).resolve().parent / "data"
DB_DIR.mkdir(exist_ok=True)

DB_PATH = DB_DIR / "leaderboard.db"

METRIC_COLUMN_MAP = {
    "token_count": "token_count",
    "fertility": "fertility",
    "compression": "compression",
    "token_premium": "token_premium",
    "f1": "f1",
    "precision": "precision_score",
    "recall": "recall",
    "overall_score": "overall_score",
}

ALLOWED_SORT_COLUMNS = {
    "token_count": "m.token_count",
    "fertility": "m.fertility",
    "compression": "m.compression",
    "token_premium": "m.token_premium",
    "f1": "m.f1",
    "precision": "m.precision_score",
    "recall": "m.recall",
    "overall_score": "m.overall_score",
    "name": "t.name",
    "created_at": "t.created_at",
}


SCHEMA = """
CREATE TABLE IF NOT EXISTS tokenizers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
 
CREATE TABLE IF NOT EXISTS metrics (
    tokenizer_id   INTEGER PRIMARY KEY,
    token_count    INTEGER,  -- total tokens produced on the reference corpus
    fertility      REAL,     -- avg tokens per word
    compression    REAL,     -- chars per token (or bytes per token)
    token_premium  REAL,     -- e.g. tokens used vs. a baseline tokenizer
    f1             REAL,     -- downstream/segmentation F1
    precision_score REAL,    -- named 'precision_score': PRECISION is a SQL reserved word
    recall         REAL,
    overall_score  REAL,     -- composite score, computed and written by the app
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tokenizer_id) REFERENCES tokenizers(id) ON DELETE CASCADE
);
"""


@contextmanager
def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")   # crash-safe, concurrent readers
    conn.execute("PRAGMA synchronous = NORMAL;")  # safe + fast under WAL
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()



def init_db():
    """Create the schema if it doesn't exist, and lock down file permissions."""
    with get_connection() as conn:
        conn.executescript(SCHEMA)
 
    # Restrict the db (and its WAL/SHM sidecar files) to the owning process's
    # user only. Nobody else on the machine should be able to open the file.
    for suffix in ("", "-wal", "-shm"):
        p = Path(str(DB_PATH) + suffix)
        if p.exists():
            os.chmod(p, 0o600)
