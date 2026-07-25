import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def generate_token() -> str:
    """Opaque random token handed to the client (session / password reset)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Fast deterministic hash: the DB stores only the digest, never the raw token."""
    return hashlib.sha256(token.encode()).hexdigest()
