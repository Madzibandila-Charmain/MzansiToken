"""
tokenizer_state.py - the shared tokenizer cache.

Both the FLORES efficiency work and the NCHLT morphology work tokenize with the same Hugging Face models. 
This module exists so there is exactly ONE cache: if each half loaded its own, the server would download xlm-roberta-base twice and
hold two copies in memory.

Import from here. Do not call load_tokenizer() directly in a router.
"""

from fastapi import HTTPException

from app.services.tokenizer import load_tokenizer

_tokenizer_cache = {}


def get_or_load_tokenizer(model_name: str):
    """Return a cached tokenizer, or load it from Hugging Face if not cached yet."""
    if model_name in _tokenizer_cache:
        return _tokenizer_cache[model_name]
    tokenizer = load_tokenizer(model_name)
    _tokenizer_cache[model_name] = tokenizer
    return tokenizer


# Tokenizers offered in the dropdowns — curated and verified to load without a Hugging Face login via check_tokenizers.py.
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
]


def validate_tokenizer(model_name: str):
    """Reject any tokenizer that is not on the supported list."""
    if model_name not in SUPPORTED_TOKENIZERS:
        raise HTTPException(status_code=400, detail=f"Unsupported tokenizer: {model_name}")