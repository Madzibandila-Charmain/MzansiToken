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
 
from app.services.tokenizer import (load_tokenizer, tokenize_text, tokenize_corpus, get_tokenizer_info, tokenize_NCHLT)
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


def test_tokenize_text_unicode():
    tokenizer = Mock()
    tokenizer.tokenize.return_value = ["é", "clair"]
 
    result = tokenize_text(tokenizer, "éclair")
 
    assert result == ["é", "clair"]


def test_tokenize_text_zulu():
    tokenizer = Mock()
    tokenizer.tokenize.return_value = ["Ikhaya", "lami"]
 
    result = tokenize_text(tokenizer, "Ikhaya lami")
 
    assert result == ["Ikhaya", "lami"]


# tokenize_corpus() TESTS
 
def test_tokenize_corpus_multiple_sentences():
    tokenizer = Mock()
 
    tokenizer.tokenize.side_effect = [
        ["Hello"],
        ["How", "are", "you"],
    ]
 
    sentences = [
        "Hello",
        "How are you",
    ]
 
    result = tokenize_corpus(tokenizer, sentences)
 
    assert result == [
        ["Hello"],
        ["How", "are", "you"],
    ]


def test_tokenize_corpus_empty_list():
    tokenizer = Mock()
 
    result = tokenize_corpus(tokenizer, [])
 
    assert result == []
    tokenizer.tokenize.assert_not_called()


def test_tokenize_corpus_single_sentence():
    tokenizer = Mock()
    tokenizer.tokenize.return_value = ["Hello"]
 
    result = tokenize_corpus(tokenizer, ["Hello"])
 
    assert result == [["Hello"]]


def test_tokenize_corpus_preserves_order():
    tokenizer = Mock()
 
    tokenizer.tokenize.side_effect = [
        ["first"],
        ["second"],
        ["third"],
    ]
 
    sentences = [
        "First",
        "Second",
        "Third",
    ]
 
    result = tokenize_corpus(tokenizer, sentences)
 
    assert result == [
        ["first"],
        ["second"],
        ["third"],
    ]
 

def test_tokenize_corpus_calls_tokenizer_for_each_sentence():
    tokenizer = Mock()
    tokenizer.tokenize.side_effect = [
        ["Hello"],
        ["World"],
        ["Again"],
    ]
 
    tokenize_corpus(
        tokenizer,
        ["Hello", "World", "Again"]
    )
 
    assert tokenizer.tokenize.call_count == 3  


def test_tokenize_corpus_handles_empty_sentence():
    tokenizer = Mock()
    tokenizer.tokenize.return_value = []

    result = tokenize_corpus(tokenizer, [""])

    assert result == [[]]


# get_tokenizer_info() TESTS

# get_tokenizer_info() TESTS

def test_get_tokenizer_info_returns_real_attributes():
    """
    This fake exposes only attributes a real Hugging Face tokenizer has.

    The old test set model_type on a Mock by hand, so it passed while the field
    was hard-coded to "unknown" for every real model. A fake built to match the
    code instead of reality proves nothing.
    """
    class RealisticTokenizer:
        vocab_size = 50257
        model_max_length = 1024

    result = get_tokenizer_info(RealisticTokenizer())

    assert result == {
        "vocab_size": 50257,
        "model_max_length": 1024,
        "class": "RealisticTokenizer",
    }


def test_get_tokenizer_info_hides_the_no_limit_sentinel():
    # Hugging Face uses a huge number to mean "no maximum". Report None rather
    # than putting 1e30 in front of the user.
    class NoLimitTokenizer:
        vocab_size = 100
        model_max_length = int(1e30)

    assert get_tokenizer_info(NoLimitTokenizer())["model_max_length"] is None


def test_get_tokenizer_info_survives_a_missing_max_length():
    # Only vocab_size is guaranteed. Everything optional degrades quietly.
    class MinimalTokenizer:
        vocab_size = 100

    result = get_tokenizer_info(MinimalTokenizer())

    assert result["vocab_size"] == 100
    assert result["model_max_length"] is None
    assert result["class"] == "MinimalTokenizer"


def test_get_tokenizer_info_contains_required_keys():
    class RealisticTokenizer:
        vocab_size = 100
        model_max_length = 512

    assert set(get_tokenizer_info(RealisticTokenizer()).keys()) == {
        "vocab_size", "model_max_length", "class"
    }

      
# Input Validation test - load_tokenizer()

def test_load_tokenizer_empty_name():
    with pytest.raises(ValueError, match="Model name cannot be empty"):
        load_tokenizer("")


def test_load_tokenizer_whitespace_name():
    with pytest.raises(ValueError, match="Model name cannot be empty"):
        load_tokenizer("   ")


def test_load_tokenizer_newline_name():
    with pytest.raises(ValueError, match="Model name cannot be empty"):
        load_tokenizer("\n")

 
def test_load_tokenizer_none_name():
    with pytest.raises(ValueError, match="Model name cannot be empty"):
        load_tokenizer(None)


# Success paths for load_tokenizer()

def test_load_tokenizer_valid_name():
    fake_tokenizer = Mock(spec=PreTrainedTokenizerFast)
    fake_tokenizer.vocab_size = 50257

    with patch("app.services.tokenizer.AutoTokenizer.from_pretrained", return_value=fake_tokenizer):
        result = load_tokenizer("gpt2")

    assert result.vocab_size == 50257


def test_load_tokenizer_strips_whitespace():
    fake_tokenizer = Mock(spec=PreTrainedTokenizerFast)

    with patch("app.services.tokenizer.AutoTokenizer.from_pretrained", return_value=fake_tokenizer) as mock_load:
        load_tokenizer("  gpt2  ")

    mock_load.assert_called_once_with("gpt2", trust_remote_code=False)


# Failure paths for load_tokenizer()

def test_load_tokenizer_invalid_name_raises_valueerror():
    with patch("app.services.tokenizer.AutoTokenizer.from_pretrained", side_effect=OSError("not found")):
        with pytest.raises(ValueError, match="not found on Hugging Face"):
            load_tokenizer("this-model-does-not-exist-xyz-123")


def test_load_tokenizer_rejects_non_tokenizer_object():
    not_a_tokenizer = Mock()

    with patch("app.services.tokenizer.AutoTokenizer.from_pretrained", return_value=not_a_tokenizer):
        with pytest.raises(ValueError, match="did not return a valid tokenizer"):
            load_tokenizer("some-image-model")


def test_load_tokenizer_gated_model_raises_specific_error():
    gated_error = OSError("403 Client Error: Forbidden. Cannot access gated repo for url ...")
 
    with patch("app.services.tokenizer.AutoTokenizer.from_pretrained", side_effect=gated_error):
        with pytest.raises(ValueError, match="gated model"):
            load_tokenizer("google/gemma-2b")


def test_load_tokenizer_gated_model_raises_specific_error_even_when_not_an_oserror():
    # The gated check used to live only inside the OSError branch - a
    # gated-looking failure raised as a different exception type, as it
    # genuinely can be further down the loading chain, fell through to
    # the generic "Failed to load tokenizer" message instead of this
    # one. Same scenario as the test above, through a ValueError.
    gated_error = ValueError("403 Client Error: Forbidden. Cannot access gated repo for url ...")
 
    with patch("app.services.tokenizer.AutoTokenizer.from_pretrained", side_effect=gated_error):
        with pytest.raises(ValueError, match="gated model"):
            load_tokenizer("google/gemma-2b")


def test_load_tokenizer_other_failure_falls_through_to_generic_message():
    # Not every non-OSError failure is gating - a missing optional
    # dependency (protobuf, for the SentencePiece-to-fast conversion,
    # was the real one that surfaced this) should still reach the
    # generic message with the real error attached, not be mistaken
    # for a gated model just because it is not an OSError.
    conversion_error = ValueError(
        "SentencePieceExtractor requires the protobuf library but it was not found"
    )
 
    with patch("app.services.tokenizer.AutoTokenizer.from_pretrained", side_effect=conversion_error):
        with pytest.raises(ValueError, match="Failed to load tokenizer"):
            load_tokenizer("castorini/afriberta_base")


def test_load_tokenizer_genuinely_missing_model_raises_not_found_error():
    not_found_error = OSError("404 Client Error: Repository Not Found for url ...")
 
    with patch("app.services.tokenizer.AutoTokenizer.from_pretrained", side_effect=not_found_error):
        with pytest.raises(ValueError, match="not found on Hugging Face"):
            load_tokenizer("this-model-does-not-exist-xyz-123")



#------------------test tokenize_NCHLT ---------------------

## Mock tokenizer for testing function
class DummyTokenizer:
	def __init__(self, mapping):
		self.mapping = mapping

	def tokenize(self, surf):
		# return a copy to avoid accidental mutation in tests
		return list(self.mapping.get(surf, []))


# '##' markers should be stripped
def test_tokenize_NCHLT_wordpiece():
    tokenizer = DummyTokenizer({"uThando": ["u", "##Th", "##ando"]})
    data = [("uThando", "u_Thando")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("uThando", "u_Th_ando")]
	
# "▁" should be stripped
def test_tokenize_NCHLT_sentencepiece():
    tokenizer = DummyTokenizer({"umfana": ["▁um", "fana"]})
    data = [("umfana", "um_fana")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("umfana", "um_fana")]

# "Ġ" should be stripped
def test_tokenize_NCHLT_bpe():
    tokenizer = DummyTokenizer({"abantu": ["Ġab", "antu"]})
    data = [("abantu", "ab_antu")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("abantu", "ab_antu")]

# Tokens without markers should remain unchanged
def test_tokenize_NCHLT_no_markers():
    tokenizer = DummyTokenizer({"cat": ["cat"]})
    data = [("cat", "cat")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("cat", "cat")]

# Test custom delimiter functionality
def test_tokenize_NCHLT_custom_delimeter():
    tokenizer = DummyTokenizer({"uThando": ["u", "##Th", "##ando"]})
    data = [("uThando", "u-Thando")]
    result = tokenize_NCHLT(tokenizer, data, delimeter="+")
    assert result == [("uThando", "u+Th+ando")]

# A token with only a marker should vanish (This shouldn't happen anyway)
def test_tokenize_NCHLT_only_token():
    tokenizer = DummyTokenizer({"weird": ["▁", "word"]})
    data = [("weird", "word")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("weird", "word")]

# Results should be returned in the same order
def test_tokenizer_NCHLT_preserve_order():
    tokenizer = DummyTokenizer({
        "a": ["a"],
        "b": ["##b"],
        "c": ["▁c"],
    })
    data = [("a", "a"), ("b", "b"), ("c", "c")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("a", "a"), ("b", "b"), ("c", "c")]

# Empty list should return an empty list
def test_empty_input_list_returns_empty_list():
    tokenizer = DummyTokenizer({})
    result = tokenize_NCHLT(tokenizer, [])
    assert result == []
