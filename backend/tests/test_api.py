import sys
import os
import io
import pytest
from unittest.mock import patch, Mock
 
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
 
from fastapi.testclient import TestClient
import api

client = TestClient(api.app)

def _mock_tokenizer():
    """A fake tokenizer whose .tokenize() splits on whitespace — fully
    predictable output, no network, no real Hugging Face model."""
    tokenizer = Mock()
    tokenizer.tokenize.side_effect = lambda text: text.split()
    tokenizer.vocab_size = 12345
    tokenizer.model_type = "test-model"
    return tokenizer


# Basic Health 
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
    assert data["tokenizers"] == api.SUPPORTED_TOKENIZERS


def test_sentence_count():
    response = client.get("/sentence-count")
    assert response.status_code == 200
    assert response.json()["count"] == 3