import sys
import os
from unittest.mock import Mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.metrics import (
    token_count, fertility, compression, token_premium,
    token_premium_per_word, compute_efficiency_metrics,
    renyi_efficiency, productivity_idiosyncrasy, byte_premium,
    calculate_efficiency_metrics_one_language, compute_vocabulary_by_language,
)

# token_count() TESTS

def test_token_count_basic():
    # Two sentences, each with 2 tokens → total = 4
    tokenized = [["Hello", "world"], ["Cape", "Town"]]
    assert token_count(tokenized) == 4


def test_token_count_empty_list():
    # No sentences at all → total tokens = 0
    assert token_count([]) == 0


def test_token_count_sentences_with_no_tokens():
    # Sentences exist but each is empty → total tokens = 0
    tokenized = [[], [], []]
    assert token_count(tokenized) == 0


# compression() TESTS
# Formula: compression = total_bytes / total_tokens

def test_compression_hand_calculated():
    """
    "Hello world" → 11 bytes
    "Cape Town"   → 9 bytes
    Total bytes = 20
    Tokenized = 4 tokens
    compression = 20 / 4 = 5.0
    """
    sentences = ["Hello world", "Cape Town"]
    tokenized = [["Hello", "world"], ["Cape", "Town"]]
    assert compression(tokenized, sentences) == 5.0


def test_compression_zero_tokens_returns_zero():
    # If there are no tokens, compression should safely return 0
    sentences = ["Hello"]
    tokenized = [[]]
    assert compression(tokenized, sentences) == 0.0


def test_compression_multibyte_characters():
    """
    "é" is a multi-byte UTF-8 character (2 bytes), not 1.
    "café" has 5 bytes in UTF-8:
      c(1) + a(1) + f(1) + é(2) = 5
    Tokenized = 1 token
    compression = 5 / 1 = 5.0
    """
    sentences = ["café"]
    tokenized = [["café"]]
    assert compression(tokenized, sentences) == 5.0


# fertility() TESTS
# Formula: fertility = total_tokens / total_words

def test_fertility_hand_calculated():
    """
    Sentences: "Hello world" (2 words), "Cape Town" (2 words)
    Total words = 4
    Tokenized = 4 tokens
    fertility = 4 / 4 = 1.0
    """
    sentences = ["Hello world", "Cape Town"]
    tokenized = [["Hello", "world"], ["Cape", "Town"]]
    assert fertility(tokenized, sentences) == 1.0


def test_fertility_empty_sentence_returns_zero():
    # Empty sentence → 0 words, 0 tokens → fertility = 0.0
    sentences = [""]
    tokenized = [[]]
    assert fertility(tokenized, sentences) == 0.0


def test_fertility_rounds_to_three_decimals():
    # 4 tokens / 3 words = 1.333 (rounded to 3 decimals)
    sentences = ["one two three"]
    tokenized = [["a", "b", "c", "d"]]
    assert fertility(tokenized, sentences) == 1.333


# token_premium() tests - parallel corpus basis
# Formula: token_premium = lang_token_count / eng_token_count

def test_token_premium_english_baseline_is_one():
    # English compared to itself → always 1.0
    assert token_premium(100, 100) == 1.0


def test_token_premium_hand_calculated():
    """
    isiZulu uses 200 tokens vs English 100 tokens
    token_premium = 200 / 100 = 2.0
    """
    assert token_premium(200, 100) == 2.0


def test_token_premium_none_when_english_missing():
    # If English count is missing, return None
    assert token_premium(200, None) is None


def test_token_premium_none_when_english_zero():
    # If English has 0 tokens, return None (avoid divide by zero)
    assert token_premium(200, 0) is None


def test_token_premium_rounds_to_three_decimals():
    # 100 / 3 = 33.333 (rounded to 3 decimals)
    assert token_premium(100, 3) == 33.333


def test_token_premium_corpus_basis_is_not_scale_invariant():
    """
    Why the per-word basis exists. Measured against the full English corpus,
    the same text gives a different premium depending on how much of it you
    supplied - and both answers are meaningless. This is the bug per_word fixes.
    """
    assert token_premium(4, 25741) != token_premium(40, 25741)   # 0.0 vs 0.002


# token_premium_per_word() tests - per-word basis
# Formula: premium = fertility(language) / fertility(English)

def test_token_premium_per_word_english_baseline_is_one():
    # Same fertility as English means no premium.
    assert token_premium_per_word(1.228, 1.228) == 1.0


def test_token_premium_per_word_hand_calculated():
    # isiZulu 4.095 tokens per word / English 1.228 = 3.335
    assert token_premium_per_word(4.095, 1.228) == 3.335


def test_token_premium_per_word_is_scale_invariant():
    """
    The whole point of the per-word basis: the amount of text does not change
    the answer, because fertility is already an average.

    One sentence:           4 tokens / 2 words  = 2.0
    The same sentence x10: 40 tokens / 20 words = 2.0
    """
    one = fertility([["a", "b", "c", "d"]], ["one two"])
    ten = fertility([["a", "b", "c", "d"]] * 10, ["one two"] * 10)

    assert one == ten == 2.0
    assert token_premium_per_word(one, 1.0) == token_premium_per_word(ten, 1.0)


def test_token_premium_per_word_none_when_english_missing():
    # No English baseline means no premium, rather than a fabricated number.
    assert token_premium_per_word(4.095, None) is None


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


def test_compute_efficiency_metrics_all_languages_present():
    """
    Check: every language in the input corpus gets results.
    We expect each language to have the four metrics plus the basis label:
    token_count, fertility, compression, token_premium, token_premium_basis.
    """
    tokenizer = _mock_tokenizer_word_level()
    corpus = {
        "English": ["Hello world"],
        "isiZulu": ["Sawubona mhlaba"],
    }

    result = compute_efficiency_metrics(tokenizer, corpus)

    # Make sure both languages are present
    assert set(result.keys()) == {"English", "isiZulu"}
    # Make sure each language has all four metrics and the basis label
    for language in result:
        assert set(result[language].keys()) == {
            "token_count", "fertility", "compression", "token_premium",
            "token_premium_basis",
            "renyi_efficiency", "byte_premium",
        }


def test_compute_efficiency_metrics_english_premium_is_baseline():
    """
    Check: English should always have a token_premium of 1.0.
    This means English is the baseline language for comparison.
    """
    tokenizer = _mock_tokenizer_word_level()
    corpus = {
        "English": ["Hello world"],
        "isiZulu": ["Sawubona mhlaba wonke"],
    }
    result = compute_efficiency_metrics(tokenizer, corpus)

    assert result["English"]["token_premium"] == 1.0


def test_compute_efficiency_metrics_hand_calculated_values():
    """
    Check: metrics match simple hand-calculated values.

    English: "Hello world"
      - token_count = 2
      - fertility   = 2 tokens / 2 words = 1.0
      - compression = 11 bytes / 2 tokens = 5.5
      - token_premium = 2 / 2 = 1.0

    isiZulu: "Sawubona mhlaba"
      - token_count = 2
      - fertility   = 2 / 2 = 1.0
      - compression = 15 bytes / 2 tokens = 7.5
      - token_premium = 2 / 2 (English baseline) = 1.0

    The corpus here really is parallel text, so the basis is parallel_corpus.
    """
    tokenizer = _mock_tokenizer_word_level()
    corpus = {
        "English": ["Hello world"],
        "isiZulu": ["Sawubona mhlaba"],
    }

    result = compute_efficiency_metrics(tokenizer, corpus)

    # Two different tokens, once each: perfectly even, so efficiency 1.0.
    assert result["English"] == {
        "token_count": 2,
        "fertility": 1.0,
        "compression": 5.5,
        "token_premium": 1.0,
        "token_premium_basis": "parallel_corpus",
        "renyi_efficiency": 1.0,
        "byte_premium": 1.0,
    }

    # 15 bytes against English's 11.
    assert result["isiZulu"] == {
        "token_count": 2,
        "fertility": 1.0,
        "compression": 7.5,
        "token_premium": 1.0,
        "token_premium_basis": "parallel_corpus",
        "renyi_efficiency": 1.0,
        "byte_premium": 1.364,
    }


def test_compute_efficiency_metrics_missing_english_returns_none_premium():
    """
    Edge case: if English is missing, token_premium should be None.
    This prevents the code from crashing or making up fake values.
    """
    tokenizer = _mock_tokenizer_word_level()
    corpus = {
        "isiZulu": ["Sawubona mhlaba"],
        "isiXhosa": ["Molo ehlabathini"],
    }

    result = compute_efficiency_metrics(tokenizer, corpus)

    assert result["isiZulu"]["token_premium"] is None
    assert result["isiXhosa"]["token_premium"] is None
    # Same reason, same answer: no English, no byte premium either.
    assert result["isiZulu"]["byte_premium"] is None
    # The other three need no English at all.
    assert result["isiZulu"]["renyi_efficiency"] == 1.0


# renyi_efficiency() TESTS

def test_renyi_efficiency_hand_calculated():
    """
    a, a, b, c -> p = 0.5, 0.25, 0.25
    sum p^2.5   = 0.5^2.5 + 2 * 0.25^2.5 = 0.239277
    H_2.5       = log2(0.239277) / (1 - 2.5) = 1.375479
    efficiency  = 1.375479 / log2(3) = 0.868
    """
    assert renyi_efficiency([["a", "a"], ["b", "c"]]) == 0.868


def test_renyi_efficiency_uniform_use_is_one():
    assert renyi_efficiency([["a", "b", "c", "d"]]) == 1.0


def test_renyi_efficiency_counts_across_sentences():
    # Same tokens, split differently over sentences: same answer.
    assert renyi_efficiency([["a", "a", "b", "c"]]) == renyi_efficiency([["a"], ["a", "b"], ["c"]])


def test_renyi_efficiency_one_token_type_is_none():
    # log2(1) = 0, so there is no ratio to report - not a zero.
    assert renyi_efficiency([["a", "a", "a"]]) is None


def test_renyi_efficiency_empty_is_none():
    assert renyi_efficiency([]) is None
    assert renyi_efficiency([[], []]) is None


def test_renyi_efficiency_uneven_use_scores_lower():
    even = renyi_efficiency([["a", "b"] * 10])
    skewed = renyi_efficiency([["a"] * 19 + ["b"]])
    assert skewed < even


def test_renyi_efficiency_stays_between_zero_and_one():
    value = renyi_efficiency([["x"] * 500 + ["y", "z", "w"]])
    assert 0.0 < value < 1.0


# productivity_idiosyncrasy() TESTS

def _two_letter_tokenizer():
    """Splits a word after its first two letters: "aba" -> ["ab", "a"]."""
    tokenizer = Mock()
    tokenizer.tokenize.side_effect = lambda word: [word[:2], word[2:]] if len(word) > 2 else [word]
    return tokenizer


def test_productivity_idiosyncrasy_hand_calculated():
    """
    Words: aba (twice), abc (once).
      "ab" is in {aba, abc} -> productivity 2, idiosyncrasy (2 + 1) / 2 = 1.5
      "a"  is in {aba}      -> productivity 1, idiosyncrasy 2
      "c"  is in {abc}      -> productivity 1, idiosyncrasy 1
    Averages: productivity 4 / 3 = 1.333, idiosyncrasy 4.5 / 3 = 1.5
    """
    result = productivity_idiosyncrasy(_two_letter_tokenizer(), ["aba abc aba"])
    assert result == (1.333, 1.5)


def test_productivity_counts_word_types_not_occurrences():
    # Repeating a word makes it more frequent (idiosyncrasy) but it is still
    # one word type (productivity).
    once = productivity_idiosyncrasy(_two_letter_tokenizer(), ["aba abc"])
    many = productivity_idiosyncrasy(_two_letter_tokenizer(), ["aba abc"] * 5)
    assert once[0] == many[0]
    assert many[1] == once[1] * 5


def test_productivity_a_subword_twice_in_one_word_counts_that_word_once():
    tokenizer = Mock()
    tokenizer.tokenize.side_effect = lambda word: ["ha", "ha"]
    assert productivity_idiosyncrasy(tokenizer, ["haha"]) == (1.0, 1.0)


def test_productivity_tokenizes_each_word_type_once():
    tokenizer = _two_letter_tokenizer()
    productivity_idiosyncrasy(tokenizer, ["aba abc aba", "aba"])
    assert sorted(call.args[0] for call in tokenizer.tokenize.call_args_list) == ["aba", "abc"]


def test_productivity_no_words_is_none():
    assert productivity_idiosyncrasy(_two_letter_tokenizer(), []) == (None, None)
    assert productivity_idiosyncrasy(_two_letter_tokenizer(), ["   ", ""]) == (None, None)


def test_productivity_no_subwords_is_none():
    tokenizer = Mock()
    tokenizer.tokenize.side_effect = lambda word: []
    assert productivity_idiosyncrasy(tokenizer, ["something here"]) == (None, None)


# byte_premium() TESTS

def test_byte_premium_hand_calculated():
    assert byte_premium(["abc"], ["ab"]) == 1.5


def test_byte_premium_counts_bytes_not_characters():
    # "é" is one character but two UTF-8 bytes.
    assert byte_premium(["é"], ["e"]) == 2.0


def test_byte_premium_english_against_itself_is_one():
    english = ["Hello world", "Another line"]
    assert byte_premium(english, english) == 1.0


def test_byte_premium_none_without_english():
    assert byte_premium(["abc"], None) is None
    assert byte_premium(["abc"], []) is None
    assert byte_premium(["abc"], [""]) is None


def test_byte_premium_none_for_empty_text():
    assert byte_premium([], ["ab"]) is None


# calculate_efficiency_metrics_one_language() - which basis gets what

def _corpus():
    return {"English": ["Hello world"], "isiZulu": ["Sawubona mhlaba"]}


def test_one_language_built_in_corpus_has_renyi_and_byte_premium():
    tokenizer = _mock_tokenizer_word_level()
    sentences = _corpus()["isiZulu"]
    result = calculate_efficiency_metrics_one_language(
        [s.split() for s in sentences], sentences, "mock-a", "isiZulu", tokenizer, _corpus())

    assert result["byte_premium"] == 1.364
    assert result["renyi_efficiency"] == 1.0


def test_one_language_never_splits_word_by_word():
    # The page-load path: only the sentences are tokenized (by the caller).
    # Productivity is not part of it, so not a single word is tokenized here.
    tokenizer = _mock_tokenizer_word_level()
    sentences = _corpus()["isiZulu"]
    result = calculate_efficiency_metrics_one_language(
        [s.split() for s in sentences], sentences, "mock-b", "isiZulu", tokenizer, _corpus())

    assert "productivity" not in result
    assert tokenizer.tokenize.call_args_list == [
        ((sentence,),) for sentence in _corpus()["English"]
    ]  # English, once, for the token premium baseline - and nothing else


def test_one_language_standalone_has_no_byte_premium():
    # An uploaded file is not a translation of FLORES English.
    tokenizer = _mock_tokenizer_word_level()
    sentences = ["Sawubona mhlaba", "Sawubona"]
    result = calculate_efficiency_metrics_one_language(
        [s.split() for s in sentences], sentences, "mock-c", None, tokenizer, None, basis="standalone")

    assert result["byte_premium"] is None
    assert result["renyi_efficiency"] is not None

    # The file's own vocabulary: Sawubona twice, mhlaba once, each its own
    # subword with the word-level mock.
    assert result["productivity"] == 1.0
    assert result["idiosyncrasy"] == 1.5


def test_one_language_typed_text_has_no_byte_premium():
    tokenizer = _mock_tokenizer_word_level()
    result = calculate_efficiency_metrics_one_language(
        [["Sawubona", "mhlaba"]], ["Sawubona mhlaba"], "mock-d", None, tokenizer, _corpus(), basis="per_word")

    assert result["byte_premium"] is None
    assert result["token_premium"] is not None
    assert "productivity" not in result


def test_compute_vocabulary_by_language_hand_calculated():
    result = compute_vocabulary_by_language(
        _two_letter_tokenizer(),
        {"English": ["aba abc aba"], "isiZulu": []},
    )

    assert result == {
        "English": {"productivity": 1.333, "idiosyncrasy": 1.5},
        "isiZulu": {"productivity": None, "idiosyncrasy": None},
    }


def test_the_batched_split_gives_exactly_what_tokenize_gives():
    # The fast path must never change a number - only how long it takes.
    from app.services.metrics import _split_words
    from app.services.tokenizer_state import get_or_load_tokenizer

    tokenizer = get_or_load_tokenizer("gpt2")
    words = ["Sawubona", "umhlaba", "abantu", "é", "日本", "<unk>", "a\u200bb", "uMntwana,"]

    assert _split_words(tokenizer, words) == [tokenizer.tokenize(word) for word in words]


def test_a_tokenizer_with_its_own_tokenize_is_still_called_word_by_word():
    from app.services.metrics import _split_words

    tokenizer = _two_letter_tokenizer()
    assert _split_words(tokenizer, ["aba", "abc"]) == [["ab", "a"], ["ab", "c"]]
    assert tokenizer.tokenize.call_count == 2


def test_split_of_no_words_is_empty():
    from app.services.metrics import _split_words

    assert _split_words(_two_letter_tokenizer(), []) == []


def test_the_same_tokenizer_is_never_computed_twice_at_once(monkeypatch):
    import threading
    import time

    from app.services import flores_state

    calls = []

    def slow_compute(tokenizer, corpus):
        calls.append(1)
        time.sleep(0.2)
        return {"English": {"token_count": 1}}

    monkeypatch.setattr(flores_state, "compute_efficiency_metrics", slow_compute)

    results = []
    threads = [
        threading.Thread(target=lambda: results.append(
            flores_state.get_or_compute_metrics("mock-concurrent", object())))
        for _ in range(4)
    ]

    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(calls) == 1
    assert len(results) == 4
    assert all(result is results[0] for result in results)


def test_vocabulary_is_cached_and_never_computed_twice_at_once(monkeypatch):
    import threading
    import time

    from app.services import flores_state

    calls = []

    def slow_vocabulary(tokenizer, corpus):
        calls.append(list(corpus))
        time.sleep(0.2)
        return {language: {"productivity": 2.0, "idiosyncrasy": 1.0} for language in corpus}

    monkeypatch.setattr(flores_state, "compute_vocabulary_by_language", slow_vocabulary)

    threads = [
        threading.Thread(
            target=flores_state.get_or_compute_vocabulary,
            args=("mock-v", object(), ["isiZulu"]),
        )
        for _ in range(3)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    flores_state.get_or_compute_vocabulary("mock-v", object(), ["isiZulu"])
    assert calls == [["isiZulu"]]


def test_vocabulary_for_one_language_works_out_only_that_one(monkeypatch):
    from app.services import flores_state

    calls = []

    def counting(tokenizer, corpus):
        calls.append(list(corpus))
        return {language: {"productivity": 1.0, "idiosyncrasy": 1.0} for language in corpus}

    monkeypatch.setattr(flores_state, "compute_vocabulary_by_language", counting)

    one = flores_state.get_or_compute_vocabulary("mock-w", object(), ["Sesotho"])
    assert list(one) == ["Sesotho"]
    assert calls == [["Sesotho"]]

    # All eight later: Sesotho comes from memory, only the other seven are new.
    every = flores_state.get_or_compute_vocabulary("mock-w", object())
    assert set(every) == set(flores_state.corpus)
    assert len(calls) == len(flores_state.corpus)
    assert ["Sesotho"] not in calls[1:]
