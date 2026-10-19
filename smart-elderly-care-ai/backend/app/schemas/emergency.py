"""Request and response schemas for one-touch emergency SOS."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EmergencySOSRequest(BaseModel):
    address: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    message: str | None = Field(default=None, max_length=500)

    model_config = ConfigDict(extra="forbid")


class EmergencySOSResponse(BaseModel):
    status: Literal["accepted"]
    dial_number: str
    dial_uri: str
    notification_sent: int
    notification_failed: int
