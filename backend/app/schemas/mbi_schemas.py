"""Pydantic schemas for morphology / MBI endpoints."""

from pydantic import BaseModel


class MBIMetrics(BaseModel):
    precision: float
    recall: float
    f1: float


class MBIResult(BaseModel):
    model_name: str
    language: str
    words_evaluated: int
    metrics: MBIMetrics


class MBIComparisonTokenizerResult(BaseModel):
    name: str
    metrics: MBIMetrics
    words_evaluated: int


class MBIComparisonResult(BaseModel):
    language: str
    tokenizer_a: MBIComparisonTokenizerResult
    tokenizer_b: MBIComparisonTokenizerResult