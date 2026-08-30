"""
leaderboard_service.py - All services required for leaderboard persistance

"""

from db import ALLOWED_SORT_COLUMNS, METRIC_COLUMN_MAP, get_connection, perform_backup

# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def add_tokenizer(name: str, metrics: dict) -> int:
    """
    Insert a new tokenizer with its metrics. Returns the new tokenizer id.
    `metrics` keys must be a subset of the metrics table columns; unknown
    keys are ignored rather than interpolated into SQL.
    """
    # Translate caller-facing keys (e.g. "precision") to real column names
    # (e.g. "precision_score") via the whitelist — unknown keys are dropped.
    metric_cols = [METRIC_COLUMN_MAP[c] for c in metrics if c in METRIC_COLUMN_MAP]
 
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO tokenizers (name) VALUES (?);",
            (name,),
        )
        tokenizer_id = cur.lastrowid
 
        if metric_cols:
            columns = ", ".join(metric_cols)  # column names from whitelist only
            placeholders = ", ".join("?" for _ in metric_cols)
            values = [metrics[c] for c in metrics if c in METRIC_COLUMN_MAP]
            conn.execute(
                f"INSERT INTO metrics (tokenizer_id, {columns}) VALUES (?, {placeholders});",
                (tokenizer_id, *values),
            )
        else:
            conn.execute(
                "INSERT INTO metrics (tokenizer_id) VALUES (?);",
                (tokenizer_id,),
            )
        perform_backup()
        return tokenizer_id


def upsert_tokenizer(name: str, metrics: dict) -> int:
    """Create a tokenizer if it does not exist, otherwise update its metrics."""
    existing = get_tokenizer_by_name(name)
    if existing:
        update_metrics(existing["id"], metrics)
        return existing["id"]

    return add_tokenizer(name, metrics)
 
 
def update_metrics(tokenizer_id: int, metrics: dict) -> None:
    """Update one or more metric columns for an existing tokenizer."""
    metric_cols = [METRIC_COLUMN_MAP[c] for c in metrics if c in METRIC_COLUMN_MAP]
    if not metric_cols:
        return
 
    set_clause = ", ".join(f"{c} = ?" for c in metric_cols)  # names from whitelist only
    values = [metrics[c] for c in metrics if c in METRIC_COLUMN_MAP]
 
    with get_connection() as conn:
        conn.execute(
            f"UPDATE metrics SET {set_clause}, updated_at = datetime('now') "
            f"WHERE tokenizer_id = ?;",
            (*values, tokenizer_id),
        )
        perform_backup()
 
 
def remove_tokenizer(tokenizer_id: int) -> None:
    """Removing the tokenizer cascades to its metrics row (ON DELETE CASCADE)."""
    with get_connection() as conn:
        conn.execute("DELETE FROM tokenizers WHERE id = ?;", (tokenizer_id,))
        perform_backup()
 
 
# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------
 
def get_leaderboard(sort_by: str = "overall_score", descending: bool = True) -> list[dict]:
    """
    Return all tokenizers ranked by the requested metric.
    `sort_by` is looked up in ALLOWED_SORT_COLUMNS — anything not in that
    whitelist raises instead of ever reaching the query string.
    """
    if sort_by not in ALLOWED_SORT_COLUMNS:
        raise ValueError(f"Unknown sort column: {sort_by!r}")
 
    column = ALLOWED_SORT_COLUMNS[sort_by]
    direction = "DESC" if descending else "ASC"
 
    query = f"""
        SELECT t.id, t.name, t.created_at,
               m.token_count, m.fertility, m.compression, m.token_premium,
               m.f1, m.precision_score AS "precision", m.recall,
               m.overall_score, m.updated_at
        FROM tokenizers t
        JOIN metrics m ON m.tokenizer_id = t.id
        ORDER BY {column} {direction} NULLS LAST;
    """
    with get_connection() as conn:
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]
 
 
def get_tokenizer_by_name(name: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM tokenizers WHERE name = ?;", (name,)
        ).fetchone()
        return dict(row) if row else None
