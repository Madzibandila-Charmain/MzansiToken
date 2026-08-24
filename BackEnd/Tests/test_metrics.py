import sys
import os
import pytest
from unittest.mock import Mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
 
from metrics import (token_count, fertility, compression, token_premium, compute_efficiency_metrics,)

# token_count() TESTS

def test_token_count_basic():
    tokenized = [["Hello", "world"], ["Cape", "Town"]]
    # 2 tokens + 2 tokens = 4
    assert token_count(tokenized) == 4
 
 
def test_token_count_empty_list():
    assert token_count([]) == 0
 
 
def test_token_count_sentences_with_no_tokens():
    tokenized = [[], [], []]
    assert token_count(tokenized) == 0


# compression() TESTS
# Formula: compression = total_bytes / total_tokens

def test_compression_hand_calculated():
    """
    "Hello world" = 11 ASCII chars = 11 bytes
    "Cape Town"   = 9 ASCII chars  = 9 bytes
    Total bytes = 20
    Tokenized: 4 tokens total (as in fertility test above)
    compression = 20 / 4 = 5.0
    """
    sentences = ["Hello world", "Cape Town"]
    tokenized = [["Hello", "world"], ["Cape", "Town"]]
 
    assert compression(tokenized, sentences) == 5.0


def test_compression_zero_token_returns_zero():
    sentences = [["Hello"]]
    tokenized = [[]]
    assert compression(tokenized, sentences) == 0


def test_compression_mutiple_characters():
    sentences = ["café"]
    tokenized = [["café"]]
 
    assert compression(tokenized, sentences) == 5.0


# fertility() TESTS
# Formula: fertility = total_tokens / total_words

def test_fertitlty_hand_calculated():
    """
    Sentences: "Hello world" (2 words), "Cape Town" (2 words)
    Total words = 4
    Tokenized:  ["Hello", "world"], ["Cape", "Town"] -> 4 tokens total
    fertility = 4 / 4 = 1.0
    """
    sentences = ["Hello world", "Cape Town"]
    tokenized = [["Hello", "world"], ["Cape", "Town"]]

    assert fertility(tokenized, sentences) == 1.0


def test_fertility_subword_splitting():
    sentences = [""]
    tokenized = [[]]

    assert fertility(tokenized, sentences) == 0.0


def test_fertility_rounds_to_three_decimals():
    sentences = ["one two three"]
    tokenized = [["a", "b", "c", "d"]]

    assert fertility(tokenized, sentences) == 1.333


def test_compression_hand_calculated():
    sentences = ["Hello world", "Cape Town"]
    tokenized = [["Hello", "world"], ["Cape", "Town"]]
 
    assert compression(tokenized, sentences) == 5.0


def test_compression_zero_tokens_returns_zero():
    sentences = ["Hello"]
    tokenized = [[]]
 
    assert compression(tokenized, sentences) == 0.0


def test_compression_multibyte_characters():
    """
    "é" is a multi-byte UTF-8 character (2 bytes), not 1.
    This confirms compression counts real UTF-8 bytes, not character
    count — important since your project specifically compares
    languages where character-to-byte ratios differ.
    "café" = c(1) a(1) f(1) é(2) = 5 bytes
    Tokenized as a single token: 1 token
    compression = 5 / 1 = 5.0
    """
    sentences = ["café"]
    tokenized = [["café"]]
 
    assert compression(tokenized, sentences) == 5.0


# token_premium() tests
# Formula: token_premium = lang_token_count / eng_token_count

def  test_token_premium_english_baseline_is_one():
    assert token_premium(100, 100) == 1.0


def test_token_premium_hand_calculated():
    """
    isiZulu needing 2x more tokens than English:
    lang_token_count = 200, eng_token_count = 100
    token_premium = 200 / 100 = 2.0
    """
    assert token_premium(200, 100)


def test_token_premium_none_when_english_missing():
    assert token_premium(200, None) is None


def test_token_premium_none_when_english_zero():
    assert token_premium(200, 0) is None


def test_token_premium_rounds_to_three_decimals():
    assert token_premium(100, 3) == 33.333


# compute_efficiency_metrics() tests
# Requires a mocked tokenizer since it calls tokenize_corpus() internally.

def _mock_tokenizer_word_level():
    """
    Helper function: creates a fake tokenizer.
    Instead of using a real tokenizer, this one just splits text
    by spaces. That way, we always know exactly what the output will be.
    """
    tokenizer = Mock()
    tokenizer.tokenize.side_effect = lambda text: text.split()
    return tokenizer