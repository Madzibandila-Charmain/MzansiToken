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