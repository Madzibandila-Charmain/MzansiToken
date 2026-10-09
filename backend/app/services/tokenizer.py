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

    except Exception as e:
        # A gated model can surface through more than one exception type -
        # usually an OSError straight from the HTTP layer, but sometimes a
        # different error raised further down the loading chain (a failed
        # conversion step, for example) that happens to carry the same
        # 401/403/gated wording. Checking the message text first, before
        # looking at the exception's type, means a gated model is still
        # recognised wherever the library actually raises it - this used
        # to only be checked inside an "except OSError" branch, so any
        # other exception type skipped the check and fell straight to
        # the generic message below even when the real cause was gating.
        error_str = str(e).lower()
        if "401" in error_str or "403" in error_str or "gated" in error_str or "access" in error_str:
            raise ValueError(
                f"Model '{model_name}' is a gated model on Hugging Face and isn't available through this tool. "
                f"Try one of the listed tokenizers, or a different public model."
            )

        # OSError here covers the ordinary "model name does not exist"
        # case. Everything else - a missing optional dependency like
        # protobuf, a malformed repo, and so on - falls through to the
        # generic message below, which still shows the real error.
        if isinstance(e, OSError):
            raise ValueError(
                f"Model '{model_name}' not found on Hugging Face. "
                f"Check the model name at https://huggingface.co/models"
            )

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

def tokenize_corpus(tokenizer, sentences: list[str]) -> list[list[str]]:
    """
    Tokenize a list of sentences, returning a list of token lists.
 
    This is used to tokenize all 997 FLORES sentences for a given language
    before computing efficiency metrics across the whole corpus.
 
    Args:
        tokenizer: a loaded tokenizer returned by load_tokenizer()
        sentences: list of raw sentence strings e.g. the 997 FLORES sentences
 
    Returns:
        A list of token lists, one per sentence.
    """
    tokenized_sentences = []
    for sentence in sentences:
        tokens = tokenize_text(tokenizer, sentence)
        tokenized_sentences.append(tokens)
    return tokenized_sentences

def get_tokenizer_info(tokenizer) -> dict:
    """
    Metadata about a loaded tokenizer, for the dashboard header.

    Every field here is something real Hugging Face tokenizers actually carry.
    The old model_type field was not - it lives on the model config, not the
    tokenizer - so it always fell back to "unknown".
    """

    # Hugging Face uses a huge sentinel value to mean "no limit". Showing that as a number is worse than showing nothing.
    max_length = getattr(tokenizer, "model_max_length", None)
    if max_length is None or max_length > 1_000_000:
        max_length = None

    return {
        # How many unique tokens this tokenizer knows.
        "vocab_size": tokenizer.vocab_size,

        # Longest sequence the matching model accepts, or None if unbounded.
        "model_max_length": max_length,

        # Python class name, e.g. "XLMRobertaTokenizer". This is the closest thing to an architecture label that a tokenizer actually carries.
        "class": tokenizer.__class__.__name__,
    }

def tokenize_NCHLT(tokenizer, nchlt_data, delimeter="_") -> list[tuple[str, str]]:
    """
    Run tokenizer through the NCHLT dataset to get its predicted
    segmentations for analysis.

    This function is kept for the existing NCHLT tokenization tests
    and normal tokenization behaviour.
    """

    results = []
    for surf, gold in nchlt_data:
        tokens = tokenizer.tokenize(surf)
        cleaned = []

        for token in tokens:
            token = token.replace("##", "")
            token = token.replace("▁", "")
            token = token.replace("Ġ", "")

            if token:
                cleaned.append(token)

        tokenized_str = delimeter.join(cleaned)
        results.append((surf, tokenized_str))

    return results

def get_NCHLT_boundary_vectors(
    tokenizer,
    surface_words: list[str],
) -> list[list[int]]:
    """
    Get predicted tokenizer boundaries for multiple NCHLT words.

    Uses one batched Hugging Face tokenizer call instead of
    tokenizing every word individually.

    A boundary is created when a tokenizer token starts at a new
    character position inside the word.
    """

    if not surface_words:
        return []

    if not getattr(tokenizer, "is_fast", False):
        raise ValueError(
            f"Tokenizer '{tokenizer.__class__.__name__}' does not support "
            "character offset mapping required for MBI."
        )

    try:
        encoded = tokenizer(
            surface_words,
            add_special_tokens=False,
            return_offsets_mapping=True,
        )
    except (NotImplementedError, TypeError, ValueError) as e:
        raise ValueError(
            f"Tokenizer '{tokenizer.__class__.__name__}' does not provide "
            f"usable character offsets for MBI: {e}"
        )

    offsets_batch = encoded.get("offset_mapping")

    if offsets_batch is None:
        raise ValueError(
            f"Tokenizer '{tokenizer.__class__.__name__}' returned no "
            "character offsets for MBI."
        )

    results = []

    for surface_word, offsets in zip(surface_words, offsets_batch):

        if not surface_word:
            results.append([])
            continue

        boundaries = [0] * (len(surface_word) - 1)

        for start, end in offsets:

            # Ignore empty offsets.
            if start == end:
                continue

            # Ignore offsets outside the original word.
            if start < 0 or end > len(surface_word):
                continue

            # A token starting after character 0 creates a boundary.
            if start > 0:
                boundaries[start - 1] = 1

        results.append(boundaries)

    return results


def get_NCHLT_boundary_vector(tokenizer, surface_word: str) -> list[int]:
    """
    Get the tokenizer's predicted boundaries for one NCHLT word.

    This wrapper keeps the original single-word function available
    for existing code and tests.
    """

    results = get_NCHLT_boundary_vectors(
        tokenizer,
        [surface_word],
    )

    return results[0] if results else []