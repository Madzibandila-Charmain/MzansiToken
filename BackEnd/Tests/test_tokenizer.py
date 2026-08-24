"""
test_tokenizer.py — Tests for tokenizer.py
 
All tests here are MOCKED — no real network calls to Hugging Face.
This means the whole suite runs in a couple of seconds and never
depends on internet access or Hugging Face being up.
"""
 
import sys
import os
import pytest
from unittest.mock import Mock, patch
 
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
 
from tokenizer import (load_tokenizer, tokenize_text, tokenize_corpus, get_tokenizer_info,)
from transformers import PreTrainedTokenizerFast

# Tokenize_text() Tests