import threading
import time

import pytest

from app.services.compute_once import BoundedCache, once


def test_a_remembered_answer_is_not_worked_out_again():
    cache = {}
    calls = []

    def compute():
        calls.append(1)
        return "answer"

    assert once(cache, "k", compute) == "answer"
    assert once(cache, "k", compute) == "answer"
    assert len(calls) == 1


def test_asked_at_the_same_moment_it_is_still_worked_out_once():
    cache = {}
    calls = []

    def slow():
        calls.append(1)
        time.sleep(0.2)
        return object()

    results = []
    threads = [
        threading.Thread(target=lambda: results.append(once(cache, "k", slow)))
        for _ in range(5)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(calls) == 1
    assert all(result is results[0] for result in results)


def test_a_failure_is_not_remembered():
    cache = {}

    def broken():
        raise ValueError("Could not reach Hugging Face")

    with pytest.raises(ValueError):
        once(cache, "k", broken)

    assert "k" not in cache
    assert once(cache, "k", lambda: "back online") == "back online"


def test_the_same_key_in_two_caches_does_not_wait_on_the_other():
    first, second = {}, {}
    started = threading.Event()
    release = threading.Event()

    def blocking():
        started.set()
        release.wait(2)
        return "first"

    worker = threading.Thread(target=lambda: once(first, "gpt2", blocking))
    worker.start()
    started.wait(2)

    # Answered straight away while the other cache's "gpt2" is still busy.
    began = time.time()
    assert once(second, "gpt2", lambda: "second") == "second"
    assert time.time() - began < 0.5

    release.set()
    worker.join()


def test_bounded_cache_drops_the_one_used_longest_ago():
    cache = BoundedCache(2)
    cache["a"] = 1
    cache["b"] = 2

    assert cache["a"] == 1      # "a" is now the most recently used
    cache["c"] = 3              # so "b" is the one to go

    assert "a" in cache
    assert "b" not in cache
    assert "c" in cache
    assert len(cache) == 2


def test_bounded_cache_works_with_once():
    cache = BoundedCache(1)
    calls = []

    def compute(value):
        calls.append(value)
        return value

    once(cache, "a", lambda: compute("a"))
    once(cache, "b", lambda: compute("b"))   # pushes "a" out
    once(cache, "a", lambda: compute("a"))   # so it is worked out again

    assert calls == ["a", "b", "a"]


def test_bounded_cache_clear():
    cache = BoundedCache(3)
    cache["a"] = 1
    cache.clear()
    assert len(cache) == 0
    with pytest.raises(KeyError):
        cache["a"]


def test_morphology_for_the_same_pair_is_worked_out_once(monkeypatch):
    from app.services import nchlt_state

    nchlt_state._mbi_cache.clear()
    calls = []

    def slow(language, tokenizer):
        calls.append(language)
        time.sleep(0.2)
        return {"words_evaluated": 1, "metrics": {}}

    monkeypatch.setattr(nchlt_state, "_compute_mbi", slow)

    threads = [
        threading.Thread(target=nchlt_state.get_or_compute_mbi, args=("mock-mbi", "isiZulu", object()))
        for _ in range(3)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert calls == ["isiZulu"]
    nchlt_state._mbi_cache.clear()


def test_morphology_for_a_language_without_gold_data_is_still_a_key_error():
    # Callers rely on this to tell "no NCHLT data" apart from a real failure.
    from app.services import nchlt_state

    with pytest.raises(KeyError):
        nchlt_state.get_or_compute_mbi("mock-mbi", "English", object())
