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
    Extract basic metadata about a loaded tokenizer.

    This is displayed in the dashboard header so the user knows exactly what they loaded
    — not just the name they typed, but the actual vocabulary size and class of the tokenizer.

    Args:
        tokenizer: a loaded tokenizer returned by load_tokenizer()

    Returns:
        dict with keys: vocab_size, model_type, class
    """

    return {
        # vocab_size: how many unique tokens this tokenizer knows.
        # This is a built-in attribute of all Hugging Face tokenizers.
        "vocab_size": tokenizer.vocab_size,
 
        # model_type: the architecture name e.g. "gpt2", "llama", "gemma".
        # We use getattr() instead of tokenizer.model_type directly because
        # not all tokenizers have this attribute — getattr() returns "unknown"
        # as a default if the attribute does not exist, instead of crashing.
        # getattr(object, attribute_name, default_value)
        "model_type": getattr(tokenizer, "model_type", "unknown"),

        # __class__.__name__: the Python class name of this tokenizer.
        # e.g. "GPT2Tokenizer", "LlamaTokenizer", "GemmaTokenizer"
        # .name gives us the class name as a readable string.
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

# This blocks only runs when you execute this file diretly: python BackEnd/tokenizer.py
# It does not run when another file imports this file e.g from tokenizer import load_tokenizer

if __name__ == "__main__":
    import sys

    # sys.argv[1] is the first command-line argument after the script name.
    # If no argument given, we default to "gpt2" as a safe test model.
    # gpt2 is used for testing because:
    #   - It is small (downloads fast)
    #   - It is public (no authentication needed)
    #   - It represents the kind of tokenizer we are analysing
    # In the actual dashboard, the user can type any model name they want.
    MODEL = sys.argv[1] if len(sys.argv) > 1 else "gpt2"

    print(f"\n Testing tokenizer: '{MODEL}' \n")

    # Test 1: Valid model should load without errors
    try:
        tokenizer = load_tokenizer(MODEL)
        info = get_tokenizer_info(tokenizer)
        print(f"Loaded successfully.")
        print(f"  Class:      {info['class']}")
        print(f"  Vocab size: {info['vocab_size']:,}")   # :, adds thousand separator
        print(f"  Model type: {info['model_type']}")

    except ValueError as e:
        print(f"Load failed: {e}")
        sys.exit(1)

    # Test 2: Tokenize an English sentence 
    sentence = "Where is Cape Town?"
    tokens = tokenize_text(tokenizer, sentence)
    print(f"\nTokenizing English: '{sentence}'")
    print(f"  {len(tokens)} tokens: {tokens}")

    # TEST 3: same concept in isiZulu
    # This immediately demonstrates the fertility difference — isiZulu produces more tokens for the same meaning
    zulu = "Ikhaya lami liSekhaya."
    tokens_zulu = tokenize_text(tokenizer, zulu)
    print(f"\nTokenizing isiZulu: '{zulu}'")
    print(f"  {len(tokens_zulu)} tokens: {tokens_zulu}")
 
    # Show the comparison — this is what the dashboard visualises
    print(f"\n  English: {len(tokens)} tokens for {len(sentence.split())} words")
    print(f"  isiZulu: {len(tokens_zulu)} tokens for {len(zulu.split())} words")
    print(f"  isiZulu needs {len(tokens_zulu)/max(len(tokens),1):.2f}x more tokens\n")
 
    # TEST 4: invalid model name must raise ValueError, not crash
    print("Testing invalid model name (should fail cleanly) ")
    try:
        load_tokenizer("this-model-does-not-exist-xyz-123")
        print("ERROR: should have raised ValueError but did not")
    except ValueError as e:
        print(f"Correctly raised ValueError: {e}\n")
 
    # TEST 5: empty model name must raise ValueError immediately
    print("Testing empty model name (should fail cleanly)")
    try:
        load_tokenizer("")
        print("ERROR: should have raised ValueError but did not")
    except ValueError as e:
        print(f"Correctly raised ValueError: {e}\n")