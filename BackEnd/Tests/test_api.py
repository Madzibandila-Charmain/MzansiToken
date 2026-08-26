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

