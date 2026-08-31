"""
flores_state.py - the FLORES corpus and the efficiency-metrics cache.

Loaded once when the server starts so no request pays to re-read the dataset.
This is the FLORES half of the backend.
"""

from pathlib import Path

from app.services.flores import load_flores
from app.services.metrics import compute_efficiency_metrics

# This file is at  <project>/backend/app/services/flores_state.py
BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "datasets" / "FLORES"

print("Loading FLORES corpus...")
corpus = load_flores(str(DATA_DIR))
print(f"Corpus ready: {len(corpus)} languages loaded.")


# Computing metrics tokenizes every sentence in every language, which takes real time. 
# Cached so the same model is never computed twice — e.g. loaded in INSPECT, then added to RANK.
_metrics_cache = {}


def get_or_compute_metrics(model_name: str, tokenizer):
    """Return cached metrics, or compute them if not cached yet."""
    if model_name in _metrics_cache:
        return _metrics_cache[model_name]
    result = compute_efficiency_metrics(tokenizer, corpus)
    _metrics_cache[model_name] = result
    return result