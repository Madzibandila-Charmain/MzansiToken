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

# tokenize_text() TESTS

def test_tokenize_text_normal_sentence():
    tokenizer = Mock()
    tokenizer.tokenize.return_value = ["Hello", "world"]

    result = tokenize_text(tokenizer, "Hello world")

    assert result == ["Hello", "world"]
    tokenizer.tokenize.assert_called_once_with("Hello world")


def test_tokenize_text_empty_string():
    tokenizer = Mock()

    result = tokenize_text(tokenizer, "")

    assert result == []
    tokenizer.tokenize.assert_not_called()


def test_tokenize_text_whitespace():
    tokenizer = Mock()

    result = tokenize_text(tokenizer, "   ")

    assert result == []
    tokenizer.tokenize.assert_not_called()


def test_tokenize_text_newline():
    tokenizer = Mock()
 
    result = tokenize_text(tokenizer, "\n\n")
 
    assert result == []
    tokenizer.tokenize.assert_not_called()


def test_tokenize_text_tabs():
    tokenizer = Mock()
 
    result = tokenize_text(tokenizer, "\t\t")
 
    assert result == []
    tokenizer.tokenize.assert_not_called()
 

def test_tokenize_text_calls_tokenizer():
    tokenizer = Mock()
    tokenizer.tokenize.return_value = ["Hello"]
 
    tokenize_text(tokenizer, "Hello")
 
    tokenizer.tokenize.assert_called_once_with("Hello")
 

def test_tokenize_text_returns_tokenizer_result():
    tokenizer = Mock()
 
    expected = ["This", "is", "a", "test"]
    tokenizer.tokenize.return_value = expected
 
    result = tokenize_text(tokenizer, "This is a test")
 
    assert result == expected


def test_tokenize_text_punctuation():
    tokenizer = Mock()
    tokenizer.tokenize.return_value = ["Hello", "!"]
 
    result = tokenize_text(tokenizer, "Hello!")
 
    assert result == ["Hello", "!"]