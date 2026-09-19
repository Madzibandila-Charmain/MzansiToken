"""
inspect_router.py - the INSPECT view: default corpus, uploaded file, typed text.

Routes:
    POST /inspect/default   tokenize a language's FLORES corpus + metrics
    POST /inspect/upload    tokenize an uploaded corpus file + metrics
    POST /tokenize-text     tokenize typed text + metrics
"""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.schemas.request_schemas import InspectRequest, TokenizeTextRequest
from app.services.corpus_extract import (
    CorpusExtractionError,
    SUPPORTED_SUFFIXES,
    extract_corpus_text,
    sanitise_filename,
    suffix_of,
)
from app.services.flores_state import corpus
from app.services.metrics import calculate_efficiency_metrics_one_language
from app.services.tokenizer import tokenize_corpus, tokenize_text
from app.services.tokenizer_state import get_or_load_tokenizer, validate_tokenizer

from app.services.limits import (
    MAX_TEXT_CHARS,
    MAX_UPLOAD_BYTES,
    UPLOAD_CHUNK_BYTES,
)


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
    metrics = calculate_efficiency_metrics_one_language(tokenized, sentences, model_name, language, tokenizer, corpus)

    return {
        "language": language,
        "tokenizer": model_name,
        "tokenized_text": tokenized,
        "metrics": metrics,
    }


@router.post("/inspect/upload")
async def inspect_upload(
    file: UploadFile = File(...),
    tokenizer: str = Form(...),
):
    """
    Tokenize a user-uploaded corpus file and compute its metrics.

    Accepted formats are listed in corpus_extract.SUPPORTED_SUFFIXES. The
    filename only decides which reader is tried - the leading bytes have
    to agree with it before anything is parsed.

    React sends multipart/form-data: file, tokenizer.

    No language is required - an uploaded file can be any language, or a mixture, and the per-word premium does not need to know which.
    """
    # Cheap checks first, in cost order: the extension, then the tokenizer
    # name, then the bytes, and only then a model that may need downloading.
    if suffix_of(file.filename) not in SUPPORTED_SUFFIXES:
        supported = ", ".join(SUPPORTED_SUFFIXES)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported formats are: {supported}.",
        )

    validate_tokenizer(tokenizer)

    # Read and check the file before loading the tokenizer - no point downloading a model for a request we are about to reject.
    contents = await read_capped(file, MAX_UPLOAD_BYTES)

    # Everything that touches the uploaded bytes lives in corpus_extract, so
    # the guards are in one place rather than spread across the routers.
    try:
        text, source_format = extract_corpus_text(file.filename, contents)
    except CorpusExtractionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # Loading a tokenizer can mean downloading hundreds of megabytes, and
    # tokenizing a corpus is seconds of pure CPU. This endpoint is async, so
    # unlike the sync ones FastAPI does NOT move that work off the event loop
    # by itself - left here, one upload stalls every other request in flight.
    try:
        tokenizer_model = await run_in_threadpool(get_or_load_tokenizer, tokenizer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Split into non-blank lines, same convention as load_flores()
    sentences = [line.strip() for line in text.splitlines() if line.strip()]

    tokenized = await run_in_threadpool(tokenize_corpus, tokenizer_model, sentences)

    # "standalone": measured against itself and nothing else. An uploaded file
    # is not a translation of FLORES English, so dividing by that baseline
    # would fold a domain difference into a number labelled as a language one.
    # None is passed where the corpus went, to make that plain at the call.
    metrics = await run_in_threadpool(
        calculate_efficiency_metrics_one_language,
        tokenized,
        sentences,
        tokenizer,
        None,
        tokenizer_model,
        None,
        basis="standalone",
    )

    return {
        # Echoed straight back into the corpus label in the UI, so it is
        # reduced to a bare, bounded name first.
        "filename": sanitise_filename(file.filename),
        "source_format": source_format,
        "tokenizer": tokenizer,
        "tokenized_text": tokenized,
        "metrics": metrics,
    }


@router.post("/tokenize-text")
def tokenize_text_post(request: TokenizeTextRequest):
    """
    Tokenize text typed by the user and return full efficiency metrics.

    React sends: {"text": "...", "tokenizer": "gpt2"}

    No language is required - typed text can be any language, or a mixture, and the per-word premium does not need to know which.
    Separate from GET /tokenize-text/{model_name} in tokenizer_router, which returns tokens only. Same URL, different HTTP method - they do not clash.
    """
    text = request.text
    model_name = request.tokenizer

    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=400, detail=f"Text is too long: {len(text):,} characters. The limit is {MAX_TEXT_CHARS:,}.",)

    validate_tokenizer(model_name)

    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    tokens = tokenize_text(tokenizer, text)
    metrics = calculate_efficiency_metrics_one_language([tokens], [text], model_name, None, tokenizer, corpus, basis="per_word",)

    return {
        "tokenizer": model_name,
        "tokenized_text": tokens,
        "metrics": metrics,
    }