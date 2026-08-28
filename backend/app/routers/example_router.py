"""
example_router.py - the qualitative side-by-side view.

Routes:
    GET /example/model/{model_name}   one sentence tokenized in every language
    GET /sentence-count               how many sentences the dataset has
"""

from fastapi import APIRouter, HTTPException

from app.services.flores_state import corpus
from app.services.qualitative import (get_example_sentence, get_random_sentence, get_sentence_count,)
from app.services.tokenizer_state import get_or_load_tokenizer

router = APIRouter(tags=["examples"])


@router.get("/example/model/{model_name:path}")
def get_example(model_name: str, index: int = -1):
    """
    One FLORES sentence tokenized across every language — the colour-coded
    display, like the OpenAI tokenizer demo.

    index is optional. Omitted (or -1) picks a random sentence; 0 to 996 picks
    that specific one.

    Example call: GET /example/model/gpt2
    Example call: GET /example/model/gpt2?index=42
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    total = get_sentence_count(corpus)
    if index >= total:
        raise HTTPException(
            status_code=400,
            detail=f"Index out of range — max allowed is {total - 1}",
        )

    if index < 0:
        return get_random_sentence(tokenizer, corpus)
    return get_example_sentence(tokenizer, corpus, index)


@router.get("/sentence-count")
def sentence_count():
    """
    Total sentences in the dataset, for the sentence navigator
    ("Sentence 42 of 997").

    Example response: {"count": 997}
    """
    return {"count": get_sentence_count(corpus)}