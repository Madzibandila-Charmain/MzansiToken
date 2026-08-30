import pytest

from app.services.morphology_service import to_boundary_vector, compare_boundaries, aggregate_results, BoundaryVector, WordResult, MBIResult

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


def test_to_boundary_vector_ignores_stray_delimiters():
    result = to_boundary_vector("is", "_i_s_")
    assert get_vector(result) == [1]


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

# -----------------------------aggregate_results Test---------------------------------

def make_word_result(tp, fp, fn):
    return WordResult(word="test",tp=tp, fp=fp, fn=fn)


# Basic correctness test
@pytest.mark.parametrize(
    "word_counts, expected",
    [
        pytest.param([(1, 0, 0)], (1, 1, 1), id="single_perfect"),
        pytest.param([(2, 2, 2)], (0.5, 0.5, 0.5), id="single_partial"),
        pytest.param(
            [(10, 0, 0), (0, 10, 0)], (0.5, 1.0, 2 / 3), id="mixed_across_words"
        ),
        pytest.param([], (0, 0, 0), id="empty_word_results"),
        pytest.param([(0, 0, 0)], (0, 0, 0), id="no_tp_fp_fn"),
        pytest.param([(0, 3, 4)], (0, 0, 0), id="no_true_positives"),
        pytest.param(
            [(1, 1, 1), (2, 0, 3), (5, 2, 0)], (8 / 11, 8 / 12, None), id="many_words"
        ),
    ],
)
def test_aggregate_results_correctness(word_counts, expected):
    # Make a list of word counts with for specific parameters
    word_results = [make_word_result(tp, fp, fn) for tp, fp, fn in word_counts]
 
    result = aggregate_results(word_results)

    # Determine expected results
    expected_precision, expected_recall, expected_f1 = expected
    if expected_f1 is None:
        # derive f1 from precision/recall instead of hardcoding it
        p, r = expected_precision, expected_recall
        expected_f1 = 2 * (p * r) / (p + r) if (p + r) > 0 else 0.0

    # Compare
    assert result.precision == pytest.approx(expected_precision)
    assert result.recall == pytest.approx(expected_recall)
    assert result.f1 == pytest.approx(expected_f1)
 
 
def test_many_words_aggregate_correctly():
    """Sanity check across several words with varied counts."""
    results = [
        make_word_result(tp=1, fp=1, fn=1),
        make_word_result(tp=2, fp=0, fn=3),
        make_word_result(tp=5, fp=2, fn=0),
    ]
    result = aggregate_results(results)
 
    tot_tp, tot_fp, tot_fn = 8, 3, 4
    expected_precision = tot_tp / (tot_tp + tot_fp)
    expected_recall = tot_tp / (tot_tp + tot_fn)
    expected_f1 = 2 * (expected_precision * expected_recall) / (
        expected_precision + expected_recall
    )
 
    assert result.precision == pytest.approx(expected_precision)
    assert result.recall == pytest.approx(expected_recall)
    assert result.f1 == pytest.approx(expected_f1)