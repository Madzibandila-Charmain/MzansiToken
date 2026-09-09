import pytest

from app.services import metrics
from app.services.flores_state import _metrics_cache


@pytest.fixture(autouse=True)
def clear_metric_caches():
    """
    Empty the metric caches around every test.

    Without this, results from one test leak into the next and failures start depending on test order. 
    The tokenizer cache is deliberately left alone - it holds immutable objects keyed by name, and clearing it would make every
    test reload gpt2.
    """
    metrics._english_baseline_cache.clear()
    _metrics_cache.clear()
    yield
    metrics._english_baseline_cache.clear()
    _metrics_cache.clear()