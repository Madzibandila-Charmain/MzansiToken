"""
flores_state.py - the FLORES corpus and the efficiency-metrics cache.

Loaded once when the server starts so no request pays to re-read the dataset.
This is the FLORES half of the backend.
"""

from pathlib import Path

from app.services.compute_once import once
from app.services.flores import load_flores
from app.services.metrics import (
    compute_efficiency_metrics,
    compute_vocabulary_by_language,
)

# This file is at  <project>/backend/app/services/flores_state.py
BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "datasets" / "FLORES"

print("Loading FLORES corpus...")
corpus = load_flores(str(DATA_DIR))
print(f"Corpus ready: {len(corpus)} languages loaded.")


# Computing metrics tokenizes every sentence in every language, which takes real time. 
# Cached so the same model is never computed twice — e.g. loaded in INSPECT, then added to RANK.
_metrics_cache = {}

# Inspect's charts, Compare's charts and Rank can all ask for the same
# tokenizer's metrics in the same second. once() (compute_once.py) makes the
# first one compute and the others wait for its answer, instead of each
# working through the whole corpus side by side.

# Productivity and idiosyncrasy per language, per model. Separate from the
# cache above because they are separate work - see
# compute_vocabulary_by_language - and only asked for by the vocabulary
# summary and the leaderboard.
_vocabulary_cache = {}


def get_or_compute_metrics(model_name: str, tokenizer):
    """Return cached metrics, or compute them if not cached yet."""
    return once(
        _metrics_cache,
        model_name,
        lambda: compute_efficiency_metrics(tokenizer, corpus),
    )


def get_or_compute_vocabulary(model_name: str, tokenizer, languages=None):
    """
    Productivity and idiosyncrasy per language - for `languages`, or every
    language when that is None. Cached language by language, so a page
    showing one language only ever pays for that one, and a later request
    for all eight reuses it.
    """
    wanted = list(corpus) if languages is None else languages

    return {
        language: once(
            _vocabulary_cache,
            (model_name, language),
            lambda language=language: compute_vocabulary_by_language(
                tokenizer, {language: corpus[language]}
            )[language],
        )
        for language in wanted
    }