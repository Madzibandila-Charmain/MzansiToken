"""
tokenizer_state.py - the shared tokenizer cache.

Both the FLORES efficiency work and the NCHLT morphology work tokenize with the same Hugging Face models. 
One cache for the whole app, so the FLORES and NCHLT work don't each download the same model separately.

Import from here. Do not call load_tokenizer() directly in a router.
"""

import re
from functools import lru_cache

from fastapi import HTTPException

from app.services.tokenizer import load_tokenizer

MAX_CACHED_TOKENIZERS = 5
MAX_MODEL_NAME_LENGTH = 96

# Matches a Hugging Face id: "gpt2" or "owner/name". No spaces, no extra slashes, can't start with a dot or dash.
REPO_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)?$")

# Tokenizers offered in the dropdowns — curated and verified to load without a Hugging Face login via check_tokenizers.py.
# Davlan/afro-xlmr-base and castorini/afriberta_base were added to Rank's
# starters to showcase African-language tokenizers specifically, but this
# list (what populates the Compare/Inspect dropdown pills, via /options)
# was never updated alongside it - so neither one showed up anywhere a
# user could discover them by browsing instead of already knowing the
# exact Hugging Face name to type. Both load without a login - verified
# the same way as the rest of this list, and already relied on by Rank.
SUPPORTED_TOKENIZERS = [
    "gpt2",
    "openai-community/gpt2-large",
    "EleutherAI/gpt-neox-20b",
    "mistralai/Mistral-7B-v0.1",
    "bert-base-uncased",
    "bert-base-multilingual-cased",
    "xlm-roberta-base",
    "facebook/nllb-200-distilled-600M",
    "tiiuae/falcon-7b",
    "Davlan/afro-xlmr-base",
    "castorini/afriberta_base",
]


def validate_tokenizer(model_name: str) -> str:
    """
    Check the name looks like a Hugging Face model id, and return it cleaned.

    This doesn't check the model exists - only load_tokenizer() can do that.
    Raises HTTPException 400 if the name is empty, too long, or malformed.
    """
    if not isinstance(model_name, str) or not model_name.strip():
        raise HTTPException(status_code=400, detail="Tokenizer name cannot be empty.")

    name = model_name.strip()

    if len(name) > MAX_MODEL_NAME_LENGTH:
        raise HTTPException(status_code=400, detail=f"Tokenizer name is too long (max {MAX_MODEL_NAME_LENGTH} characters).",)

    if not REPO_ID.match(name):
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{name}' is not a valid Hugging Face model id. "
                "Use a name like 'gpt2' or 'Davlan/afro-xlmr-base'."),)

    return name


@lru_cache(maxsize=MAX_CACHED_TOKENIZERS)
def _load_cached(name: str):
    """
    Load a tokenizer, keeping the most recently used ones in memory.

    lru_cache handles the eviction and is safe across threads. Failed loads
    aren't cached, so fixing a typo and retrying works.
    """
    return load_tokenizer(name)


def get_or_load_tokenizer(model_name: str):
    """
    Return a cached tokenizer, or load it from Hugging Face.

    Validating here means every endpoint gets it, including the GETs, which
    had no check before.
    """
    return _load_cached(validate_tokenizer(model_name))


def clear_tokenizer_cache():
    """Empty the cache. For tests, and a future DELETE /cache."""
    _load_cached.cache_clear()


def tokenizer_cache_info():
    """Cache hits, misses and current size."""
    return _load_cached.cache_info()._asdict()