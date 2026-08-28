# Pydantic models define the JSON shape React sends in a POST body.
# FastAPI uses these to validate incoming requests automatically.

from pydantic import BaseModel

class InspectRequest(BaseModel):
    """Data sent by React when loading a default FLORES corpus."""
    language: str
    tokenizer: str


class TokenizeTextRequest(BaseModel):
    """Data sent by React when the user types custom text."""
    text: str
    language: str
    tokenizer: str
