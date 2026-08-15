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