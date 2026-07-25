from pydantic import BaseModel, Field


class EventIn(BaseModel):
    name: str = Field(max_length=64)
    properties: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
