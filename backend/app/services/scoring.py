"""
scoring.py - the MzansiScore: one number, 0 to 100, for a tokenizer.

Author: Mukovhe Ranwashe
Date: September 2026

WHAT THE SCORE MEASURES

    A tokenizer is good for South African languages when it (a) does not
    shred words into many pieces, (b) carries a useful amount of text in
    each token, (c) does not charge these languages far more than English
    for the same sentence, and (d) cuts where morphemes actually end.

    Those are exactly the four numbers the backend already computes:

        fertility      tokens per word              lower is better
        compression    bytes per token              higher is better
        token_premium  tokens vs English, same text lower is better
        f1             MBI boundary F1              higher is better

    Each is mapped onto 0-100 and the four are averaged with weights.
"""

# Fertility bounds: 6 tokens per word = terrible (score 0), 1 token per word = perfect (score 100).
FERTILITY_BOUNDS = (6.0, 1.0)

# Compression bounds: 1 byte/token = character-level (bad), 5 bytes/token = efficient subword tokens (good).
COMPRESSION_BOUNDS = (1.0, 5.0)

# Token premium bounds: 3.0 = isiZulu costs 3× English (bad), 1.0 = parity with English (good).
TOKEN_PREMIUM_BOUNDS = (3.0, 1.0)

# F1 bounds: already between 0 and 1, just scale to 0–100.
F1_BOUNDS = (0.0, 1.0)

# Weights: how much each metric matters in the final score. They add up to 1.0 (100%). If one metric is missing, the others are renormalised.
WEIGHTS = {
    "token_premium": 0.30,   # fairness vs English
    "fertility": 0.25,       # word splitting
    "f1": 0.25,              # morpheme boundary accuracy
    "compression": 0.20,     # bytes per token
}


# BOUNDS dictionary: maps each metric name to its scoring anchors.
BOUNDS = {
    "fertility": FERTILITY_BOUNDS,
    "compression": COMPRESSION_BOUNDS,
    "token_premium": TOKEN_PREMIUM_BOUNDS,
    "f1": F1_BOUNDS,
}

# SCORED_METRICS: just the names of the four metrics. Useful for other files that need to know which keys matter.
SCORED_METRICS = tuple(BOUNDS)


def scale(value, bounds):
    """
    Convert one metric into a 0–100 score using its bounds.
    - Example: fertility of 3.0 → somewhere between 6.0 (bad) and 1.0 (good).
    - Handles missing values safely (returns None).
    - Clamps extreme outliers so they don’t break the score.
    """
    if value is None:
        return None

    try:
        value = float(value)
    except (TypeError, ValueError):
        return None

    zero_at, hundred_at = bounds
    span = hundred_at - zero_at
    if span == 0:
        return None

    position = (value - zero_at) / span
    position = max(0.0, min(1.0, position))  # clamp between 0 and 1

    return round(position * 100, 2)


def component_scores(metrics):
    """
    Scale all four metrics to 0–100.
    Returns a dict like:
    {
        "fertility": 80.5,
        "compression": 65.2,
        "token_premium": 90.0,
        "f1": None   # if missing
    }
    """
    return {
        name: scale(metrics.get(name), bounds)
        for name, bounds in BOUNDS.items()
    }


def overall_score(metrics):
    """
    Combine the four component scores into one weighted total (0–100).
    - Drops missing components instead of scoring them as zero.
    - Renormalises weights so missing data doesn’t unfairly punish a tokenizer.
    """
    parts = component_scores(metrics)

    total = 0.0
    weight_used = 0.0

    for name, value in parts.items():
        if value is None:
            continue
        weight = WEIGHTS.get(name, 0.0)
        total += value * weight
        weight_used += weight

    if weight_used == 0.0:
        return None

    return round(total / weight_used, 2)


def score_breakdown(metrics):
    """
    Return a full explanation of the score:
    - overall_score: the final number
    - components: each metric scaled 0–100
    - weights: the published weight of each metric that had data
    - missing: list of metrics with no data

    A warning about "weights": these are the published weights, and when
    something is missing they do not add up to 1. overall_score divides by
    the weight it actually used, so multiplying these by the components
    will NOT reproduce overall_score unless every metric is present.
    """
    parts = component_scores(metrics)
    present = [name for name, value in parts.items() if value is not None]

    return {
        "overall_score": overall_score(metrics),
        "components": parts,
        "weights": {name: WEIGHTS[name] for name in present},
        "weight_used": round(sum(WEIGHTS[name] for name in present), 4),
        "missing": [name for name, value in parts.items() if value is None],
    }
