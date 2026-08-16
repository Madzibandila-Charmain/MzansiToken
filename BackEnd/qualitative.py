"""
qualitative.py - Tokenization examples for the TAD backend
TAD Capstone Project

What does this file do?
    This file shows how a tokenizer splits the same sentence
    across all 8 South African languages in the FLORES dataset.

    Because FLORES is parallel text, sentence number 67 in English is the same idea as sentence 67 in isiZulu — just translated.
    That means we can compare how different languages break down the exact same content into tokens.

Usage:
    from qualitative import get_example_sentence, get_random_sentence
"""

import random
from flores import load_flores, LANGUAGES
from tokenizer import load_tokenizer, tokenize_text

def get_example_sentence(tokenizer, corpus: dict[str, list[str]], index: int) -> dict:
    """
    Get one sentence tokenized across all 9 languages.

    This is the core function for the qualitative examples view.
    It takes a sentence index (0–996), finds that sentence in every language,
    tokenizes it, and returns everything the frontend needs to show the
    color‑coded token view.

    Args:
        tokenizer: a loaded tokenizer from load_tokenizer()
        corpus:    dict from load_flores() — {language: [sentences]}
        index:     which sentence to use, 0 to 996

    Returns:
        dict with the sentence index, total count, and per‑language results
    """

    # Figure out how many sentences are in the dataset
    if "English" in corpus:
        total = len(corpus["English"])
    else:
        # Fallback: grab the length of the first language if English is missing
        total = len(next(iter(corpus.values())))

    # Keep index inside valid range (avoid going out of bounds)
    index = max(0, min(index, total - 1))

    languages = {}

    # Loop through every language in the corpus
    for lang_name, sentences in corpus.items():
        # Grab the sentence at this index
        sentence = sentences[index]

        # Tokenize the sentence using tokenize_text()
        tokens = tokenize_text(tokenizer, sentence)

        # Save results for this language
        languages[lang_name] = {
            "sentence":    sentence,    # original sentence
            "tokens":      tokens,      # list of tokens
            "token_count": len(tokens)  # how many tokens it produced
        }

    # Return everything the frontend needs
    return {
        "index":           index,
        "total_sentences": total,
        "languages":       languages
    }
