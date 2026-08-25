import pytest

from app.services.tokenizer_service import tokenize_NCHLT


#------------------test tokenize_NCHLT ---------------------

## Mock tokenizer for testing function
class DummyTokenizer:
	def __init__(self, mapping):
		self.mapping = mapping

	def tokenize(self, surf):
		# return a copy to avoid accidental mutation in tests
		return list(self.mapping.get(surf, []))


# '##' markers should be stripped
def test_tokenize_NCHLT_wordpiece():
    tokenizer = DummyTokenizer({"uThando": ["u", "##Th", "##ando"]})
    data = [("uThando", "u_Thando")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("uThando", "u_Th_ando")]
	
# "▁" should be stripped
def test_tokenize_NCHLT_sentencepiece():
    tokenizer = DummyTokenizer({"umfana": ["▁um", "fana"]})
    data = [("umfana", "um_fana")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("umfana", "um_fana")]

# "Ġ" should be stripped
def test_tokenize_NCHLT_bpe():
    tokenizer = DummyTokenizer({"abantu": ["Ġab", "antu"]})
    data = [("abantu", "ab_antu")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("abantu", "ab_antu")]

# Tokens without markers should remain unchanged
def test_tokenize_NCHLT_no_markers():
    tokenizer = DummyTokenizer({"cat": ["cat"]})
    data = [("cat", "cat")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("cat", "cat")]

# Test custom delimiter functionality
def test_tokenize_NCHLT_custom_delimeter():
    tokenizer = DummyTokenizer({"uThando": ["u", "##Th", "##ando"]})
    data = [("uThando", "u-Thando")]
    result = tokenize_NCHLT(tokenizer, data, delimeter="+")
    assert result == [("uThando", "u+Th+ando")]

# A token with only a marker should vanish (This shouldn't happen anyway)
def test_tokenize_NCHLT_only_token():
    tokenizer = DummyTokenizer({"weird": ["▁", "word"]})
    data = [("weird", "word")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("weird", "word")]

# Results should be returned in the same order
def test_tokenizer_NCHLT_preserve_order():
    tokenizer = DummyTokenizer({
        "a": ["a"],
        "b": ["##b"],
        "c": ["▁c"],
    })
    data = [("a", "a"), ("b", "b"), ("c", "c")]
    result = tokenize_NCHLT(tokenizer, data)
    assert result == [("a", "a"), ("b", "b"), ("c", "c")]

# Empty list should return an empty list
def test_empty_input_list_returns_empty_list():
    tokenizer = DummyTokenizer({})
    result = tokenize_NCHLT(tokenizer, [])
    assert result == []






    
	
		