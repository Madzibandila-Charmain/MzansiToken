"""
api.py - FastAPI backend for MzansiToken

This file is the bridge between Python(backend) and React(frontend).
FastAPI sets up endpoints that React can call to fetch tokeniser data.

Endpoints:
    Each endpoint is just a URL the frontend calls.
    e.g GET /metrics/gpt2 → returns metrics for the gpt2 tokenizer.
"""

from flores import load_flores
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from metrics import compute_efficiency_metrics
from tokenizer import load_tokenizer, tokenize_text, tokenize_corpus, get_tokenizer_info
from qualitative import get_example_sentence, get_random_sentence, get_sentence_count

app = FastAPI()

# CORS
# Without this the browser blocks every request from the React dev server.
app.add_middleware(CORSMiddleware,
                   allow_origins=["http://localhost:5173", "http://localhost:3000"],
                   allow_methods=["GET"],
                   allow_headers=["*"],)

print("Loading FLORES corpus...")
corpus = load_flores("DataSets/FLORES")
print(f"Corpus ready: {len(corpus)} languages loaded.")


_tokenizer_cache = {}
def get_or_load_tokenizer(model_name):
    if model_name in _tokenizer_cache:
        return _tokenizer_cache[model_name]
    else:
        tokenizer = load_tokenizer(model_name)
        _tokenizer_cache[model_name] = tokenizer
        return tokenizer 

# Endpoint 1: Return the efficiency metrics for a tokenizer
@app.get("/metrics/{model_name}")
def get_metrics(model_name: str):
    """
    Get efficiency metrics for a tokenizer.

    The frontend call this to fetch stats(token count, fertitliy, compression) 
    for every languges in the FLORES corpus.

    Returns:
        dict: mertirc per language
        e.g {"English": {"token_count": 2543, "fertility":1.399}}    
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = compute_efficiency_metrics(tokenizer, corpus)
    return result
    
# Endpoint 2: Return the tokenizer info
@app.get("/tokenizer/{model_name}")
def get_tokenizer_endpoint(model_name: str):
    """
    Load a tokenizer and return its info.

    The frontend uses this to confirm the model exists and
    grab details like vocab size and model type.

    Returns:
        dict: tokenizer details
        Example: {"model_name": "gpt2", "vocab_size": 50257, ...}
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    info = get_tokenizer_info(tokenizer)
    info["model_name"] = model_name
    return info

# Endpoint 3: Compare the efficiency metrics of two tokenizers
@app.get("/compare/{model_a}/{model_b}")
def compare_tokenizers(model_a: str, model_b: str):
    """
    Compare two tokenizers side by side.

    The frontend calls this to see how two models differ
    across the FLORES dataset.

    Returns:
        dict: metrics for both tokenizers
        Example: {
            "tokenizer_a": {"name": "gpt2", "metrics": {...}},
            "tokenizer_b": {"name": "gemma-2b", "metrics": {...}}
        }
    """

    # Load the first tokenizer, using the cache when it has already been loaded.
    try:
        tokenizerA = get_or_load_tokenizer(model_a)
    # Return a clear error if the first model name is not supported.
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Tokenizer A error: {e}")

    # Load the second tokenizer, using the cache when it has already been loaded.
    try:
        tokenizerB = get_or_load_tokenizer(model_b)
    # Return a clear error if the second model name is not supported.
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Tokenizer B error: {e}")

    # Calculate the efficiency metrics for the first tokenizer across the corpus.
    metrics_a = compute_efficiency_metrics(tokenizerA, corpus)
    # Calculate the efficiency metrics for the second tokenizer across the corpus.
    metrics_b = compute_efficiency_metrics(tokenizerB, corpus)

    # Return both model names and their metrics so the frontend can compare them.
    return {
        # Store the first tokenizer's name and calculated metrics together.
        "tokenizer_a": {"name": model_a, "metrics": metrics_a},
        # Store the second tokenizer's name and calculated metrics together.
        "tokenizer_b": {"name": model_b, "metrics": metrics_b}
    }

# Endpoint 4: Qualitative example
@app.get("/example/model/{model_name}")
def get_example(model_name: str, index: int = -1):
    """
    Get a tokenization example.

    The frontend calls this to display how a sentence looks
    when broken into tokens across all FLORES languages.

    Args:
        model_name (str): Hugging Face model name
        index (int): sentence index (0–996). If -1, pick random.

    Returns:
        dict: tokenized sentence data
        Example: {
            "index": 42,
            "languages": {
                "English": {"sentence": "...", "tokens": [...], "token_count": 12},
                "isiZulu": {...}
            }
        }
    """

    # Load the requested tokenizer, reusing the in-memory cache when possible.
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    # Convert an unsupported model name into a client-friendly HTTP error.
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # A negative index means that the caller did not choose a sentence.
    if index < 0:
        # Select a random sentence and tokenize it in every corpus language.
        result = get_random_sentence(tokenizer, corpus)
    else:
        # Select the requested sentence and tokenize it in every corpus language.
        result = get_example_sentence(tokenizer, corpus, index)

    # Send the tokenized sentence data back to the frontend as JSON.
    return result

# Endpoint 5: Sentence count
@app.get("/sentence-count")
def sentence_count():
    """
    Count how many sentences are in the FLORES dataset.

    The frontend (the user-facing part) needs this number so it knows how far the sentence slider can go. In other words,
    it sets the "max index" for navigation.

    Returns:
        int: total sentence count
        Example: If there are 997 sentences, it returns 997.
    """
    return {"count": get_sentence_count(corpus)}

# Endpoint 6: Tokenize a single text
@app.get("/tokenize-text/{model_name}")
def tokenize_text_endpoint(model_name: str, text: str):
    """
    Break one piece of text into tokens.

    The frontend uses this when a user types custom text and wants to see how the tokenizer splits it.

    Args:
        model_name (str): Hugging Face model name
        text (str): input text

    Returns:
        dict: tokens and token count
        Example: {"tokens": ["Cape", "Town"], "count": 2}
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    tokens = tokenize_text(tokenizer, text)
    return {"tokens": tokens, "count": len(tokens)}

# Endpoint 7: Tokenize the whole FLORES corpus
@app.get("/tokenize-corpus/{model_name}")
def tokenize_corpus_endpoint(model_name: str):
    """
    Tokenize the entire FLORES dataset.

    Useful for debugging or when the frontend wants raw tokenized data for all languages at once.

    Args:
        model_name (str): Hugging Face model name

    Returns:
        dict: tokenized corpus data
        Example: {"English": [["Cape", "Town"], ...], "isiZulu": [...], ...}
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return tokenize_corpus(tokenizer, corpus)