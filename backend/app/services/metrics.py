"""
metrics.py - Efficiency metric computation for the TAD backend
TAD Capstone Project

    This file computes the four efficiency metrics that measure how well a tokenizer handles each South African language.
 
    The four metrics are:
        1. token_count   - total tokens across all sentences
        2. fertility     - average tokens per word
        3. compression   - average bytes per token
        4. token_premium - how many more tokens vs English

    And four more from the literature, shown alongside them. None of them
    feeds the MzansiScore:
        5. renyi_efficiency - how evenly tokens are used, 0 to 1 (Zouhar et al. 2023, alpha 2.5)
        6. productivity     - word types per subword, averaged (Gutierrez-Vasques et al. 2023)
        7. idiosyncrasy     - average frequency of those words (same source)
           (6 and 7 tokenize every different word on its own, so they are
           computed separately - compute_vocabulary_by_language - and only
           when something asks for them, never while a page first loads.)
        8. byte_premium     - bytes vs English for the same sentences (Arnett et al. 2024)
 
    All four metrics are computed from the tokenized corpus that flores.py loads and tokenizer.py tokenizes.
 
How this file connects to the others:
    flores.py   -> loads raw sentences
    tokenizer.py -> tokenizes those sentences into token lists
    metrics.py  -> takes those token lists and computes the numbers
 
Usage:
    from metrics import compute_efficiency_metrics
"""

import math
from collections import Counter, defaultdict

from transformers import PreTrainedTokenizerFast

from app.services.tokenizer import load_tokenizer, tokenize_corpus

_english_baseline_cache = {}  # model_name -> {"token_count": int, "fertility": float}

def get_english_stats(model_name, tokenizer, corpus):
    """
    English token count and fertility for this model, computed once and cached.

    Both premium formulas need an English baseline, so we compute them together
    rather than tokenizing English twice.
    """
    if model_name in _english_baseline_cache:
        return _english_baseline_cache[model_name]

    english_sentences = corpus.get("English", [])
    english_tokenized = tokenize_corpus(tokenizer, english_sentences)

    stats = {"token_count": token_count(english_tokenized), "fertility": fertility(english_tokenized, english_sentences),}
    _english_baseline_cache[model_name] = stats
    return stats


def get_english_baseline(model_name, tokenizer, corpus):
    """English token count only. Kept because existing code calls this."""
    return get_english_stats(model_name, tokenizer, corpus)["token_count"]

# Metric 1:  Tockn Count
def token_count(tokenized_sentences: list[list[str]]) -> int:
    """
    Count the total number of tokens across all sentences.

    Parameter type:
        A list where each item is itself a list of strings.
        The outer list has one item per sentence (997 for FLORES).
        Each inner list contains the token string for that sentence.

    Args:
        tokenized_sentences: list of token lists, one per sentence
 
    Returns:
        int: total number of tokens across all sentences
    """

    total =0

    for token_list in tokenized_sentences:
        total += len(token_list)
    return total

# Metric 2: Fertility 
def fertility(tokenized_sentences: list[list[str]], sentences: list[str]) -> float:
    """
    Compute the average number if tokens per word.

    Formula:
        fertility = total_token / total words

    Args:
        tokenized_sentences: list of token lists (from tokenize_corpus)
        sentences: original raw sentence strings (from load_flores)

    Return:
        float: average tokens per word, rounded to 3 decimal places
    """ 

    # Count total tokens using token_count function above
    total_tokens = token_count(tokenized_sentences)
    # Count total words across all sentences.
    total_words = sum(len(sentence.split()) for sentence in sentences)
    # Guard against division by zero
    return round(total_tokens / total_words, 3) if total_words > 0 else 0.0

# Metric 3: Compression 
def compression(tokenized_sentences: list[list[str]], sentences: list[str]) -> float:
    """
    Compute the average number if UTF-8 bytes per token.

    Formula:
        compression = total_bytes / total_tokens

    Args:
        tokenized_sentences: list of token lists (from tokenize_corpus)
        sentences: the original sentence strings (from load_flores)
 
    Returns:
        float: average bytes per token, rounded to 3 decimal places
    """

    # Counts total bytes across all sentences. 
    # sentence.encode("utf-8") converts a string to a byte object.
    # len() on bytes object gives the number if bytes which are summed across all sentences.
    total_bytes = sum(len(sentence.encode("utf-8")) for sentence in sentences)
    # Count total tokens using our helper function.
    total_tokens = token_count(tokenized_sentences)
    # Guard against division by zero and return the result.
    return round(total_bytes / total_tokens, 3) if total_tokens > 0 else 0.0

# Metric 4: Token Premium
def token_premium(lang_token_count: int, eng_token_count: int) -> float | None:
    """
    Compute how many more tokens this language needs compared to English.
    
    Formula: 
        token_premium = tokens(this langauge) / tokens(English)

        English is always 1.0 (it is the baseline).

    Args:
        lang_token_count: total tokens for this language
        eng_token_count: total token for English, pass None if English is not in the corpus

    Returns:
        float: token premium value, or None if Englih is unavailable
    """

    # If English token count is None or zero, we cannot compute the premium. Return None rather than a fabricated number.
    if not eng_token_count:
        return None
 
    return round(lang_token_count / eng_token_count, 3)

# Metric 4b: Token Premium, per-word basis
def token_premium_per_word(lang_fertility: float, eng_fertility: float) -> float | None:
    """
    Token premium measured per word instead of per corpus.

    Formula:
        premium = fertility(this language) / fertility(English)

    Fertility is already an average, so this ratio gives the same answer for one
    sentence as for a thousand. That is what makes it safe for text the user
    typed or uploaded, where dividing by the whole English corpus is not.
    """
    if not eng_fertility:
        return None
    return round(lang_fertility / eng_fertility, 3)

# Metric 5: Renyi efficiency
RENYI_ALPHA = 2.5

def renyi_efficiency(tokenized_sentences: list[list[str]], alpha: float = RENYI_ALPHA) -> float | None:
    """
    How evenly the tokenizer spreads this text over the tokens it uses.

    Formula (Zouhar et al., 2023 - the tokenization-scorer package that
    Arnett & Bergen (2025) use, with their setting alpha = 2.5):

        p(t)       = count(t) / total tokens
        H_alpha    = 1 / (1 - alpha) * log2( sum_t p(t) ** alpha )
        efficiency = H_alpha / log2(V)

    V is the number of DIFFERENT tokens that appear in this text, which is
    what tokenization-scorer uses by default. The result is between 0 and 1:
    near 1 means the tokens are used about equally often, lower means a few
    very frequent tokens carry most of the text.

    Returns None when fewer than two different tokens appear - log2(1) is 0,
    so the ratio does not exist, and a zero would look like a measurement.
    """
    counts = Counter(token for tokens in tokenized_sentences for token in tokens)
    distinct = len(counts)

    if distinct < 2:
        return None

    total = sum(counts.values())
    power_sum = sum((count / total) ** alpha for count in counts.values())
    entropy = math.log2(power_sum) / (1 - alpha)

    return round(entropy / math.log2(distinct), 3)

# Metric 6 and 7: Productivity and idiosyncrasy
def productivity_idiosyncrasy(tokenizer, sentences: list[str]) -> tuple[float | None, float | None]:
    """
    The average productivity and idiosyncrasy of the subwords this
    tokenizer uses on this text (Gutierrez-Vasques et al., 2023, as used by
    Meyer & Buys, 2025):

        productivity(s) = |W_s|
        idiosyncrasy(s) = sum over w in W_s of freq(w), divided by |W_s|

    W_s is the set of different words that subword s appears in, and
    freq(w) is how many times word w occurs in the text. Productivity is how
    many word types reuse a subword (a prefix like "aba-" turns up in many);
    idiosyncrasy is how common those words are on average (a stem found in a
    few very frequent words). Both are averaged over every subword used.

    Words are split on whitespace, the same as fertility. Each different
    word is tokenized once, on its own, so a subword is credited to the word
    it came from - all of them in one batch (see _split_words).

    Returns (None, None) for text with no words, or when the tokenizer
    produced no subwords at all.
    """
    word_frequency = Counter(word for sentence in sentences for word in sentence.split())

    words_containing = defaultdict(set)

    for word, subwords in zip(word_frequency, _split_words(tokenizer, list(word_frequency))):
        for subword in set(subwords):
            words_containing[subword].add(word)

    if not words_containing:
        return None, None

    subword_count = len(words_containing)

    productivity = sum(len(words) for words in words_containing.values()) / subword_count

    idiosyncrasy = sum(
        sum(word_frequency[word] for word in words) / len(words)
        for words in words_containing.values()
    ) / subword_count

    return round(productivity, 3), round(idiosyncrasy, 3)

def _split_words(tokenizer, words: list[str]) -> list[list[str]]:
    """
    tokenizer.tokenize(word) for every word, in one call where possible.

    A FLORES language has about nine thousand different words, and one
    tokenize() call per word made the first load of a page roughly three
    times slower. For a standard fast tokenizer, tokenize() IS a one-item
    batch through the same Rust encoder - so calling the tokenizer on the
    whole list runs exactly the same code, once, and gives the same tokens.

    A tokenizer whose class replaces tokenize() with its own version keeps
    being called word by word, so it still gets exactly what it would have.
    """
    if not words:
        return []

    standard_fast = (
        isinstance(tokenizer, PreTrainedTokenizerFast)
        and type(tokenizer).tokenize is PreTrainedTokenizerFast.tokenize
    )

    if standard_fast:
        encoded = tokenizer(
            words,
            add_special_tokens=False,
            return_attention_mask=False,
            return_token_type_ids=False,
        )
        return [encoding.tokens for encoding in encoded.encodings]

    return [tokenizer.tokenize(word) for word in words]

# Metric 8: Byte premium
def byte_premium(sentences: list[str], english_sentences: list[str] | None) -> float | None:
    """
    How many more UTF-8 bytes this language needs than English for the same
    sentences (Arnett et al., 2024):

        byte_premium = bytes(this language) / bytes(English)

    It is a property of the language and the parallel text, not of the
    tokenizer - every tokenizer sees the same bytes. It only means something
    when `sentences` really is a translation of `english_sentences`, so it
    is only ever computed for the built-in FLORES corpus.

    Returns None when there is no English to compare with, or no text.
    """
    english_bytes = sum(len(sentence.encode("utf-8")) for sentence in english_sentences or [])
    language_bytes = sum(len(sentence.encode("utf-8")) for sentence in sentences)

    if not english_bytes or not language_bytes:
        return None

    return round(language_bytes / english_bytes, 3)

# Compute all metrics for all languages
def compute_efficiency_metrics(tokenizer, corpus: dict[str, list[str]]) -> dict[str, dict]:
    """
    Compute four efficiency metrics for each language in the corpus.

    This function is called by api.py. It runs all four metric
    functions together and returns one dictionary with everything
    needed for the dashboard.

    Return type: dict[str, dict]
        - Outer dict: language names (e.g. "isiZulu")
        - Inner dict: metric names (e.g. "fertility")

    Example output:
    {
        "English": {
            "token_count":   25741,
            "fertility":     1.228,
            "compression":   4.867,
            "token_premium": 1.0,
        },
        "isiZulu": {
            "token_count":   61665,
            "fertility":     4.095,
            "compression":   2.280,
            "token_premium": 2.396,
        },
        ...one entry per language...
    }

    Args:
        tokenizer: tokenizer object from load_tokenizer()
        corpus:    dict from load_flores() — {language_name: [sentences]}

    Returns:
        dict mapping each language to its four metrics
    """

    # Tokenize every language’s sentences
    # tokenized_corpus will hold {language: [list of token lists]}
    tokenized_corpus: dict[str, list[list[str]]] = {}

    for language, sentences in corpus.items():
        # tokenize_corpus() applies the tokenizer to each sentence
        # and returns a list of token lists for that language
        tokenized_corpus[language] = tokenize_corpus(tokenizer, sentences)

    # Get English token count as baseline for token_premium
    # If English is missing, warn and set baseline to None
    if "English" not in tokenized_corpus:
        print("Warning: English not in corpus - token_premium will be None for all languages.")
        eng_count = None
    else:
        eng_count = token_count(tokenized_corpus["English"])

    english_sentences = corpus.get("English")

    # Compute all four metrics for each language
    results = {}
    for language, sentences in corpus.items():
        # Get the tokenized sentences for this language
        token_lists = tokenized_corpus[language]

        # Compute total token count (used in multiple metrics)
        lang_token_count = token_count(token_lists)

        # Store all metrics in a dictionary for this language
        results[language] = {
            "token_count":   lang_token_count,
            "fertility":     fertility(token_lists, sentences),
            "compression":   compression(token_lists, sentences),
            "token_premium": token_premium(lang_token_count, eng_count),
            "token_premium_basis": "parallel_corpus",   # full parallel corpus, so totals are comparable
            "renyi_efficiency": renyi_efficiency(token_lists),
            "byte_premium":  byte_premium(sentences, english_sentences),
        }

    # Return the full results dictionary
    return results


def compute_vocabulary_by_language(tokenizer, corpus: dict[str, list[str]]) -> dict[str, dict]:
    """
    Productivity and idiosyncrasy for every language in the corpus:
        {"isiZulu": {"productivity": 4.2, "idiosyncrasy": 1.3}, ...}

    Kept apart from compute_efficiency_metrics on purpose. These two
    tokenize each different word on its own - about nine thousand per
    FLORES language - which roughly tripled the time a page took to show
    its first numbers when all eight languages came with every load. Now
    each language is worked out on its own and cached (flores_state), and
    /inspect/default works out all eight while its page is loading, so the
    chart tabs are ready when the boxes are.
    """
    results = {}

    for language, sentences in corpus.items():
        productivity, idiosyncrasy = productivity_idiosyncrasy(tokenizer, sentences)
        results[language] = {
            "productivity": productivity,
            "idiosyncrasy": idiosyncrasy,
        }

    return results

def calculate_efficiency_metrics_one_language(tokenized_sentences, sentences, model_name: str, language: str,
                               tokenizer, corpus: dict[str, list[str]] | None, basis: str = "parallel_corpus"):
    """
    Calculate the four efficiency metrics for one language, given sentences that
    have ALREADY been tokenized.

    basis picks how token_premium is measured:
      "parallel_corpus" - tokens(lang) / tokens(English). Only meaningful when this text really is the English corpus translated.
      "per_word"        - fertility(lang) / fertility(English). Works for any text, because a ratio of averages does not care how much text you gave it.
      "standalone"      - no premium at all, and no baseline is fetched.

    "standalone" exists for text the user supplied. Both premium formulas
    divide by a FLORES English figure, so on an uploaded file they compare
    the user's text against a corpus of English news and wiki prose. That
    ratio then carries the DOMAIN difference as well as the language one,
    and reports the total as if it were a property of the tokenizer. The
    other three metrics are computed from the supplied text alone and stay
    honest; the premium cannot be, so it is reported as None rather than
    as a number that looks fine and means something else.

    Passing "standalone" means `corpus` is never read, so callers may pass
    None for it - and nothing pays to tokenize English FLORES.

    Renyi efficiency is computed from the given text alone, like fertility,
    so every basis gets it - it only counts the tokens already here. The
    byte premium needs a translation of the English corpus, so only
    "parallel_corpus" gets one; the other two report None.

    An uploaded file ("standalone") also gets productivity and
    idiosyncrasy, measured on the file itself. The built-in corpus does
    not get them here - they are served by /vocabulary, so that loading a
    language never waits for them.
    """
    lang_token_count = token_count(tokenized_sentences)
    lang_fertility = fertility(tokenized_sentences, sentences)
    lang_compression = compression(tokenized_sentences, sentences)

    if basis == "parallel_corpus":
        bytes_vs_english = byte_premium(sentences, (corpus or {}).get("English"))
    else:
        bytes_vs_english = None

    if basis == "standalone":
        # Deliberately no get_english_stats call - see the docstring.
        premium = None
    else:
        english = get_english_stats(model_name, tokenizer, corpus)

        if basis == "per_word":
            premium = token_premium_per_word(lang_fertility, english["fertility"])
        elif language == "English":
            premium = token_premium(lang_token_count, lang_token_count)
        else:
            premium = token_premium(lang_token_count, english["token_count"])

    return {
        "token_count": lang_token_count,
        "fertility": lang_fertility,
        "compression": lang_compression,
        "token_premium": premium,
        "token_premium_basis": basis,
        "renyi_efficiency": renyi_efficiency(tokenized_sentences),
        "byte_premium": bytes_vs_english,
        **_file_vocabulary(tokenizer, sentences, basis),
    }


def _file_vocabulary(tokenizer, sentences, basis):
    """Productivity and idiosyncrasy for an uploaded file only."""
    if basis != "standalone":
        return {}

    productivity, idiosyncrasy = productivity_idiosyncrasy(tokenizer, sentences)

    return {"productivity": productivity, "idiosyncrasy": idiosyncrasy}