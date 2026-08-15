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

def tokenize_text(tokenizer, text: str) -> list[str]:
    """
    Tokenize a single string into a list of subword token strings.

    This is the core operation that the whole dashboard is built around.
    The tokenizer splits text into subword units — not words, not characters,
    but something in between that the model was trained to work with.

    Why .tokenize() and not .encode()?
        .encode() returns integer IDs e.g. [15496, 318, 4090, 3240, 30]
        .tokenize() returns human-readable strings e.g. ["Where", "Gis", ...]
        We need strings for:
            - Displaying colour-coded tokens in the qualitative view
            - Counting tokens for the efficiency metrics
            - Checking morpheme boundary alignment

    Args:
        tokenizer: A loaded tokenizer returned by `load_tokenizer()`.
        text (str): The raw input string to tokenize.

    Returns:
        list[str]: A list of token strings, or empty list if text is empty.
    """

    if not text or not text.strip():
        return []
    return tokenizer.tokenize(text)