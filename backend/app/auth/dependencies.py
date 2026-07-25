from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.sessions import SESSION_COOKIE, get_session_user
from app.core.database import get_db
from app.users.models import User

_bearer = HTTPBearer(auto_error=False)


def extract_raw_token(request: Request) -> str | None:
    """Raw session token from the cookie, falling back to the Bearer header."""
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        return token
    authorization = request.headers.get("Authorization")
    scheme, _, value = (authorization or "").partition(" ")
    if scheme.lower() == "bearer" and value.strip():
        return value.strip()
    return None


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token and credentials is not None:
        token = credentials.credentials
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = get_session_user(db, token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
