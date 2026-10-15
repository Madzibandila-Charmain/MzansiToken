"""
nchlt_state.py - Handles the NCHLT corpus and caches morphology metrics.

Author: Mukovhe Ranwashe
Date: 18 September 2026
"""

from pathlib import Path

from app.services.compute_once import once
from app.services.NCHLT_dataset_service import load_nchlt_data
from app.services.morphology_service import (BoundaryVector, aggregate_results, compare_boundaries, to_boundary_vector,)
from app.services.tokenizer import get_NCHLT_boundary_vectors

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

    If we have already computed them, return the cached result.
    Otherwise work them out once - Inspect, Compare and a Rank measurement
    can all ask for the same pair at the same moment, and the later ones
    wait for the first rather than doing it again (compute_once.py).
    """
    return once(
        _mbi_cache,
        (model_name, language),
        lambda: _compute_mbi(language, tokenizer),
    )


def _compute_mbi(language: str, tokenizer):
    """
    Tokenize all NCHLT words for this language in a batch and compare the
    predicted boundaries with the gold ones.
    """
    corpus = get_corpus()

    # If the language isn't in the dataset, stop here
    if language not in corpus:
        raise KeyError(language)

    words = corpus[language]

    # Get all surface words from the NCHLT dataset
    surface_words = [
        surface_word
        for surface_word, _ in words
    ]

    # Tokenize all words as a batch
    predicted_boundary_vectors = get_NCHLT_boundary_vectors(
        tokenizer,
        surface_words,
    )

    word_results = []

    # Compare every predicted boundary vector with its
    # corresponding NCHLT gold segmentation
    for (
        surface_word,
        gold_segmentation,
    ), predicted_boundaries in zip(
        words,
        predicted_boundary_vectors,
    ):
        predicted_vector = BoundaryVector(
            word=surface_word,
            boundaries=predicted_boundaries,
        )

        gold_vector = to_boundary_vector(
            surface_word,
            gold_segmentation,
        )

        word_results.append(
            compare_boundaries(
                predicted_vector,
                gold_vector,
            )
        )

    # Combine all word results into overall precision/recall/F1
    metrics = aggregate_results(word_results)

    result = {
        "words_evaluated": len(word_results),
        "metrics": {
            "precision": metrics.precision,
            "recall": metrics.recall,
            "f1": metrics.f1,
            "aligned_boundaries": metrics.aligned_boundaries,
            "total_gold_boundaries": metrics.total_gold_boundaries,
        },
    }

    return result