import pytest

from app.services.morphology_service import to_boundary_vector, compare_boundaries, BoundaryVector, WordResult

def get_vector(result: BoundaryVector):
    """Helper to pull the raw list out of your BoundaryVector object."""
    return result.boundaries


# -----------------------------to_boundary_vector Test---------------------------------

# Basic correctness test

@pytest.mark.parametrize("surf_word, split_word, expected", [
    ("hello", "hel_lo", [0, 0, 1, 0]), # single boundary word
    ("bayahamba", "ba_ya_hamba", [0, 1, 0, 1, 0, 0, 0, 0]), # multiple boundary word
    ("bayahamba", "bayahamba", [0, 0, 0, 0, 0, 0, 0, 0]), # no boundaries
    ("bayahamba", "b_a_y_a_h_a_m_b_a", [1, 1, 1, 1, 1, 1, 1, 1]), # every gap is a boundary
])
def test_to_boundary_vector_basic_correctness(surf_word, split_word, expected):
    result = to_boundary_vector(surf_word, split_word)
    assert get_vector(result) == expected

# Length edge case test

@pytest.mark.parametrize("surf_word, split_word, expected", [
    ("a", "a", []), # one letter word -> no gaps
    ("is", "i_s", [1]), # two letter word with one boundary
    ("is", "is", [0]), # two letter word without one boundary
])
def test_to_boundary_vector_len_edge_cases(surf_word, split_word, expected):
    result = to_boundary_vector(surf_word, split_word)
    assert get_vector(result) == expected

# Custom delimeter test
def test_to_boundary_vector_custom_delimeter():
    result = to_boundary_vector("hello", "hel-lo", "-")
    assert get_vector(result) == [0, 0, 1, 0]


# -----------------------------compare_boundaries Test---------------------------------

# Basic correctness test
@pytest.mark.parametrize(
    "predicted, gold, expected",
    [
        pytest.param([1, 0, 1, 0], [1, 0, 0, 1], (1, 1, 1), id="mixed"),
        pytest.param([], [], (0, 0, 0), id="both_empty"),
        pytest.param([1, 1, 1], [1, 1, 1], (3, 0, 0), id="perfect_match"),
        pytest.param([0, 0, 0], [0, 0, 0], (0, 0, 0), id="no_boundaries_nonempty"),
        pytest.param([1, 1, 1], [0, 0, 0], (0, 3, 0), id="all_false_positive"),
        pytest.param([0, 0, 0], [1, 1, 1], (0, 0, 3), id="all_false_negative"),
        pytest.param([1], [1], (1, 0, 0), id="single_boundary_match"),
    ],
)
def test_compare_boundaries_correctness(predicted, gold, expected):
    predicted_vector = BoundaryVector("test",predicted)
    gold_vector = BoundaryVector("test",gold)

    result = compare_boundaries(predicted_vector, gold_vector)

    tp, fp, fn = expected
    assert result.tp == tp
    assert result.fp == fp
    assert result.fn == fn

# Exception test
def test_compare_boundaries_mismatched_lengths_raises():
    pred_bv = BoundaryVector("test", [1])
    gold_bv = BoundaryVector("test", [1, 0])

    with pytest.raises((ValueError, IndexError)):
        compare_boundaries(pred_bv, gold_bv)
