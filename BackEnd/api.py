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
    
