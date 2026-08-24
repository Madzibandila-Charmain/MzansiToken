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