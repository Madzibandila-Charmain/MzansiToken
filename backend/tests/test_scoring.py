"""
test_scoring.py - unit tests for the MzansiScore.

Author: Mukovhe Ranwashe (RNWMUK001)
Date: 18 September 2026

"""

import pytest

from app.services.scoring import (
    WEIGHTS,
    component_scores,
    overall_score,
    scale,
    score_breakdown,
)



# scale()


def test_scale_hits_both_ends():
    """The anchors themselves must score exactly 0 and exactly 100."""
    assert scale(1.0, (1.0, 5.0)) == 0
    assert scale(5.0, (1.0, 5.0)) == 100


def test_scale_is_linear_in_between():
    assert scale(3.0, (1.0, 5.0)) == 50


def test_scale_handles_a_reversed_pair():
    """
    Lower-is-better metrics are expressed by reversing the pair, so this is
    the whole mechanism for fertility and token premium.
    """
    assert scale(6.0, (6.0, 1.0)) == 0
    assert scale(1.0, (6.0, 1.0)) == 100
    assert scale(3.5, (6.0, 1.0)) == 50


def test_scale_clamps_beyond_the_anchors():
    """An outlier is pinned to the end, never allowed past it."""
    assert scale(0.5, (1.0, 5.0)) == 0
    assert scale(9.9, (1.0, 5.0)) == 100
    assert scale(0.5, (6.0, 1.0)) == 100


def test_scale_returns_none_for_missing_or_junk():
    assert scale(None, (1.0, 5.0)) is None
    assert scale("not a number", (1.0, 5.0)) is None



# overall_score()


def test_a_perfect_tokenizer_scores_100():
    perfect = {
        "fertility": 1.0,
        "compression": 5.0,
        "token_premium": 1.0,
        "f1": 1.0,
    }
    assert overall_score(perfect) == 100


def test_the_worst_case_scores_0():
    worst = {
        "fertility": 6.0,
        "compression": 1.0,
        "token_premium": 3.0,
        "f1": 0.0,
    }
    assert overall_score(worst) == 0


def test_a_realistic_tokenizer_lands_in_between():
    """
    Roughly what an English-trained BPE does on these languages. The exact
    number is not the point; it must not be pinned to an end.
    """
    gpt2_ish = {
        "fertility": 4.0,
        "compression": 2.3,
        "token_premium": 2.4,
        "f1": 0.55,
    }

    score = overall_score(gpt2_ish)

    assert 0 < score < 100
    assert score == pytest.approx(39.75, abs=0.5)


def test_a_better_tokenizer_scores_higher():
    """The ordering is the only property the leaderboard actually relies on."""
    worse = {"fertility": 4.0, "compression": 2.3, "token_premium": 2.4, "f1": 0.55}
    better = {"fertility": 2.5, "compression": 3.2, "token_premium": 1.6, "f1": 0.62}

    assert overall_score(better) > overall_score(worse)


def test_every_metric_moves_the_score_the_right_way():
    """
    Guards the direction of each anchor pair. Getting one of these backwards
    would still produce plausible-looking numbers, so it is worth a test.
    """
    base = {"fertility": 3.0, "compression": 3.0, "token_premium": 2.0, "f1": 0.5}

    better_fertility = {**base, "fertility": 2.0}
    better_compression = {**base, "compression": 4.0}
    better_premium = {**base, "token_premium": 1.5}
    better_f1 = {**base, "f1": 0.8}

    assert overall_score(better_fertility) > overall_score(base)
    assert overall_score(better_compression) > overall_score(base)
    assert overall_score(better_premium) > overall_score(base)
    assert overall_score(better_f1) > overall_score(base)



# Missing components


def test_missing_morphology_renormalises_rather_than_penalises():
    """
    The bug this prevents: a tokenizer with no NCHLT data scoring below one
    that was measured and found bad. No data is not a bad result.
    """
    with_f1 = {"fertility": 2.0, "compression": 4.0, "token_premium": 1.5, "f1": 0.0}
    without_f1 = {"fertility": 2.0, "compression": 4.0, "token_premium": 1.5}

    assert overall_score(without_f1) > overall_score(with_f1)


def test_score_of_only_one_metric_is_that_metric():
    """With one component surviving, renormalising must leave it untouched."""
    assert overall_score({"fertility": 1.0}) == 100
    assert overall_score({"fertility": 6.0}) == 0


def test_no_usable_metrics_gives_none_not_zero():
    """
    Zero would sort an unmeasured tokenizer as the worst on the board. None
    sorts last under the query's NULLS LAST, which is what we want.
    """
    assert overall_score({}) is None
    assert overall_score({"fertility": None, "f1": None}) is None
    assert overall_score({"token_count": 61665}) is None


def test_unknown_keys_are_ignored():
    """The leaderboard posts token_count too; it must not affect the score."""
    without = overall_score({"fertility": 2.0})
    with_extra = overall_score({"fertility": 2.0, "token_count": 99999, "spam": 1})

    assert without == with_extra


# The weights themselves


def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


# Reporting helpers

def test_component_scores_names_all_four():
    parts = component_scores({"fertility": 1.0})

    assert set(parts) == {"fertility", "compression", "token_premium", "f1"}
    assert parts["fertility"] == 100
    assert parts["compression"] is None


def test_breakdown_lists_what_was_missing():
    breakdown = score_breakdown({"fertility": 2.0, "compression": 3.0})

    assert breakdown["overall_score"] is not None
    assert sorted(breakdown["missing"]) == ["f1", "token_premium"]
    assert sorted(breakdown["weights"]) == ["compression", "fertility"]


def test_breakdown_weights_only_cover_what_was_used():
    breakdown = score_breakdown({"fertility": 2.0})

    assert list(breakdown["weights"]) == ["fertility"]