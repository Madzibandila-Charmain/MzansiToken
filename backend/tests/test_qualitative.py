import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.qualitative import get_sentence_count, get_example_sentence


def test_sentence_count_is_the_minimum_not_english():
    # English is longest. Indexing past isiZulu's end would crash, so the safe count is the shortest file, not English's.
    corpus = {
        "English": ["a", "b", "c", "d"],
        "isiZulu": ["a", "b"],
    }
    assert get_sentence_count(corpus) == 2


def test_sentence_count_of_an_empty_corpus_is_zero():
    assert get_sentence_count({}) == 0


def test_sentence_count_when_all_files_match():
    corpus = {"English": ["a", "b"], "isiZulu": ["c", "d"]}
    assert get_sentence_count(corpus) == 2


def test_example_sentence_rejects_an_out_of_range_index():
    # Used to clamp silently: asking for 5000 returned the last sentence while the UI still displayed 5000.
    corpus = {"English": ["a", "b"], "isiZulu": ["c", "d"]}
    with pytest.raises(ValueError, match="out of range"):
        get_example_sentence(None, corpus, 5000)


def test_example_sentence_rejects_a_negative_index():
    corpus = {"English": ["a", "b"], "isiZulu": ["c", "d"]}
    with pytest.raises(ValueError, match="out of range"):
        get_example_sentence(None, corpus, -1)