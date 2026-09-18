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