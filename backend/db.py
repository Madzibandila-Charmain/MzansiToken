"""
db.py - Persistance layer for the tokenizer leaderboard

"""
import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager
import time

DB_DIR = Path(__file__).parent / "data"
DB_DIR.mkdir(exist_ok=True)

DB_PATH = DB_DIR / "leaderboard.db"

BACKUP_DIR = Path(__file__).parent / "data/backups"
MAX_BACKUPS_TO_KEEP = 24 

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    active INTEGER NOT NULL DEFAULT 1
);
 
CREATE TABLE IF NOT EXISTS metrics (
    tokenizer_id   INTEGER PRIMARY KEY,
    -- Every figure below is the seven South African languages only.
    -- English is the baseline they are measured against, so averaging it
    -- in would add the same free 1.0 to every tokenizer alike.
    token_count    INTEGER,  -- tokens over the seven languages, summed
    fertility      REAL,     -- mean tokens per whitespace-separated word
    compression    REAL,     -- mean UTF-8 bytes per token
    token_premium  REAL,     -- mean tokens vs the SAME tokenizer on English
    f1             REAL,     -- mean morpheme-boundary F1 against NCHLT gold
    precision_score REAL,    -- named 'precision_score': PRECISION is a SQL reserved word
    recall         REAL,
    overall_score  REAL,     -- composite score, computed and written by the app
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tokenizer_id) REFERENCES tokenizers(id) ON DELETE CASCADE
);
"""


# Database backup functionality
def perform_backup() -> Path:
    BACKUP_DIR.mkdir(exist_ok=True, mode=0o700)
 
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_DIR / f"leaderboard-{timestamp}.db"
 
    source = sqlite3.connect(DB_PATH)
    dest = sqlite3.connect(backup_path)
    try:
        source.backup(dest)  # atomic, WAL-aware online backup
    finally:
        dest.close()
        source.close()
 
    backup_path.chmod(0o600)
    _rotate_old_backups()
    return backup_path

def _rotate_old_backups() -> None:
    backups = sorted(BACKUP_DIR.glob("leaderboard-*.db"), key=lambda p: p.stat().st_mtime)
    while len(backups) > MAX_BACKUPS_TO_KEEP:
        oldest = backups.pop(0)
        oldest.unlink()


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
    """Create the schema if it doesn't exist and apply small schema migrations."""
    with get_connection() as conn:
        conn.executescript(SCHEMA)

        # Existing databases were created before the active column existed.
        # Add it without deleting any existing leaderboard data.
        columns = conn.execute(
            "PRAGMA table_info(tokenizers);"
        ).fetchall()

        column_names = [row["name"] for row in columns]

        if "active" not in column_names:
            conn.execute(
                "ALTER TABLE tokenizers "
                "ADD COLUMN active INTEGER NOT NULL DEFAULT 1;"
            )

    # Restrict the db (and its WAL/SHM sidecar files) to the owning process's
    # user only. Nobody else on the machine should be able to open the file.
    for suffix in ("", "-wal", "-shm"):
        p = Path(str(DB_PATH) + suffix)
        if p.exists():
            os.chmod(p, 0o600)