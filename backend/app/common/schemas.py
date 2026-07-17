from typing import Annotated

from fastapi import Depends, Query
from pydantic import BaseModel


class PageParams:
    """Plain dependency class: a Pydantic query-model breaks when mixed with
    other query params (fastapi 0.139), so we use the classic Depends pattern."""

    def __init__(
        self,
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    ):
        self.page = page
        self.page_size = page_size


PageDep = Annotated[PageParams, Depends()]


class PageOut[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
