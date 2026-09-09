import os
import sys
import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.tokenizer_state import(validate_tokenizer, MAX_MODEL_NAME_LENGTH, SUPPORTED_TOKENIZERS)

# Validate_tokenizer() - names that are accpeted 
@pytest.mark.parametrize("name", [
    "gpt2",
    "bert-base-uncased",
    "Davlan/afro-xlmr-base",
    "openai-community/gpt2-large",
    "facebook/nllb-200-distilled-600M",
    "some.model_name-2",
])
def test_valid_model_ids_are_accepted(name):
    assert validate_tokenizer(name) == name


def test_every_suggested_tokenizer_is_a_valid_id():
    # Our own dropdown list must not contain anything the guard would reject.
    for name in SUPPORTED_TOKENIZERS:
        assert validate_tokenizer(name) == name


def test_surrounding_whitespace_is_stripped():
    # Returned cleaned, so "gpt2 " cannot become a second cache entry.
    assert validate_tokenizer("  gpt2  ") == "gpt2"

