"""
metrics.py - Efficiency metric computation for the TAD backend
TAD Capstone Project

    This file computes the four efficiency metrics that measure how well a tokenizer handles each South African language.
 
    The four metrics are:
        1. token_count   - total tokens across all sentences
        2. fertility     - average tokens per word
        3. compression   - average bytes per token
        4. token_premium - how many more tokens vs English
 
    All four metrics are computed from the tokenized corpus that flores.py loads and tokenizer.py tokenizes.
 
How this file connects to the others:
    flores.py   -> loads raw sentences
    tokenizer.py -> tokenizes those sentences into token lists
    metrics.py  -> takes those token lists and computes the numbers
 
Usage:
    from metrics import compute_efficiency_metrics
"""

from flores import load_flores, LANGUAGES
from tokenizer import load_tokenizer, tokenize_corpus

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
        total += len(token_count)
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
    total_words = sum(len(sentences.split()) for sentence in sentences)
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
    total_bytes = sum(len(sentences.encode("utf-8")) for sentence in sentences)
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

    # Compute all four metrics for each language
    results = {}
    for language, sentences in corpus.items():
        # Get the tokenized sentences for this language
        token_lists = tokenized_corpus[language]

        # Compute total token count (used in multiple metrics)
        lang_token_count = token_count(token_lists)

        # Store all metrics in a dictionary for this language
        results[language] = {
            "token_count":   lang_token_count,                       # total number of tokens
            "fertility":     fertility(token_lists, sentences),      # average tokens per word
            "compression":   compression(token_lists, sentences),    # how compact the language is
            "token_premium": token_premium(lang_token_count, eng_count),  # cost relative to English
        }

    # Return the full results dictionary
    return results
