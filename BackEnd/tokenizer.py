"""
tokenizer.py - Hugging Face tokenizer loading for the TAD backend
TAD Capstone Project
 
Usage:
    from tokenizer import load_tokenizer, tokenize_text, tokenize_corpus
"""

from transformers import AutoTokenizer, PreTrainedTokenizer, PreTrainedTokenizerFast


def load_tokenizer(model_name: str) -> PreTrainedTokenizer | PreTrainedTokenizerFast:
    """
    Load a Hugging Face tokenizer by model name.
 
    trust_remote_code=False prevents the tokenizer from excecuting any custom Python code during loading.
    Some models include custom code - we never run becuase we cannot verify its safe.

    How it works:
        1. Validate the model name is not empty 
 
    Args:
        model_name: Hugging Face model name e.g. "gpt2", "google/gemma-2b"
 
    Returns:
        A loaded tokenizer object ready for use.
 
    Raises:
        ValueError: if the model name is invalid, not found, or the
                    returned object is not a valid tokenizer.
 
    Example:
        tokenizer = load_tokenizer("gpt2")

    """

    # 1. Validate the mode name is not empty 
    if not model_name or not model_name.strip():
        raise ValueError("Model name cannot be empty.")

    # Remove anf accidental whitespace the user typed around the name.
    model_name = model_name.strip()