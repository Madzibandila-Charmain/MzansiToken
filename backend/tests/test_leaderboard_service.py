import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pathlib import Path

import db as db_module
from app.services import leaderboard_service


@pytest.fixture(autouse=True)
def use_temp_db(tmp_path, monkeypatch):
    """
    Create an isolated temporary database for each test and disable backups.

    This fixture monkeypatches the DB path and backup directory so tests do not
    interfere with the real application database or leave backup files on disk.
    """
    tmp_db = tmp_path / "leaderboard.db"
    tmp_backups = tmp_path / "backups"

    monkeypatch.setattr(db_module, "DB_PATH", tmp_db)
    monkeypatch.setattr(db_module, "BACKUP_DIR", tmp_backups)

    # Avoid creating actual backup files during tests by no-oping perform_backup
    monkeypatch.setattr(leaderboard_service, "perform_backup", lambda: None)

    # Initialize schema in the temporary database
    db_module.init_db()

    yield


def test_add_tokenizer_creates_tokenizer_and_metrics():
    """
    Test that `add_tokenizer` inserts a row in `tokenizers` and a corresponding
    `metrics` row with the provided metric columns. The function should return
    the new tokenizer id which can be used to look up the tokenizer.
    """
    tid = leaderboard_service.add_tokenizer("tok_add", {"token_count": 100, "precision": 0.5})
    assert isinstance(tid, int)

    # Confirm tokenizer exists by name
    t = leaderboard_service.get_tokenizer_by_name("tok_add")
    assert t is not None
    assert t["name"] == "tok_add"

    # The leaderboard should include the tokenizer and its metrics
    lb = leaderboard_service.get_leaderboard()
    found = [r for r in lb if r["name"] == "tok_add"]
    assert len(found) == 1
    assert found[0]["token_count"] == 100
    assert found[0]["precision"] == 0.5


def test_upsert_tokenizer_updates_existing_metrics():
    """
    `upsert_tokenizer` should update metrics when a tokenizer already exists.
    We create a tokenizer, then call upsert with a changed value and verify
    the metrics were updated in the DB.
    """
    tid = leaderboard_service.add_tokenizer("tok_upsert", {"token_count": 50})
    # Upsert with new token_count value
    leaderboard_service.upsert_tokenizer("tok_upsert", {"token_count": 75})

    lb = leaderboard_service.get_leaderboard()
    row = next(r for r in lb if r["name"] == "tok_upsert")
    assert row["token_count"] == 75


def test_update_metrics_with_no_valid_columns_is_noop():
    """
    Calling `update_metrics` with keys that are not present in the
    `METRIC_COLUMN_MAP` should not raise and should leave metrics unchanged.
    """
    tid = leaderboard_service.add_tokenizer("tok_update_noop", {"token_count": 10})
    # Attempt to update with an unknown metric key
    leaderboard_service.update_metrics(tid, {"not_a_metric": 123})

    lb = leaderboard_service.get_leaderboard()
    row = next(r for r in lb if r["name"] == "tok_update_noop")
    # token_count should remain the original value
    assert row["token_count"] == 10


def test_remove_tokenizer_deactivates_but_preserves_saved_measurement():
    """
    Removing a tokenizer should deactivate it rather than delete it.

    The tokenizer and its metrics must remain saved so that the same
    tokenizer can be restored later without recalculating its measurements.
    """
    tid = leaderboard_service.add_tokenizer(
        "tok_remove",
        {"token_count": 5}
    )

    # Confirm the tokenizer exists and is active.
    tokenizer = leaderboard_service.get_tokenizer_by_name("tok_remove")
    assert tokenizer is not None
    assert tokenizer["active"] == 1

    # Remove it from the active leaderboard.
    leaderboard_service.remove_tokenizer(tid)

    # The tokenizer should still exist in the database.
    tokenizer = leaderboard_service.get_tokenizer_by_name("tok_remove")
    assert tokenizer is not None

    # It should now be inactive.
    assert tokenizer["active"] == 0

    # Its saved measurement should still be available.
    saved = leaderboard_service.get_saved_tokenizer("tok_remove")
    assert saved is not None
    assert saved["token_count"] == 5

    # It should no longer appear on the active leaderboard.
    leaderboard = leaderboard_service.get_leaderboard()
    assert not any(row["name"] == "tok_remove" for row in leaderboard)


def test_get_leaderboard_invalid_sort_raises():
    """
    The `get_leaderboard` function should validate `sort_by` against the
    ALLOWED_SORT_COLUMNS whitelist and raise a ValueError for unknown keys.
    """
    with pytest.raises(ValueError):
        leaderboard_service.get_leaderboard(sort_by="not_a_column")


def test_get_leaderboard_sorts_and_puts_nulls_last():
    """
    Ensure that sorting by a metric returns rows in the expected order and that
    NULL metrics are positioned last due to the `NULLS LAST` clause in the
    query. We insert one tokenizer with an explicit overall_score and one
    without (NULL) then assert the non-null row appears first in the default
    descending order.
    """
    leaderboard_service.add_tokenizer("tok_non_null", {"overall_score": 0.5})
    leaderboard_service.add_tokenizer("tok_null", {})

    lb = leaderboard_service.get_leaderboard()
    names = [r["name"] for r in lb]
    # non-null score should appear before the null score when descending
    assert names.index("tok_non_null") < names.index("tok_null")
