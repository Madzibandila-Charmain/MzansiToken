"""
tokenizer_router.py - endpoints about a tokenizer itself.

Routes:
    GET /tokenizer/{model_name}        metadata for one tokenizer
    GET /tokenize-text/{model_name}    split one piece of text into tokens
    GET /tokenize-corpus/{model_name}  raw token lists for the whole corpus
    GET /options                       dropdown values for the INSPECT view
"""

from fastapi import APIRouter, HTTPException

from app.services.corpus_extract import SUPPORTED_SUFFIXES
from app.services.flores_state import corpus
from app.services.limits import as_payload as limits_payload
from app.services.qualitative import get_sentence_count
from app.services.tokenizer_state import (SUPPORTED_TOKENIZERS, get_or_load_tokenizer, tokenizer_cache_info,)
from app.services.tokenizer import (get_tokenizer_info, tokenize_corpus, tokenize_text,)

# Hard ceiling on how many sentences per language one request can return.
MAX_CORPUS_LIMIT = 200

router = APIRouter(tags=["tokenizer"])


@router.get("/tokenizer/{model_name:path}")
def get_tokenizer_endpoint(model_name: str):
    """
    Load a tokenizer and return its details.

    React calls this first when the user picks a model and clicks Load. It
    confirms the model exists and returns its vocab size, the longest input
    it accepts, and its class name.

    Example call: GET /tokenizer/gpt2
    Example response:
        {
            "model_name": "gpt2",
            "vocab_size": 50257,
            "model_max_length": 1024,
            "class": "GPT2TokenizerFast"
        }
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    info = get_tokenizer_info(tokenizer)
    info["model_name"] = model_name
    return info


@router.get("/tokenize-text/{model_name:path}")
def tokenize_text_endpoint(model_name: str, text: str):
    """
    Split one piece of text into tokens.

    React calls this when the user types into the text box and wants to see the
    split in real time.

    Example call: GET /tokenize-text/gpt2?text=Where is Cape Town?
    Example response: {"tokens": ["Where", "Ġis", ...], "count": 5}
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    tokens = tokenize_text(tokenizer, text)
    return {"tokens": tokens, "count": len(tokens)}


@router.get("/tokenize-corpus/{model_name:path}")
def tokenize_corpus_endpoint(model_name: str, language: str | None = None, limit: int = 50):
    """
    Tokenized sentences from the FLORES corpus, for debugging and inspection.

    Paged on purpose. Returning everything is 8 languages x 997 sentences of
    token lists - several MB of JSON, enough to lock up a browser tab.

    Example: GET /tokenize-corpus/gpt2?language=isiZulu&limit=20
    """
    if limit < 1 or limit > MAX_CORPUS_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"limit must be between 1 and {MAX_CORPUS_LIMIT}.",
        )

    if language is not None and language not in corpus:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    selected = {language: corpus[language]} if language else corpus

    return {
        "model_name": model_name,
        "limit": limit,
        "sentences_available": get_sentence_count(corpus),
        "tokenized": {
            name: tokenize_corpus(tokenizer, sentences[:limit])
            for name, sentences in selected.items()
        },
    }


@router.get("/options")
def get_options():
    """
    Dropdown options for the INSPECT view: the languages in the dataset and the
    tokenizers on offer. React calls this once when INSPECT loads.

    It also carries the input limits, so the UI can state them before someone
    picks a file rather than after the server has refused it. They are served
    from the module that enforces them - a limit shown as 5 MB while 4 is
    enforced would be worse than showing nothing.

    Example response:
        {"languages": ["English", "isiZulu", ...], "tokenizers": ["gpt2", ...],
         "limits": {"max_upload_mb": 5, "accepted_extensions": [".txt", ...]}}
    """
    return {
        "languages": list(corpus.keys()),
        "tokenizers": SUPPORTED_TOKENIZERS,
        "limits": limits_payload(SUPPORTED_SUFFIXES),
    }


@router.get("/status")
def get_status():
    """
    Backend health, for the frontend to check on load.

    This is the endpoint Charmaine's getBackendStatus() was already written against - it just didn't exist yet.
    """
    return {
        "status": "ok",
        "corpus_loaded": len(corpus) > 0,
        "languages": len(corpus),
        "sentences": get_sentence_count(corpus),
        "suggested_tokenizers": len(SUPPORTED_TOKENIZERS),
        "tokenizer_cache": tokenizer_cache_info(),
    }