from flores import load_flores
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from metrics import compute_efficiency_metrics
from tokenizer import load_tokenizer, tokenize_text, tokenize_corpus, get_tokenizer_info
from qualitative import get_example_sentence, get_random_sentence, get_sentence_count

app = FastAPI()

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
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = compute_efficiency_metrics(tokenizer, corpus)
    return result
    
# Endpoint 2: Return the tokenizer info
@app.get("/tokenizer/{model_name}")
def get_tokenizer_endpoint(model_name: str):
    try:
        tokenizer = get_or_load_tokenizer(model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    info = get_tokenizer_info(tokenizer)
    info["model_name"] = model_name
    return 

# Endpoint 3: Compare the efficiency metrics of two tokenizers
@app.get("/compare/{model_a}/{model_b}")
def compare_tokenizers(model_a: str, model_b: str):
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