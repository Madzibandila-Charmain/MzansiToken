"""
api.py - FastAPI backend for MzansiToken

This file is the bridge between the Python backend and the React frontend.
FastAPI creates a web server with endpoints (URLs) that React can call
to get tokenizer data as JSON.

How it works:
    1. The server starts and loads the FLORES dataset into memory once.
    2. React calls an endpoint e.g. GET /metrics/gpt2
    3. FastAPI runs the matching function and sends back the result as JSON.

To run this server:
    uvicorn api:app --reload --port 8000

Then open http://localhost:8000/docs to see and test all endpoints.
"""

from pathlib import Path
from pydantic import BaseModel
from flores import load_flores
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from qualitative import get_example_sentence, get_random_sentence, get_sentence_count
from tokenizer import load_tokenizer, tokenize_text, tokenize_corpus, get_tokenizer_info
from metrics import compute_efficiency_metrics, calculate_efficiency_metrics_one_language

# ── App setup ─────────────────────────────────────────────────────────────────

# Create the FastAPI app. Everything — endpoints, middleware — attaches to this.
app = FastAPI()

# ── Request models ────────────────────────────────────────────────────────────

# Pydantic models define the JSON shape React sends in a POST body.
# FastAPI uses these to validate incoming requests automatically.

class InspectRequest(BaseModel):
    """Data sent by React when loading a default FLORES corpus."""
    language: str
    tokenizer: str


class TokenizeTextRequest(BaseModel):
    """Data sent by React when the user types custom text."""
    text: str
    language: str
    tokenizer: str

# CORS (Cross-Origin Resource Sharing)
# The React frontend runs on port 3000 or 5173.
# The backend runs on port 8000.
# Without this, the browser blocks requests between different ports.
# This tells the browser: "it is safe to let the frontend talk to this backend."
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Load the FLORES corpus once at startup ────────────────────────────────────

# Build the path to the dataset relative to this file.
# This works on any machine regardless of where the project is saved.
# Path(__file__) = full path to api.py
# .resolve().parent.parent = two folders up = the project root
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "Datasets" / "FLORES"

# Load all 9 language files into memory when the server starts.
# We do this once here so every request is fast — no re-reading files on each call.
print("Loading FLORES corpus...")
corpus = load_flores(str(DATA_DIR))
print(f"Corpus ready: {len(corpus)} languages loaded.")


# ── Tokenizer cache ───────────────────────────────────────────────────────────

# Downloading a tokenizer from Hugging Face takes a few seconds.
# This cache stores tokenizers after the first load so repeat requests are instant.
# Example: if gpt2 is requested twice, we download it once and reuse it.
_tokenizer_cache = {}

def get_or_load_tokenizer(model_name: str):
    """Return a cached tokenizer, or load it from Hugging Face if not cached yet."""
    if model_name in _tokenizer_cache:
        # Already loaded before — return it immediately from memory
        return _tokenizer_cache[model_name]
    # Not cached yet — load from Hugging Face, store it, then return it
    tokenizer = load_tokenizer(model_name)
    _tokenizer_cache[model_name] = tokenizer
    return tokenizer


# ── Metrics cache ─────────────────────────────────────────────────────────────

# Computing metrics means tokenizing 997 sentences across 9 languages — it takes time.
# This cache stores the results so the same model is never computed twice.
# Example: if the user loads gpt2 in INSPECT then adds it to RANK,
# the metrics are computed once and reused.
_metrics_cache = {}

def get_or_compute_metrics(model_name: str, tokenizer):
    """Return cached metrics, or compute them if not cached yet."""
    if model_name in _metrics_cache:
        # Already computed before — return instantly
        return _metrics_cache[model_name]
    # Not cached yet — compute, store, then return
    result = compute_efficiency_metrics(tokenizer, corpus)
    _metrics_cache[model_name] = result
    return result

# List of tokenizers offered in the INSPECT dropdown, curated and verified to load cleanly via check_tokenizers.py.
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

# Helper function to validate tokenizer loaded
def validate_tokenizer(model_name: str):
    # Reject any tokenizer not in the SUPPORTED_TOKENIZERS list
    if model_name not in SUPPORTED_TOKENIZERS:
        raise HTTPException(status_code=400, detail=f"Unsupported tokenizer: {model_name}")

# ── Endpoints ─────────────────────────────────────────────────────────────────
# Each @app.get(...) decorator registers a URL endpoint.
# When React calls that URL, FastAPI runs the function below it
# and sends back whatever it returns as JSON automatically.

# Endpoint 0: API health check
@app.get("/")
def root():
    """Confirm that the MzansiToken API is running."""
    return {"message": "MzansiToken API is running"}


# Endpoint 1: Efficiency metrics for one tokenizer
@app.get("/metrics/{model_name}")
def get_metrics(model_name: str):
    """
    Get efficiency metrics for a tokenizer across all 9 languages.

    React calls this to show the charts in the INSPECT dashboard.
    Returns token count, fertility, compression, and token premium
    for every language in the FLORES corpus.

    Example call: GET /metrics/gpt2
    Example response:
        {
            "English":  {"token_count": 25741, "fertility": 1.228, ...},
            "isiZulu":  {"token_count": 61665, "fertility": 4.095, ...}
        }
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        # Model name was invalid — send a clean error to the frontend
        raise HTTPException(status_code=400, detail=str(e))

    return get_or_compute_metrics(model_name, tokenizer)


# Endpoint 2: Tokenizer metadata
@app.get("/tokenizer/{model_name}")
def get_tokenizer_endpoint(model_name: str):
    """
    Load a tokenizer and return its details.

    React calls this first when the user types a model name and clicks Load.
    Confirms the model exists and returns its vocab size, type, and class name.

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


# Endpoint 3: Compare two tokenizers side by side
@app.get("/compare/{model_a}/{model_b}")
def compare_tokenizers(model_a: str, model_b: str):
    """
    Get efficiency metrics for two tokenizers at once.

    React calls this for the COMPARE dashboard to show both tokenizers
    side by side. Each tokenizer is loaded and computed separately
    so a bad model name tells you exactly which one failed.

    Example call: GET /compare/gpt2/facebook/opt-125m
    Example response:
        {
            "tokenizer_a": {"name": "gpt2", "metrics": {...}},
            "tokenizer_b": {"name": "facebook/opt-125m", "metrics": {...}}
        }
    """
    # Load tokenizer A — report clearly if it fails
    try:
        tokenizerA = get_or_load_tokenizer(model_a)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Tokenizer A error: {e}")

    # Load tokenizer B — report clearly if it fails
    try:
        tokenizerB = get_or_load_tokenizer(model_b)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Tokenizer B error: {e}")

    # Compute (or reuse cached) metrics for both tokenizers
    metrics_a = get_or_compute_metrics(model_a, tokenizerA)
    metrics_b = get_or_compute_metrics(model_b, tokenizerB)

    return {
        "tokenizer_a": {"name": model_a, "metrics": metrics_a},
        "tokenizer_b": {"name": model_b, "metrics": metrics_b}
    }


# Endpoint 4: Qualitative tokenization example
@app.get("/example/model/{model_name}")
def get_example(model_name: str, index: int = -1):
    """
    Get one FLORES sentence tokenized across all 9 languages.

    React calls this for the qualitative examples view — the colour-coded
    token display like the OpenAI tokenizer demo.

    index is optional. If not provided (or -1), a random sentence is picked.
    If provided (0 to 996), that specific sentence is used.

    Example call: GET /example/model/gpt2
    Example call: GET /example/model/gpt2?index=42
    Example response:
        {
            "index": 42,
            "total_sentences": 997,
            "languages": {
                "English": {"sentence": "...", "tokens": [...], "token_count": 12},
                "isiZulu": {"sentence": "...", "tokens": [...], "token_count": 28}
            }
        }
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Make sure the index is within range before using it
    total = get_sentence_count(corpus)
    if index >= total:
        raise HTTPException(
            status_code=400,
            detail=f"Index out of range — max allowed is {total - 1}"
        )

    if index < 0:
        # No index given — pick a random sentence
        return get_random_sentence(tokenizer, corpus)
    else:
        # Specific index given — use that sentence
        return get_example_sentence(tokenizer, corpus, index)


# Endpoint 5: Total sentence count
@app.get("/sentence-count")
def sentence_count():
    """
    Return the total number of sentences in the FLORES dataset.

    React uses this to know the valid range for sentence navigation
    e.g. "Sentence 42 of 997".

    Example response: {"count": 997}
    """
    return {"count": get_sentence_count(corpus)}


# Endpoint 6: Tokenize a single piece of custom text
@app.get("/tokenize-text/{model_name}")
def tokenize_text_endpoint(model_name: str, text: str):
    """
    Split one piece of text into tokens.

    React calls this when the user types something into the text box
    and wants to see how the tokenizer splits it in real time.

    Example call: GET /tokenize-text/gpt2?text=Where is Cape Town?
    Example response: {"tokens": ["Where", "Gis", "GCape", "GTown", "?"], "count": 5}
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    tokens = tokenize_text(tokenizer, text)
    return {"tokens": tokens, "count": len(tokens)}


# Endpoint 7: Tokenize the entire FLORES corpus
@app.get("/tokenize-corpus/{model_name}")
def tokenize_corpus_endpoint(model_name: str):
    """
    Tokenize all sentences in the FLORES dataset for a given tokenizer.

    Useful for debugging or if the frontend needs the raw token data
    for all languages at once rather than metric summaries.

    Example call: GET /tokenize-corpus/gpt2
    Example response:
        {
            "English": [["Where", "Gis", ...], [...], ...],
            "isiZulu": [["I", "kh", "aya", ...], [...], ...]
        }
    """
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # tokenize_corpus() takes a list of sentences, not the whole corpus dict.
    # So we loop through each language and tokenize its sentences separately.
    result = {}
    for language, sentences in corpus.items():
        result[language] = tokenize_corpus(tokenizer, sentences)
    return result

# Endpoint 8: Dropdown options for INSPECT (languages + tokenizers)
@app.get("/options")
def get_languages():
    """
    Return the dropdown options for the INSPECT view — available
    languages in the dataset and available tokenizers to choose from.

    React calls this once when INSPECT loads to populate both dropdowns.

    Example response:
        {
            "languages": ["English", "isiZulu", "isiXhosa", ...],
            "tokenizers": ["gpt2", "bert-base-uncased", ...]
        }
    """
    return {
        "languages": list(corpus.keys()),
        "tokenizers": SUPPORTED_TOKENIZERS
    }


# ── Mutalu ─────────────────────────────────────────────────────────────────
