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
    assert set(data["metrics"]) == {"precision", "recall", "f1"}
    assert 0.0 <= data["metrics"]["precision"] <= 1.0
    assert 0.0 <= data["metrics"]["recall"] <= 1.0
    assert 0.0 <= data["metrics"]["f1"] <= 1.0


# ── Validation errors reach the frontend as readable 400s ─────────────────────

def test_unsupported_tokenizer_is_rejected():
    response = client.post(
        "/inspect/default",
        json={"language": "isiZulu", "tokenizer": "not-a-real-model"},
    )
    assert response.status_code == 400
    assert "Unsupported tokenizer" in response.json()["detail"]


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