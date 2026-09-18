"""
test_mbi.py - unit tests for the MBI boundary maths.
Author: Mukovhe Ranwashe (RNWMUK001), 18 September 2026
"""

import pytest
from app.services.morphology_service import (
    BoundaryVector, to_boundary_vector, compare_boundaries, aggregate_results)

def mbi(surf, gold, pred_boundaries):
    g = to_boundary_vector(surf, gold)
    p = BoundaryVector(surf, pred_boundaries)
    return aggregate_results([compare_boundaries(p, g)])

def test_gold_vector_marks_each_underscore():
    assert to_boundary_vector("ngiyabonga", "ngi_ya_bonga").boundaries == \
        [0,0,1,0,1,0,0,0,0]

def test_perfect_segmentation_scores_one():
    m = mbi("ngiyabonga", "ngi_ya_bonga", [0,0,1,0,1,0,0,0,0])
    assert (m.precision, m.recall, m.f1) == (1.0, 1.0, 1.0)

def test_no_boundaries_predicted_scores_zero():
    m = mbi("ngiyabonga", "ngi_ya_bonga", [0]*9)
    assert (m.precision, m.recall, m.f1) == (0.0, 0.0, 0.0)

def test_character_level_is_perfect_recall_poor_precision():
    """Splitting every letter finds every boundary and invents seven."""
    m = mbi("ngiyabonga", "ngi_ya_bonga", [1]*9)
    assert m.recall == 1.0
    assert m.precision == pytest.approx(2/9)

def test_half_right():
    m = mbi("ngiyabonga", "ngi_ya_bonga", [0,0,0,0,1,0,0,0,0])
    assert m.precision == 1.0
    assert m.recall == 0.5
    assert m.f1 == pytest.approx(2/3)

def test_f1_is_the_harmonic_mean():
    m = mbi("abcde", "ab_c_de", [1,1,0,1])
    p, r = m.precision, m.recall
    assert m.f1 == pytest.approx(2*p*r/(p+r))

def test_one_letter_word_has_no_boundaries():
    assert to_boundary_vector("a", "a").boundaries == []

def test_length_mismatch_is_refused():
    with pytest.raises(ValueError):
        compare_boundaries(BoundaryVector("abc", [0,0]), BoundaryVector("abcd", [0,0,0]))

def test_leading_and_trailing_delimiters_are_ignored():
    """A malformed gold entry must not mark a boundary outside the word."""
    assert to_boundary_vector("abc", "_abc").boundaries == [0,0]
    assert to_boundary_vector("abc", "abc_").boundaries == [0,0]

def test_micro_average_not_macro():
    """A long word must carry more weight than a short one."""
    long_ = compare_boundaries(BoundaryVector("abcdefghij", [1]*9),
                               BoundaryVector("abcdefghij", [1]*9))
    short = compare_boundaries(BoundaryVector("ab", [1]),
                               BoundaryVector("ab", [0]))
    m = aggregate_results([long_, short])
    assert m.precision == pytest.approx(9/10)

def test_empty_input_does_not_divide_by_zero():
    m = aggregate_results([])
    assert (m.precision, m.recall, m.f1) == (0.0, 0.0, 0.0)