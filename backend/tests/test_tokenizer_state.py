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


# validate_tokenizer() - names that are rejected

@pytest.mark.parametrize("name", [
    "",                      # empty
    "   ",                   # whitespace only
    "not a real model",      # spaces
    "a/b/c",                 # more than one slash
    "../../etc/passwd",      # path traversal
    ".hidden",               # leading dot
    "-dash-first",           # leading dash
    "model;rm -rf /",        # shell characters
    "model\nname",           # newline
])
def test_malformed_model_ids_are_rejected(name):
    with pytest.raises(HTTPException) as error:
        validate_tokenizer(name)
    assert error.value.status_code == 400


def test_non_string_is_rejected():
    # load_tokenizer used to hit .strip() on an int and raise AttributeError,
    # which reached the frontend as a 500.
    with pytest.raises(HTTPException) as error:
        validate_tokenizer(123)
    assert error.value.status_code == 400


def test_name_over_the_length_limit_is_rejected():
    with pytest.raises(HTTPException) as error:
        validate_tokenizer("a" * (MAX_MODEL_NAME_LENGTH + 1))
    assert error.value.status_code == 400

def test_name_exactly_at_the_length_limit_is_accepted():
    # Off-by-one check: the limit itself must still be allowed.
    name = "a" * MAX_MODEL_NAME_LENGTH
    assert validate_tokenizer(name) == name


def test_anchors_reject_a_valid_name_with_junk_around_it():
    # Without ^ and $ the regex would match the "gpt2" inside this string.
    with pytest.raises(HTTPException):
        validate_tokenizer("; rm -rf / gpt2")
