"""
qualitative.py - Tokenization examples for the TAD backend
TAD Capstone Project

What does this file do?
    This file shows how a tokenizer splits the same sentence
    across all eight FLORES languages - seven South African ones and
    English, which is the baseline rather than a language under study.

    Because FLORES is parallel text, sentence number 67 in English is the same idea as sentence 67 in isiZulu — just translated.
    That means we can compare how different languages break down the exact same content into tokens.

Usage:
    from qualitative import get_example_sentence, get_random_sentence
"""

import random
from app.services.flores import load_flores, LANGUAGES
from app.services.tokenizer import load_tokenizer, tokenize_text

def get_example_sentence(tokenizer, corpus: dict[str, list[str]], index: int) -> dict:
    """
    Grab one sentence across all languages and show how it breaks down.

    This is the main function for the qualitative examples view.
    You give it a sentence index (0–996), it finds that same sentence
    in every language, runs the tokenizer, and packages everything
    the frontend needs to paint the color‑coded token view.

    Args:
        tokenizer: a tokenizer loaded with load_tokenizer()
        corpus:    dict from load_flores() — {language: [sentences]}
        index:     which sentence to use, 0 to 996

    Returns:
        dict with the sentence index, total count, and per‑language results
    """
    
    total = get_sentence_count(corpus)

    if total == 0:
        raise ValueError("The corpus is empty.")

    if not 0 <= index < total:
        raise ValueError(f"Sentence index {index} is out of range (0 to {total - 1}).")

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

def get_random_sentence(tokenizer, corpus: dict[str, list[str]]) -> dict:
    """
    Pick a random sentence and tokenize it across all languages.

    This is just a wrapper around get_example_sentence().
    Instead of you choosing the index, it rolls the dice and
    grabs one at random. The frontend uses this when the user
    clicks "Next sentence".

    Args:
        tokenizer: a tokenizer loaded with load_tokenizer()
        corpus:    dict from load_flores()

    Returns:
        Same structure as get_example_sentence()
    """

    total = get_sentence_count(corpus)

    # Pick a random index between 0 and total-1
    # randint includes both ends, so it can return 0 or the last index
    random_index = random.randint(0, total - 1)

    # Reuse get_example_sentence() with the random index
    return get_example_sentence(tokenizer, corpus, random_index)

def get_sentence_count(corpus: dict[str, list[str]]) -> int:
    """
    Figure out how many sentences are safe to index everywhere.

    We don’t just trust English’s length — if one language file
    is shorter, using English’s count would let the frontend
    request sentences that don’t exist in the other languages.
    That would blow up with IndexError halfway through.

    So we take the minimum length across all languages.
    That way, every index we hand back is guaranteed to exist
    in every language.

    Args:
        corpus: dict of {language: [sentences]}

    Returns:
        int — the safe sentence count
    """

    if not corpus:
        return 0
    return min(len(sentences) for sentences in corpus.values())