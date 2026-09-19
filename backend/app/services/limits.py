"""
limits.py - the caps on what one request may send in.

Author: Mukovhe Ranwashe (RNWMUK001)

These numbers were scattered across the routers and the extractor, which was
fine while nothing else needed them. The frontend now shows them to the user
before they pick a file, and a limit displayed as 5 MB while the server
enforces 4 is worse than showing no limit at all - so there is one definition
and everything else imports it.

/options serves this module to the frontend, so the numbers on screen cannot
drift from the numbers being enforced.
"""

# Bytes accepted by /inspect/upload. Counted as they ARRIVE, so for a format
# that expands - .docx is a ZIP - this says nothing about what it becomes.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

# Read size for the capped upload reader. Never shown to anyone.
UPLOAD_CHUNK_BYTES = 64 * 1024

# Characters of TEXT allowed out of an upload once it has been read. This is
# the cap that bounds the tokenizer's work, which is why it exists separately
# from the byte cap above.
MAX_EXTRACTED_CHARS = 2_000_000

# Characters accepted by the typed-text box.
MAX_TEXT_CHARS = 20_000


def as_payload(accepted_extensions) -> dict:
    """
    The limits in the shape /options serves them.

    Bytes are given raw for comparisons and in MB for display, so the
    frontend never has to divide and never has to guess at rounding.
    """
    return {
        "max_upload_bytes": MAX_UPLOAD_BYTES,
        "max_upload_mb": MAX_UPLOAD_BYTES // (1024 * 1024),
        "max_extracted_chars": MAX_EXTRACTED_CHARS,
        "max_text_chars": MAX_TEXT_CHARS,
        "accepted_extensions": list(accepted_extensions),
    }
