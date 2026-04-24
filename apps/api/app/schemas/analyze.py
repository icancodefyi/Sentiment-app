from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50_000)


class SentimentScores(BaseModel):
    positive: float = Field(ge=0, le=100)
    negative: float = Field(ge=0, le=100)
    neutral: float = Field(ge=0, le=100)


class SentimentBlock(BaseModel):
    label: Literal["positive", "negative", "neutral"]
    confidence: float = Field(ge=0, le=100)
    scores: SentimentScores


class EmotionScores(BaseModel):
    fear: float = Field(ge=0, le=100)
    anger: float = Field(ge=0, le=100)
    joy: float = Field(ge=0, le=100)
    sadness: float = Field(ge=0, le=100)
    urgency: float = Field(ge=0, le=100)


class ToneScores(BaseModel):
    aggressive: float = Field(ge=0, le=100)
    polite: float = Field(ge=0, le=100)
    manipulative: float = Field(ge=0, le=100)


class ToneBlock(BaseModel):
    label: Literal["aggressive", "polite", "manipulative"]
    scores: ToneScores


class AnalyzeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sentiment: SentimentBlock
    emotions: EmotionScores
    tone: ToneBlock
    rationale: str = Field(..., max_length=4000)
    provider_model: str = Field(..., description="LLM id used for this run")
    truncated: bool = False

    @field_validator("rationale", mode="before")
    @classmethod
    def strip_rationale(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v
