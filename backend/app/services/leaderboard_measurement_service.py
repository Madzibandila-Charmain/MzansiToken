"""
leaderboard_measurement_service.py - trusted leaderboard measurements.

The backend calculates all leaderboard metrics here instead of trusting
metric values supplied by the frontend.

Author: Madzibandila Charmain
"""

from db import VOCABULARY_COLUMNS as VOCABULARY_METRICS
from app.services.flores_state import (
    get_or_compute_metrics,
    get_or_compute_vocabulary,
)
from app.services.nchlt_state import available_languages, get_or_compute_mbi
from app.services.tokenizer_state import get_or_load_tokenizer


BASELINE_LANGUAGE = "English"


def _mean(values):
    """Return the mean of numeric values, or None when there are none."""
    valid_values = []

    for value in values:
        if value is None:
            continue

        valid_values.append(float(value))

    if not valid_values:
        return None

    return sum(valid_values) / len(valid_values)



def _vocabulary_means(metrics: dict, vocabulary: dict) -> dict:
    """The three vocabulary metrics, averaged over the South African
    languages - English left out, the same as every other column."""
    per_language = [
        {**entry, **vocabulary.get(language, {})}
        for language, entry in metrics.items()
        if language != BASELINE_LANGUAGE
    ]

    return {
        name: _mean(entry.get(name) for entry in per_language)
        for name in VOCABULARY_METRICS
    }


def compute_vocabulary_metrics(model_name: str) -> dict:
    """
    Only the three vocabulary metrics, for a board entry saved before they
    existed. Efficiency alone - no morphology run - and it comes from the
    same cache as the per-language charts, so it is usually instant.
    """
    tokenizer = get_or_load_tokenizer(model_name)

    return _vocabulary_means(
        get_or_compute_metrics(model_name, tokenizer),
        get_or_compute_vocabulary(model_name, tokenizer),
    )


def compute_leaderboard_metrics(model_name: str) -> dict:
    """
    Calculate the complete trusted metric set for one tokenizer.

    The calculations mirror the existing Rank page:
    - Efficiency excludes English.
    - Token count is summed.
    - Other efficiency metrics are averaged.
    - MBI metrics are averaged across successfully measured NCHLT languages.
    """

    tokenizer = get_or_load_tokenizer(model_name)

    # ---------------------------------------------------------
    # Efficiency metrics
    # ---------------------------------------------------------

    metrics = get_or_compute_metrics(
        model_name,
        tokenizer,
    )

    languages = []

    for language in metrics:
        if language != BASELINE_LANGUAGE:
            languages.append(language)

    per_language = []

    for language in languages:
        per_language.append(metrics[language])

    token_count_values = []

    fertility_values = []
    compression_values = []
    token_premium_values = []

    for entry in per_language:
        if entry.get("token_count") is not None:
            token_count_values.append(entry["token_count"])

        fertility_values.append(entry.get("fertility"))
        compression_values.append(entry.get("compression"))
        token_premium_values.append(entry.get("token_premium"))

    token_count = sum(token_count_values)

    fertility = _mean(fertility_values)
    compression = _mean(compression_values)
    token_premium = _mean(token_premium_values)

    # ---------------------------------------------------------
    # Morphology metrics
    # ---------------------------------------------------------

    morphology_languages = available_languages()

    morphology_results = []
    failed_languages = []

    for language in morphology_languages:
        try:
            result = get_or_compute_mbi(
                model_name,
                language,
                tokenizer,
            )

            morphology_results.append(result["metrics"])

        except KeyError:
            # Language is not available in the NCHLT corpus.
            continue

        except Exception as error:
            failed_languages.append(
                {
                    "language": language,
                    "detail": str(error) or "could not be read",
                }
            )

    if morphology_languages and not morphology_results:
        detail = "Morphology failed on all languages."

        if failed_languages:
            detail = (
                f"Morphology failed on all "
                f"{len(failed_languages)} languages. "
                f"{failed_languages[0]['detail']}"
            )

        raise RuntimeError(detail)

    f1 = _mean(
        result.get("f1")
        for result in morphology_results
    )

    precision = _mean(
        result.get("precision")
        for result in morphology_results
    )

    recall = _mean(
        result.get("recall")
        for result in morphology_results
    )

    return {
        "token_count": token_count,
        "fertility": fertility,
        "compression": compression,
        "token_premium": token_premium,
        "f1": f1,
        "precision": precision,
        "recall": recall,
        **_vocabulary_means(
            metrics,
            get_or_compute_vocabulary(model_name, tokenizer),
        ),
        "languages_measured": len(languages),
        "morphology_measured": len(morphology_results),
        "failed_languages": failed_languages,
    }