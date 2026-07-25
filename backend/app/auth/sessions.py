"""Opaque-token cookie sessions: create/lookup/revoke + cookie helpers."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.models import AuthSession
from app.core.config import get_settings
from app.core.security import generate_token, hash_token
from app.users.models import User

SESSION_COOKIE = "niti_session"

# last_used_at is refreshed at most this often to avoid a write on every request
_LAST_USED_REFRESH = timedelta(minutes=5)


def create_session(db: Session, user: User, request: Request) -> str:
    """Store a new session (hash only) and return the raw token. Caller commits."""
    settings = get_settings()
    token = generate_token()
    user_agent = request.headers.get("user-agent")
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.session_expire_days),
        user_agent=user_agent[:255] if user_agent else None,
        ip=request.client.host if request.client else None,
    )
    db.add(session)
    db.flush()
    return token


def get_session_user(db: Session, token: str) -> User | None:
    now = datetime.now(UTC)
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if session is None or session.revoked_at is not None or session.expires_at <= now:
        return None
    if session.last_used_at is None or now - session.last_used_at >= _LAST_USED_REFRESH:
        session.last_used_at = now
        db.commit()
    return db.get(User, session.user_id)


def revoke_session(db: Session, token: str) -> None:
    """Mark the session for this raw token revoked. Caller commits."""
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(token)))
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)


def revoke_all_sessions(db: Session, user_id: uuid.UUID) -> None:
    """Revoke every active session of the user. Caller commits."""
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_expire_days * 86400,
        domain=settings.cookie_domain,  # None -> host-only cookie
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        SESSION_COOKIE,
        domain=settings.cookie_domain,
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
        path="/",
    )
