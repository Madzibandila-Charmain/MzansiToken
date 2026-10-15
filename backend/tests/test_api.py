"""
test_api.py — endpoint tests against the assembled app.

The app is built by main.py from all four routers, so importing it here is what
proves the router split actually holds together.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app
from app.services.flores_state import corpus
from app.services.tokenizer_state import SUPPORTED_TOKENIZERS

client = TestClient(app)


# ── Unexpected errors ─────────────────────────────────────────────────────────

def test_an_unexpected_error_still_reaches_the_page():
    # An unhandled exception used to produce a 500 with no CORS header, which
    # the browser blocks - so the page said "Cannot reach the backend. Is the
    # backend running?" about a backend that was running. It must come back
    # as a readable JSON error that the frontend at :5173 is allowed to see.
    from unittest.mock import patch

    quiet = TestClient(app, raise_server_exceptions=False)

    with patch("app.routers.tokenizer_router.get_or_load_tokenizer", side_effect=RuntimeError("boom")):
        response = quiet.get("/tokenizer/gpt2", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 500
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "unexpected error" in response.json()["detail"]


# ── Basic health ──────────────────────────────────────────────────────────────

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "MzansiToken API is running"


def test_get_options():
    response = client.get("/options")
    assert response.status_code == 200

    data = response.json()
    assert "languages" in data
    assert "tokenizers" in data
    assert len(data["languages"]) == 8
    assert data["tokenizers"] == SUPPORTED_TOKENIZERS


def test_sentence_count():
    response = client.get("/sentence-count")
    assert response.status_code == 200
    # Read the expected value from the loaded corpus rather than hard-coding a
    # number — it is 997 today, but changes the moment anyone swaps the split.
    assert response.json()["count"] == len(corpus["English"])


def test_status_reports_the_loaded_corpus():
    response = client.get("/status")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["corpus_loaded"] is True
    assert data["languages"] == 8
    assert data["sentences"] == 997


def test_tokenize_corpus_respects_the_limit():
    response = client.get("/tokenize-corpus/gpt2", params={"language": "isiZulu", "limit": 5})
    assert response.status_code == 200

    data = response.json()
    assert list(data["tokenized"].keys()) == ["isiZulu"]
    assert len(data["tokenized"]["isiZulu"]) == 5


def test_tokenize_corpus_rejects_an_oversized_limit():
    # Without a ceiling this endpoint can return several MB of JSON.
    response = client.get("/tokenize-corpus/gpt2", params={"limit": 5000})
    assert response.status_code == 400
    assert "limit must be between" in response.json()["detail"]


def test_tokenize_corpus_rejects_an_unknown_language():
    response = client.get("/tokenize-corpus/gpt2", params={"language": "Klingon"})
    assert response.status_code == 400


# ── The router split itself ───────────────────────────────────────────────────

def test_all_routes_are_registered():
    """
    If someone forgets an include_router() in main.py, or moves an endpoint and
    mistypes its path, the frontend gets a 404 and no other test notices. This
    one fails immediately.

    The paths are read from the OpenAPI schema rather than app.routes, because
    newer FastAPI keeps included routers as wrapper objects instead of
    flattening them into that list. The schema is the same thing /docs renders,
    so it is the supported way to ask "what is actually registered".
    """
    paths = set(app.openapi()["paths"].keys())
    expected = {
        "/",
        "/metrics/{model_name}",
        "/metrics/bulk",
        "/tokenizer/{model_name}",
        "/compare",
        "/example/model/{model_name}",
        "/sentence-count",
        "/tokenize-text/{model_name}",
        "/tokenize-corpus/{model_name}",
        "/options",
        "/inspect/default",
        "/inspect/upload",
        "/tokenize-text",
        "/mbi/{model_name}",
        "/compare_mbi",
    }
    assert expected <= paths


#── Morphology endpoint test ─────────────────────
def test_morphology_metrics_endpoint_returns_values():
    response = client.get("/mbi/gpt2", params={"language": "isiZulu"})

    assert response.status_code == 200

    data = response.json()

    assert "model_name" in data
    assert data["model_name"] == "gpt2"

    assert "language" in data

    assert "metrics" in data

    assert set(data["metrics"]) == {
        "precision",
        "recall",
        "f1",
        "aligned_boundaries",
        "total_gold_boundaries",
    }

    assert isinstance(data["metrics"]["precision"], float)
    assert isinstance(data["metrics"]["recall"], float)
    assert isinstance(data["metrics"]["f1"], float)

    assert isinstance(data["metrics"]["aligned_boundaries"], int)
    assert isinstance(data["metrics"]["total_gold_boundaries"], int)

    assert data["metrics"]["aligned_boundaries"] <= data["metrics"]["total_gold_boundaries"]


# ── Bulk metrics (Rank's per-language grid) ──────────────────────────────────

def test_metrics_bulk_returns_each_tokenizer_keyed_by_name():
    # Rank's grid used to call /metrics/{name} once per board row. This is
    # the replacement: the same per-language data, for every requested name,
    # in one response.
    response = client.get(
        "/metrics/bulk", params={"names": "gpt2,bert-base-uncased"}
    )

    assert response.status_code == 200

    data = response.json()

    assert set(data["metrics"]) == {"gpt2", "bert-base-uncased"}
    assert data["errors"] == {}

    # Each entry is exactly what GET /metrics/{name} itself returns - this
    # is the same cache, read in bulk rather than one name at a time.
    single = client.get("/metrics/gpt2").json()
    assert data["metrics"]["gpt2"] == single


def test_metrics_bulk_reports_a_bad_name_without_failing_the_batch():
    response = client.get(
        "/metrics/bulk", params={"names": "gpt2,not-a-real-tokenizer"}
    )

    # One bad id costs its own row, not the request.
    assert response.status_code == 200

    data = response.json()

    assert "gpt2" in data["metrics"]
    assert "not-a-real-tokenizer" in data["errors"]
    assert "not-a-real-tokenizer" not in data["metrics"]


def test_metrics_bulk_ignores_blank_names():
    # A trailing comma, or repeated commas, must not ask the tokenizer
    # loader to resolve an empty string.
    response = client.get("/metrics/bulk", params={"names": "gpt2,,"})

    assert response.status_code == 200

    data = response.json()

    assert list(data["metrics"]) == ["gpt2"]
    assert data["errors"] == {}


def test_metrics_bulk_reports_a_malformed_name_without_failing_the_batch():
    # Unlike "not found on Hugging Face" (a ValueError), a malformed id
    # is rejected by validate_tokenizer() as an HTTPException, raised
    # before any network call. The batch has to catch that one too.
    response = client.get(
        "/metrics/bulk", params={"names": "gpt2,not valid/ /id"}
    )

    assert response.status_code == 200

    data = response.json()

    assert "gpt2" in data["metrics"]
    assert "not valid/ /id" in data["errors"]


# ── Validation errors reach the frontend as readable 400s ─────────────────────

def test_malformed_tokenizer_name_is_rejected():
    # Any well-formed model id is allowed now, so this checks the format guard
    # instead. The spaces mean it never reaches Hugging Face at all.
    response = client.post(
        "/inspect/default",
        json={"language": "isiZulu", "tokenizer": "not a real model"},
    )
    assert response.status_code == 400
    assert "not a valid Hugging Face model id" in response.json()["detail"]


def test_unsupported_language_is_rejected():
    response = client.post(
        "/inspect/default",
        json={"language": "Klingon", "tokenizer": "gpt2"},
    )
    assert response.status_code == 400
    assert "Unsupported language" in response.json()["detail"]


def test_missing_field_is_rejected():
    # React sending a malformed body must not produce a 500.
    response = client.post("/inspect/default", json={"language": "isiZulu"})
    assert response.status_code == 422


# ── Input size caps ───────────────────────────────────────────────────────────

def test_upload_over_the_size_cap_is_rejected():
    # 6 MB against a 5 MB limit. The read aborts partway, so the whole file is
    # never held in memory, and no tokenizer is loaded for a rejected request.
    big = b"x" * (6 * 1024 * 1024)
    response = client.post(
        "/inspect/upload",
        files={"file": ("big.txt", big, "text/plain")},
        data={"tokenizer": "gpt2"},
    )
    assert response.status_code == 413
    assert "too large" in response.json()["detail"].lower()


def test_typed_text_over_the_character_cap_is_rejected():
    response = client.post(
        "/tokenize-text",
        json={"text": "a" * 20_001, "tokenizer": "gpt2"},
    )
    assert response.status_code == 400
    assert "too long" in response.json()["detail"].lower()


def test_typed_text_at_the_character_cap_is_accepted():
    # Off-by-one: exactly at the limit must still work.
    response = client.post(
        "/tokenize-text",
        json={"text": "word " * 4000, "tokenizer": "gpt2"},
    )
    assert response.status_code == 200

# ── The caps are served, not just enforced ────────────────────────────────────
#
# The frontend shows these next to the upload control. They come from the
# module that enforces them so the number on screen cannot drift from the
# number being applied - which is the only reason serving them is worth doing.

def test_options_reports_the_input_limits():
    limits = client.get("/options").json()["limits"]

    assert limits["max_upload_bytes"] == 5 * 1024 * 1024
    assert limits["max_upload_mb"] == 5
    assert limits["max_extracted_chars"] == 2_000_000
    assert limits["max_text_chars"] == 20_000

    assert ".txt" in limits["accepted_extensions"]
    assert ".docx" in limits["accepted_extensions"]
    assert ".pdf" not in limits["accepted_extensions"]


def test_served_limits_match_the_enforced_ones():
    # The point of the shared module. If someone re-introduces a second
    # definition, this fails rather than the UI quietly lying.
    from app.services import limits as limits_module

    served = client.get("/options").json()["limits"]

    assert served["max_upload_bytes"] == limits_module.MAX_UPLOAD_BYTES
    assert served["max_extracted_chars"] == limits_module.MAX_EXTRACTED_CHARS
    assert served["max_text_chars"] == limits_module.MAX_TEXT_CHARS


# ── An uploaded corpus is measured against itself alone ───────────────────────

def upload(text: str, name: str = "mine.txt"):
    return client.post(
        "/inspect/upload",
        files={"file": (name, text.encode(), "text/plain")},
        data={"tokenizer": "gpt2"},
    )


def test_uploaded_corpus_has_no_token_premium():
    """
    Both premium formulas divide by a FLORES English figure. An uploaded file
    is not a translation of that corpus, so the ratio would carry the domain
    difference as well as the language one and report the total as a property
    of the tokenizer. None is the honest answer.
    """
    metrics = upload("Sawubona umhlaba\nUnjani namuhla\n" * 20).json()["metrics"]

    assert metrics["token_premium"] is None
    assert metrics["token_premium_basis"] == "standalone"


def test_uploaded_corpus_still_reports_the_other_three():
    # Decoupling the premium must not quietly cost the metrics that ARE
    # computable from the file alone.
    metrics = upload("Sawubona umhlaba\nUnjani namuhla\n" * 20).json()["metrics"]

    assert metrics["token_count"] > 0
    assert metrics["fertility"] > 0
    assert metrics["compression"] > 0


def test_uploading_does_not_populate_the_english_baseline_cache():
    """
    The standalone basis exists partly so an upload stops paying to tokenize
    the whole English FLORES corpus for a baseline it then discards.
    """
    from app.services import metrics as metrics_module

    metrics_module._english_baseline_cache.clear()

    upload("Sawubona umhlaba\n" * 20)

    assert metrics_module._english_baseline_cache == {}


def test_default_corpus_still_has_a_premium():
    # Regression guard: the built-in corpus IS parallel to FLORES English,
    # so its premium remains meaningful and must not be swept up in this.
    response = client.post(
        "/inspect/default",
        json={"language": "isiZulu", "tokenizer": "gpt2"},
    )

    metrics = response.json()["metrics"]

    assert metrics["token_premium"] is not None
    assert metrics["token_premium_basis"] != "standalone"

# ── Vocabulary metrics and byte premium ───────────────────────────────────────

def test_default_corpus_has_renyi_and_a_byte_premium():
    metrics = client.post(
        "/inspect/default",
        json={"language": "isiZulu", "tokenizer": "gpt2"},
    ).json()["metrics"]

    assert 0 < metrics["renyi_efficiency"] <= 1

    # Same bytes whatever the tokenizer: it is the language, not the model.
    expected = round(
        sum(len(s.encode("utf-8")) for s in corpus["isiZulu"])
        / sum(len(s.encode("utf-8")) for s in corpus["English"]),
        3,
    )
    assert metrics["byte_premium"] == expected


def test_english_byte_premium_is_one():
    metrics = client.post(
        "/inspect/default",
        json={"language": "English", "tokenizer": "gpt2"},
    ).json()["metrics"]

    assert metrics["byte_premium"] == 1.0


def test_uploaded_corpus_has_renyi_but_no_byte_premium():
    metrics = upload("Sawubona umhlaba\nUnjani namuhla\n" * 20).json()["metrics"]

    assert metrics["byte_premium"] is None
    assert metrics["renyi_efficiency"] is not None
    assert metrics["productivity"] >= 1
    assert metrics["idiosyncrasy"] >= 1


def test_typed_text_has_no_byte_premium():
    metrics = client.post(
        "/tokenize-text",
        json={"text": "Sawubona umhlaba, unjani?", "tokenizer": "gpt2"},
    ).json()["metrics"]

    assert metrics["byte_premium"] is None


def test_per_language_metrics_carry_renyi_and_byte_premium():
    per_language = client.get("/metrics/gpt2").json()

    for language, entry in per_language.items():
        assert {"renyi_efficiency", "byte_premium"} <= set(entry), language
        assert "productivity" not in entry, language

    assert per_language["English"]["byte_premium"] == 1.0


def test_vocabulary_has_productivity_and_idiosyncrasy_for_every_language():
    summary = client.get("/vocabulary/gpt2")

    assert summary.status_code == 200
    summary = summary.json()

    assert set(summary) == set(corpus)

    for language, entry in summary.items():
        assert set(entry) == {"productivity", "idiosyncrasy"}, language
        assert entry["productivity"] >= 1, language
        assert entry["idiosyncrasy"] >= 1, language


def test_vocabulary_for_just_the_languages_asked_for():
    response = client.get("/vocabulary/gpt2", params={"languages": "isiZulu, Sesotho"})

    assert response.status_code == 200
    assert set(response.json()) == {"isiZulu", "Sesotho"}

    # The same numbers as asking for everything.
    everything = client.get("/vocabulary/gpt2").json()
    assert response.json()["isiZulu"] == everything["isiZulu"]


def test_vocabulary_does_not_wait_for_the_whole_corpus_metrics():
    # Asking for one language must not tokenize all eight.
    from unittest.mock import patch

    with patch("app.routers.metrics_router.get_or_compute_metrics") as whole:
        client.get("/vocabulary/gpt2", params={"languages": "isiZulu"})

    whole.assert_not_called()


def test_the_default_corpus_brings_its_vocabulary_with_everything_else():
    # One answer for every card, so they fill in together - and the same
    # numbers the charts get from /vocabulary.
    response = client.post("/inspect/default", json={"language": "isiZulu", "tokenizer": "gpt2"})

    assert response.status_code == 200
    metrics = response.json()["metrics"]

    for name in ("token_count", "fertility", "token_premium", "renyi_efficiency",
                 "byte_premium", "productivity", "idiosyncrasy"):
        assert name in metrics, name

    alone = client.get("/vocabulary/gpt2", params={"languages": "isiZulu"}).json()["isiZulu"]
    assert metrics["productivity"] == alone["productivity"]
    assert metrics["idiosyncrasy"] == alone["idiosyncrasy"]


def test_the_default_corpus_gets_the_charts_ready_too():
    # The page's one wait covers the charts: after the boxes' request, the
    # charts' own requests are answered from memory, nothing worked out twice.
    from unittest.mock import patch
    from app.services import flores_state

    real_metrics = flores_state.compute_efficiency_metrics
    real_vocabulary = flores_state.compute_vocabulary_by_language

    with patch.object(flores_state, "compute_efficiency_metrics", side_effect=real_metrics) as whole, \
         patch.object(flores_state, "compute_vocabulary_by_language", side_effect=real_vocabulary) as vocabulary:

        client.post("/inspect/default", json={"language": "Sepedi", "tokenizer": "gpt2"})

        assert whole.call_count == 1
        assert vocabulary.call_count == len(corpus)

        assert client.get("/metrics/gpt2").status_code == 200
        assert set(client.get("/vocabulary/gpt2").json()) == set(corpus)
        client.post("/inspect/default", json={"language": "isiZulu", "tokenizer": "gpt2"})

    assert whole.call_count == 1
    assert vocabulary.call_count == len(corpus)


def test_vocabulary_for_an_unknown_language_is_a_readable_400():
    response = client.get("/vocabulary/gpt2", params={"languages": "Klingon"})

    assert response.status_code == 400
    assert "Klingon" in response.json()["detail"]


def test_vocabulary_differs_between_tokenizers():
    one = client.get("/vocabulary/gpt2", params={"languages": "Setswana"}).json()
    two = client.get("/vocabulary/xlm-roberta-base", params={"languages": "Setswana"}).json()

    assert one["Setswana"]["productivity"] != two["Setswana"]["productivity"]


def test_vocabulary_for_a_vendor_prefixed_name():
    response = client.get("/vocabulary/openai-community/gpt2-large", params={"languages": "isiZulu"})

    assert response.status_code == 200
    assert "isiZulu" in response.json()


def test_vocabulary_for_a_missing_model_is_a_readable_400():
    response = client.get("/vocabulary/someone/missing-model")

    assert response.status_code == 400
    assert "detail" in response.json()


# ── Restoring an entry saved before the vocabulary metrics existed ────────────

@pytest.fixture
def temp_leaderboard(tmp_path, monkeypatch):
    import db as db_module
    from app.services import leaderboard_service

    monkeypatch.setattr(db_module, "DB_PATH", tmp_path / "leaderboard.db")
    monkeypatch.setattr(db_module, "BACKUP_DIR", tmp_path / "backups")
    monkeypatch.setattr(leaderboard_service, "perform_backup", lambda: None)
    db_module.init_db()

    # Saved the old way: every scored metric, none of the new three, and
    # taken off the board so it can be restored.
    tokenizer_id = leaderboard_service.add_tokenizer("gpt2", {
        "token_count": 1000, "fertility": 2.5, "compression": 3.0,
        "token_premium": 1.8, "f1": 0.4, "precision": 0.5, "recall": 0.3,
        "overall_score": 55.5,
    })
    leaderboard_service.remove_tokenizer(tokenizer_id)

    return leaderboard_service


def test_restore_fills_in_the_vocabulary_metrics(temp_leaderboard):
    response = client.post("/leaderboard/gpt2/restore")

    assert response.status_code == 200
    metrics = response.json()["metrics"]

    assert metrics["renyi_efficiency"] is not None
    assert metrics["productivity"] is not None
    assert metrics["idiosyncrasy"] is not None

    # Not part of the score, so the saved score and the rest are untouched.
    assert metrics["overall_score"] == 55.5
    assert metrics["fertility"] == 2.5

    # And they were saved, so the board shows them from now on.
    row = temp_leaderboard.get_leaderboard()[0]
    assert row["productivity"] == metrics["productivity"]


def test_restore_still_works_when_the_vocabulary_metrics_cannot_be_measured(temp_leaderboard):
    # Hugging Face unreachable, say: the restore must succeed exactly as it
    # did before, with the three left empty.
    from unittest.mock import patch

    with patch(
        "app.routers.rank_router.compute_vocabulary_metrics",
        side_effect=ValueError("Could not reach Hugging Face"),
    ):
        response = client.post("/leaderboard/gpt2/restore")

    assert response.status_code == 200
    metrics = response.json()["metrics"]
    assert metrics["overall_score"] == 55.5
    assert metrics["renyi_efficiency"] is None
    assert temp_leaderboard.get_leaderboard()[0]["name"] == "gpt2"


def test_restore_does_not_remeasure_an_entry_that_already_has_them(temp_leaderboard):
    from unittest.mock import patch

    client.post("/leaderboard/gpt2/restore")
    temp_leaderboard.remove_tokenizer(temp_leaderboard.get_tokenizer_by_name("gpt2")["id"])

    with patch("app.routers.rank_router.compute_vocabulary_metrics") as measure:
        response = client.post("/leaderboard/gpt2/restore")

    assert response.status_code == 200
    measure.assert_not_called()


def test_filling_the_vocabulary_metrics_never_puts_a_removed_entry_back(temp_leaderboard):
    # The fixture's gpt2 is saved and removed. Filling must not restore it.
    response = client.post("/leaderboard/gpt2/vocabulary")

    assert response.status_code == 200
    assert response.json()["productivity"] is not None

    assert temp_leaderboard.get_leaderboard() == []
    saved = temp_leaderboard.get_saved_tokenizer("gpt2")
    assert saved["active"] == 0
    assert saved["productivity"] == response.json()["productivity"]
    assert saved["overall_score"] == 55.5


def test_filling_the_vocabulary_metrics_of_an_entry_on_the_board(temp_leaderboard):
    tokenizer_id = temp_leaderboard.get_tokenizer_by_name("gpt2")["id"]
    client.post("/leaderboard/gpt2/restore")

    from unittest.mock import patch

    # Already filled by the restore, so nothing is measured again.
    with patch("app.routers.rank_router.compute_vocabulary_metrics") as measure:
        response = client.post("/leaderboard/gpt2/vocabulary")

    assert response.status_code == 200
    measure.assert_not_called()
    assert temp_leaderboard.get_leaderboard()[0]["id"] == tokenizer_id


def test_filling_works_for_a_vendor_prefixed_name(temp_leaderboard):
    temp_leaderboard.add_tokenizer("openai-community/gpt2-large", {"overall_score": 50.0})

    response = client.post("/leaderboard/openai-community%2Fgpt2-large/vocabulary")

    assert response.status_code == 200
    assert response.json()["name"] == "openai-community/gpt2-large"
    assert response.json()["renyi_efficiency"] is not None


def test_filling_an_unknown_entry_is_a_404(temp_leaderboard):
    response = client.post("/leaderboard/never-measured/vocabulary")

    assert response.status_code == 404


def test_filling_survives_a_tokenizer_that_will_not_load(temp_leaderboard):
    from unittest.mock import patch

    with patch(
        "app.routers.rank_router.compute_vocabulary_metrics",
        side_effect=ValueError("Could not reach Hugging Face"),
    ):
        response = client.post("/leaderboard/gpt2/vocabulary")

    assert response.status_code == 200
    assert response.json()["productivity"] is None


def test_the_same_language_is_tokenized_once():
    # Picking it again - another page, another visit - is answered from
    # memory instead of tokenizing all 997 sentences again.
    from unittest.mock import patch
    from app.routers import inspect_router

    real = inspect_router.tokenize_corpus

    with patch.object(inspect_router, "tokenize_corpus", side_effect=real) as tokenize:
        first = client.post("/inspect/default", json={"language": "Sesotho", "tokenizer": "gpt2"})
        second = client.post("/inspect/default", json={"language": "Sesotho", "tokenizer": "gpt2"})
        other = client.post("/inspect/default", json={"language": "Sepedi", "tokenizer": "gpt2"})

    assert first.json() == second.json()
    assert other.json()["language"] == "Sepedi"
    assert tokenize.call_count == 2


def test_a_tokenizer_that_will_not_load_is_not_remembered():
    from unittest.mock import patch
    from app.routers import inspect_router

    real = inspect_router.get_or_load_tokenizer

    with patch.object(
        inspect_router,
        "get_or_load_tokenizer",
        side_effect=ValueError("Could not reach Hugging Face"),
    ):
        failed = client.post("/inspect/default", json={"language": "Sesotho", "tokenizer": "gpt2"})

    assert failed.status_code == 400

    # Back online: the next request really loads it.
    with patch.object(inspect_router, "get_or_load_tokenizer", side_effect=real):
        worked = client.post("/inspect/default", json={"language": "Sesotho", "tokenizer": "gpt2"})

    assert worked.status_code == 200


def test_the_vocabulary_metrics_do_not_change_the_score():
    from app.services.scoring import score_breakdown

    base = {"fertility": 2.5, "compression": 3.0, "token_premium": 1.8, "f1": 0.4}
    extended = {**base, "renyi_efficiency": 0.9, "productivity": 40.0, "idiosyncrasy": 3.0}

    assert score_breakdown(base)["overall_score"] == score_breakdown(extended)["overall_score"]

# ── PDFs do not get in, by any route ──────────────────────────────────────────
#
# PDF support is deliberately absent, not merely unimplemented: a PDF holds
# glyphs at coordinates rather than words, so extraction invents the word
# boundaries that fertility and compression are measured against. These tests
# exist so it cannot be re-enabled by accident, at any layer.

MINIMAL_PDF = (
    b"%PDF-1.7\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"trailer<</Root 1 0 R>>\n"
    b"%%EOF\n"
)


def post_file(name: str, payload: bytes, content_type: str = "application/octet-stream"):
    return client.post(
        "/inspect/upload",
        files={"file": (name, payload, content_type)},
        data={"tokenizer": "gpt2"},
    )


def test_pdf_by_extension_is_refused():
    response = post_file("paper.pdf", MINIMAL_PDF, "application/pdf")

    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_pdf_renamed_to_txt_is_refused_on_its_bytes():
    # The extension gate passes here. Only the magic-byte check catches it.
    response = post_file("paper.txt", MINIMAL_PDF, "text/plain")

    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


def test_pdf_renamed_to_docx_is_refused_on_its_bytes():
    response = post_file("paper.docx", MINIMAL_PDF)

    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


def test_pdf_is_not_in_the_advertised_formats():
    limits = client.get("/options").json()["limits"]

    assert ".pdf" not in limits["accepted_extensions"]


@pytest.mark.parametrize(
    "name, payload",
    [
        ("old.doc", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1padding"),
        ("note.rtf", b"{\\rtf1\\ansi text}"),
        ("sheet.xlsx", b"PK\x03\x04 not really"),
        ("bundle.zip", b"PK\x03\x04 not really"),
        ("run.exe", b"MZ\x90\x00"),
    ],
)
def test_other_refused_formats_never_reach_the_tokenizer(name, payload):
    response = post_file(name, payload)

    assert response.status_code == 400
