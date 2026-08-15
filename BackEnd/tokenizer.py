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

    trust_remote_code=False prevents the tokenizer from executing any custom Python code during loading.
    Some models include custom code - we never run it because we cannot verify it is safe.

    Args:
        model_name: Hugging Face model name e.g. "gpt2", "google/gemma-2b"

    Returns:
        A loaded tokenizer object ready for use.

    Raises:
        ValueError: if the model name is invalid, not found, or the returned object is not a valid tokenizer.

    Example:
        tokenizer = load_tokenizer("gpt2")
    """

    # 1. Validate the model name is not empty
    if not model_name or not model_name.strip():
        raise ValueError("Model name cannot be empty.")

    # Remove any accidental whitespace the user typed around the name
    model_name = model_name.strip()

    # 2. Call AutoTokenizer.from_pretrained() which:
    #       a. Connects to huggingface.co
    #       b. Downloads the tokenizer config, vocabulary, and merge files
    #       c. Automatically picks the correct tokenizer class
    #       d. Returns a ready-to-use tokenizer object
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=False)

    except OSError:
        raise ValueError(
            f"Model '{model_name}' not found on Hugging Face. "
            f"Check the model name at https://huggingface.co/models"
        )

    except Exception as e:
        raise ValueError(f"Failed to load tokenizer '{model_name}': {e}")

    # 3. Validate the returned object is actually a tokenizer
    # "not isinstance()" means if it is NOT one of these types then reject it.
    if not isinstance(tokenizer, (PreTrainedTokenizer, PreTrainedTokenizerFast)):
        raise ValueError(
            f"{model_name} did not return a valid tokenizer. "
            f"Make sure it is a language model, not an image or audio model."
        )

    # Return the validated tokenizer to whoever called this function
    return tokenizer