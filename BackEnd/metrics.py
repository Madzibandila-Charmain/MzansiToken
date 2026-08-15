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