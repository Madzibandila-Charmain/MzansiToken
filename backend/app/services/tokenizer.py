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

    except OSError as e:
        # Covers 2 cases: Model name exist on Hugging face 
        #                 Model exists but is gated (requires HF login and accepted terms)
        error_str = str(e).lower()
        if "401" in error_str or "403" in error_str or "gated" in error_str or "access" in error_str:
            raise ValueError(
                f"Model '{model_name}' is a gated model — you need to accept "
                f"its terms at https://huggingface.co/{model_name} and set an HF_TOKEN."
            )
    
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
        Run tokenizer through the NCHLT dataset to get its predicted segmentations for analysis

        Args: 
            tokenizer: loaded tokenizer from huggingface
            nchlt_data: list of tuples for a specific language that have the word before segmentation and after

        Returns:
            A list of words from the data, before tokenization and after tokenization
    """

    results = []

    # Iterate through the data to tokenize
    for surf, gold in nchlt_data:
        tokens = tokenizer.tokenize(surf) #tokenize

        # convert list of tokens to tokenized string
        cleaned = []
        for token in tokens:
            token = token.replace("##", "")   # WordPiece (BERT)
            token = token.replace("▁", "")    # SentencePiece (T5, Llama)
            token = token.replace("Ġ", "")    # BPE byte-level (GPT-2)
            if token:
                cleaned.append(token)
        tokenized_str = delimeter.join(cleaned)

        # Add to list
        results.append((surf, tokenized_str))

    return results