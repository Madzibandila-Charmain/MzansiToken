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
