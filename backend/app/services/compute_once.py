"""
compute_once.py - remember expensive answers, and work each one out once.

Author: Mukovhe Ranwashe (RNWMUK001)

Every cache in the backend follows the same rule: if the answer is
remembered, hand it back; if not, work it out, remember it, hand it back -
and if two requests ask for the same thing at the same moment, the second
waits for the first instead of doing all the work again beside it. That rule
lives here once, and the corpus metrics, the vocabulary measures, the
morphology scores and the built-in corpus a page loads all use it.

A failure is never remembered: the exception goes back to the caller, and
the next request tries again.
"""

import threading
from collections import OrderedDict

_locks = {}
_locks_guard = threading.Lock()


def once(cache, key, compute):
    """cache[key], calling compute() for it at most once at a time."""
    try:
        return cache[key]
    except KeyError:
        pass

    # Keyed by the cache as well, so the same key in two different caches
    # never waits on the other's work.
    with _locks_guard:
        lock = _locks.setdefault((id(cache), key), threading.Lock())

    with lock:
        # Someone else may have finished it while this one waited.
        try:
            return cache[key]
        except KeyError:
            pass

        result = compute()
        cache[key] = result
        return result


class BoundedCache:
    """
    A cache that keeps at most `size` answers, dropping the one used longest
    ago when a new one arrives. For answers big enough that keeping every one
    for the life of the server would add up - a whole tokenized corpus, say.
    """

    def __init__(self, size: int):
        self._size = size
        self._items = OrderedDict()
        self._lock = threading.Lock()

    def __getitem__(self, key):
        with self._lock:
            value = self._items[key]
            self._items.move_to_end(key)
            return value

    def __setitem__(self, key, value):
        with self._lock:
            self._items[key] = value
            self._items.move_to_end(key)

            while len(self._items) > self._size:
                self._items.popitem(last=False)

    def __contains__(self, key):
        with self._lock:
            return key in self._items

    def __len__(self):
        with self._lock:
            return len(self._items)

    def clear(self):
        with self._lock:
            self._items.clear()
