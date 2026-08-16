"""
qualitative.py - Tokenization examples for the TAD backend
TAD Capstone Project

What does this file do?
    This file shows how a tokenizer splits the same sentence
    across all 8 South African languages in the FLORES dataset.

    Because FLORES is parallel text, sentence number 67 in English
    is the same idea as sentence 67 in isiZulu — just translated.
    That means we can compare how different languages break down
    the exact same content into tokens.

Usage:
    from qualitative import get_example_sentence, get_random_sentence
"""

import random
from flores import load_flores, LANGUAGES
from tokenizer import load_tokenizer, tokenize_text