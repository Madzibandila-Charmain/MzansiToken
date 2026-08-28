"""
tokenizer_router.py - endpoints about a tokenizer itself.

Routes:
    GET /tokenizer/{model_name}        metadata for one tokenizer
    GET /tokenize-text/{model_name}    split one piece of text into tokens
    GET /tokenize-corpus/{model_name}  raw token lists for the whole corpus
    GET /options                       dropdown values for the INSPECT view
"""

from fastapi import APIRouter, HTTPException

from app.services.flores_state import corpus
from app.services.tokenizer_state import SUPPORTED_TOKENIZERS, get_or_load_tokenizer
from app.services.tokenizer import (get_tokenizer_info, tokenize_corpus, tokenize_text,)

router = APIRouter(tags=["tokenizer"])


@router.get("/tokenizer/{model_name:path}")
def get_tokenizer_endpoint(model_name: str):
    """
    Load a tokenizer and return its details.

    React calls this first when the user picks a model and clicks Load. It
    confirms the model exists and returns its vocab size, type and class name.

    Example call: GET /tokenizer/gpt2
    Example response:
        {"model_name": "gpt2", "vocab_size": 50257, "model_type": "gpt2", ...}
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
def tokenize_corpus_endpoint(model_name: str):
    """
    Tokenize every sentence in the FLORES dataset for a given tokenizer.

    Useful for debugging, or when the frontend needs raw token data for all
    languages rather than metric summaries.

    Example call: GET /tokenize-corpus/gpt2
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # tokenize_corpus() takes a list of sentences, not the whole corpus dict,
    # so each language is tokenized separately.
    result = {}
    for language, sentences in corpus.items():
        result[language] = tokenize_corpus(tokenizer, sentences)
    return result


@router.get("/options")
def get_options():
    """
    Dropdown options for the INSPECT view: the languages in the dataset and the
    tokenizers on offer. React calls this once when INSPECT loads.

    Example response:
        {"languages": ["English", "isiZulu", ...], "tokenizers": ["gpt2", ...]}
    """
    return {
        "languages": list(corpus.keys()),
        "tokenizers": SUPPORTED_TOKENIZERS,
    }