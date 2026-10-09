"""
leaderboard_service.py - All services required for leaderboard persistance

"""

from db import ALLOWED_SORT_COLUMNS, METRIC_COLUMN_MAP, get_connection, perform_backup

# How many tokenizers can be active on the leaderboard at once - one named
# constant, checked in the three places below, instead of the literal 10
# repeated at each one. A repeated literal is exactly the kind of thing
# that is easy to change in two places and miss the third.
MAX_ACTIVE_TOKENIZERS = 15

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

    # Outside the "with", not inside it. get_connection only commits when
    # the block exits, and perform_backup opens its own connection - so a
    # backup taken inside the block copies the database as it was BEFORE
    # this write, and a write that then fails is archived rolled back.
    perform_backup()

    return tokenizer_id

def upsert_tokenizer(name: str, metrics: dict) -> int:
    """Create a tokenizer or reactivate an existing tokenizer."""

    existing = get_tokenizer_by_name(name)

    if existing:
        if existing.get("active") == 1:
            update_metrics(existing["id"], metrics)
            return existing["id"]

        with get_connection() as conn:
            active_count = conn.execute(
                "SELECT COUNT(*) FROM tokenizers WHERE active = 1;"
            ).fetchone()[0]

            if active_count >= MAX_ACTIVE_TOKENIZERS:
                raise ValueError(
                    f"The leaderboard already has {MAX_ACTIVE_TOKENIZERS} "
                    f"active tokenizers."
                )

            conn.execute(
                "UPDATE tokenizers SET active = 1 WHERE id = ?;",
                (existing["id"],)
            )

        perform_backup()

        update_metrics(existing["id"], metrics)

        return existing["id"]

    with get_connection() as conn:
        active_count = conn.execute(
            "SELECT COUNT(*) FROM tokenizers WHERE active = 1;"
        ).fetchone()[0]

        if active_count >= MAX_ACTIVE_TOKENIZERS:
            raise ValueError(
                f"The leaderboard already has {MAX_ACTIVE_TOKENIZERS} "
                f"active tokenizers."
            )

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

def remove_tokenizer(tokenizer_id: int) -> bool:
    """
    Take a tokenizer off the active leaderboard, keeping its metrics.

    Returns whether a row actually changed, so the caller can tell a real
    removal from an id that was never there. Without this the endpoint
    happily confirmed deleting entry 99999.
    """
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE tokenizers SET active = 0 WHERE id = ?;",
            (tokenizer_id,),
        )
        changed = cursor.rowcount > 0

    if changed:
        perform_backup()

    return changed

def restore_tokenizer(name: str) -> dict:
    """
    Restore a previously saved tokenizer without recalculating its metrics.

    The tokenizer must already exist in the database. Its saved metrics are
    reused exactly as they were stored.
    """
    existing = get_saved_tokenizer(name)

    if existing is None:
        raise ValueError(
            f"No saved leaderboard entry exists for '{name}'."
        )

    if existing.get("active") == 1:
        return existing

    with get_connection() as conn:
        active_count = conn.execute(
            "SELECT COUNT(*) FROM tokenizers WHERE active = 1;"
        ).fetchone()[0]

        if active_count >= MAX_ACTIVE_TOKENIZERS:
            raise ValueError(
                f"The leaderboard already has {MAX_ACTIVE_TOKENIZERS} "
                f"active tokenizers."
            )

        conn.execute(
            "UPDATE tokenizers SET active = 1 WHERE id = ?;",
            (existing["id"],)
        )

    perform_backup()

    return get_saved_tokenizer(name)
 
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
        WHERE t.active = 1
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

def get_saved_tokenizer(name: str) -> dict | None:
    """Return a tokenizer and its saved metrics, whether active or inactive."""
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT t.id,
                   t.name,
                   t.created_at,
                   t.active,
                   m.token_count,
                   m.fertility,
                   m.compression,
                   m.token_premium,
                   m.f1,
                   m.precision_score AS "precision",
                   m.recall,
                   m.overall_score,
                   m.updated_at
            FROM tokenizers t
            JOIN metrics m ON m.tokenizer_id = t.id
            WHERE t.name = ?;
            """,
            (name,),
        ).fetchone()

        return dict(row) if row else None
