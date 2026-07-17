"""Local file storage. Paths stored in DB are relative keys (e.g. "cv/<user>/<uuid>.pdf"),
so swapping this module for an S3-compatible backend later won't need a data migration."""

import uuid
from pathlib import Path

from app.core.config import get_settings


def _root() -> Path:
    return Path(get_settings().upload_dir)


def save_bytes(data: bytes, subdir: str, extension: str) -> str:
    """Store bytes under a generated name, return the relative storage key."""
    key = f"{subdir}/{uuid.uuid4().hex}{extension}"
    target = _root() / key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return key


def resolve_path(key: str) -> Path:
    return _root() / key
