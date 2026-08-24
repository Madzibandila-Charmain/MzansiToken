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