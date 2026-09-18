"""
nchlt_state.py - Handles the NCHLT corpus and caches morphology metrics.

Author: Mukovhe Ranwashe
Date: 18 September 2026
"""

from pathlib import Path

from app.services.NCHLT_dataset_service import load_nchlt_data
from app.services.morphology_service import (BoundaryVector, aggregate_results, compare_boundaries, to_boundary_vector,)
from app.services.tokenizer import get_NCHLT_boundary_vector

# Figure out where the NCHLT dataset lives in the project folder
BASE_DIR = Path(__file__).resolve().parents[3]
NCHLT_DIR = BASE_DIR / "datasets" / "NCHLT"

# Keep the dataset in memory once it’s loaded
_corpus = None

# Cache for metrics so we don’t recompute the same thing twice
# Key looks like (model_name, language) → results
_mbi_cache = {}


def get_corpus():
    """
    Load the NCHLT dataset the first time we need it.
    After that, just reuse the copy in memory.
    """

    global _corpus

    if _corpus is None:
        print("Loading NCHLT corpus...")
        _corpus = load_nchlt_data(str(NCHLT_DIR))
        print(f"NCHLT ready: {len(_corpus)} languages loaded.")

    return _corpus


def available_languages():
    """
    Return the list of languages that have gold (correct) segmentations.
    Note: NCHLT has 7 languages one off from FLORES.
    """

    return sorted(get_corpus().keys())


def get_or_compute_mbi(model_name: str, language: str, tokenizer):
    """
    Get morphology metrics for one tokenizer + one language.
    If we’ve already computed them, grab from cache. Otherwise, compute and store them.
    """

    key = (model_name, language)

    # Use cached result if available
    if key in _mbi_cache:
        return _mbi_cache[key]

    corpus = get_corpus()

    # If the language isn’t in the dataset, stop here
    if language not in corpus:
        raise KeyError(language)

    word_results = []

    # Go through each word and its gold segmentation
    for surface_word, gold_segmentation in corpus[language]:

        # Get predicted boundaries from the tokenizer
        predicted_boundaries = get_NCHLT_boundary_vector(tokenizer, surface_word,)

        # Wrap predictions in a BoundaryVector object
        predicted_vector = BoundaryVector(word=surface_word, boundaries=predicted_boundaries,)

        # Convert gold segmentation into a BoundaryVector
        gold_vector = to_boundary_vector(surface_word, gold_segmentation,)

        # Compare predicted vs gold and save the result
        word_results.append(compare_boundaries( predicted_vector, gold_vector,))

    # Combine all word results into overall precision/recall/F1
    metrics = aggregate_results(word_results)

    result = {
        "words_evaluated": len(word_results),
        "metrics": {
            "precision": metrics.precision,
            "recall": metrics.recall,
            "f1": metrics.f1,
        },
    }

    # Save result in cache for next time
    _mbi_cache[key] = result

    return result
