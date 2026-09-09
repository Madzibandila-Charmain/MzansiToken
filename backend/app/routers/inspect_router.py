"""
inspect_router.py - the INSPECT view: default corpus, uploaded file, typed text.

Routes:
    POST /inspect/default   tokenize a language's FLORES corpus + metrics
    POST /inspect/upload    tokenize an uploaded .txt file + metrics
    POST /tokenize-text     tokenize typed text + metrics
"""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.request_schemas import InspectRequest, TokenizeTextRequest
from app.services.flores_state import _metrics_cache, corpus
from app.services.metrics import calculate_efficiency_metrics_one_language
from app.services.tokenizer import tokenize_corpus, tokenize_text
from app.services.tokenizer_state import get_or_load_tokenizer, validate_tokenizer

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
UPLOAD_CHUNK_BYTES = 64 * 1024      # Reads 64KB at a time
MAX_TEXT_CHARS = 20_000             # Cap on text typed into the INSPECT box. 


async def read_capped(file: UploadFile, limit: int) -> bytes:
    """Read an upload, stopping as soon as it goes past `limit` bytes."""
    chunks = []
    total = 0

    while True:
        chunk = await file.read(UPLOAD_CHUNK_BYTES)
        if not chunk:
            break

        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=413,
                detail=f"File is too large. The limit is {limit // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)

    return b"".join(chunks)

router = APIRouter(tags=["inspect"])


@router.post("/inspect/default")
def inspect_default(request: InspectRequest):
    """
    Load the selected language's FLORES corpus, tokenized, with its metrics.

    React sends: {"language": "isiZulu", "tokenizer": "gpt2"}
    """
    language = request.language
    model_name = request.tokenizer

    if language not in corpus:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    validate_tokenizer(model_name)

    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    sentences = corpus[language]
    tokenized = tokenize_corpus(tokenizer, sentences)
    metrics = calculate_efficiency_metrics_one_language(
        tokenized, sentences, model_name, language, tokenizer, _metrics_cache, corpus
    )
    return {
        "language": language,
        "tokenizer": model_name,
        "tokenized_text": tokenized,
        "metrics": metrics,
    }


@router.post("/inspect/upload")
async def inspect_upload(
    file: UploadFile = File(...),
    language: str = Form(...),
    tokenizer: str = Form(...),
):
    """
    Tokenize a user-uploaded .txt file and compute its metrics.

    React sends multipart/form-data: file, language, tokenizer.
    """
    if not file.filename or not file.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt files are supported.")

    if language not in corpus:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    validate_tokenizer(tokenizer)

    # Read and check the file before loading the tokenizer - no point
    # downloading a model for a request we are about to reject.
    contents = await read_capped(file, MAX_UPLOAD_BYTES)

    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="The uploaded file must be UTF-8 encoded.")

    if not text.strip():
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        tokenizer_model = get_or_load_tokenizer(tokenizer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Split into non-blank lines, same convention as load_flores()
    sentences = [line.strip() for line in text.splitlines() if line.strip()]

    tokenized = tokenize_corpus(tokenizer_model, sentences)
    metrics = calculate_efficiency_metrics_one_language(
        tokenized, sentences, tokenizer, language, tokenizer_model, _metrics_cache, corpus, basis="per_word",)

    return {
        "filename": file.filename,
        "language": language,
        "tokenizer": tokenizer,
        "tokenized_text": tokenized,
        "metrics": metrics,
    }


@router.post("/tokenize-text")
def tokenize_text_post(request: TokenizeTextRequest):
    """
    Tokenize text typed by the user and return full efficiency metrics.

    React sends: {"text": "...", "language": "isiZulu", "tokenizer": "gpt2"}

    Separate from GET /tokenize-text/{model_name} in tokenizer_router, which
    returns tokens only. Same URL, different HTTP method — they do not clash.
    """
    text = request.text
    language = request.language
    model_name = request.tokenizer

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=400, detail=f"Text is too long: {len(text):,} characters. The limit is {MAX_TEXT_CHARS:,}.",)
    
    if language not in corpus:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")

    validate_tokenizer(model_name)

    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    tokens = tokenize_text(tokenizer, text)
    metrics = calculate_efficiency_metrics_one_language(
        [tokens], [text], model_name, language, tokenizer, _metrics_cache, corpus, basis="per_word",)
    
    return {
        "language": language,
        "tokenizer": model_name,
        "tokenized_text": tokens,
        "metrics": metrics,
    }