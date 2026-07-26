import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.auth.dependencies import CurrentUser, DbSession, extract_raw_token
from app.auth.google import GoogleOAuthClient, GoogleOAuthError
from app.auth.models import AuthSession, PasswordResetToken, UserIdentity
from app.auth.schemas import (
    LoginIn,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    RegisterIn,
    SessionOut,
    TokenOut,
    UserOut,
    UserUpdate,
)
from app.auth.sessions import (
    clear_session_cookie,
    create_session,
    revoke_all_sessions,
    revoke_session,
    set_session_cookie,
)
from app.common.enums import UserRole
from app.core.config import get_settings
from app.core.security import generate_token, hash_password, hash_token, verify_password
from app.events.names import (
    CAREER_PROFILE_SKIPPED,
    ONBOARDING_COMPLETED,
    USER_LOGGED_IN,
    USER_REGISTERED,
)
from app.events.service import record_event
from app.users.models import User

logger = logging.getLogger("app.auth")

router = APIRouter()

OAUTH_STATE_COOKIE = "niti_oauth_state"
RESET_TOKEN_TTL = timedelta(hours=1)

google_client = GoogleOAuthClient()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: DbSession) -> User:
    email = data.email.lower()
    exists = db.scalar(select(User).where(User.email == email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=email, password_hash=hash_password(data.password), full_name=data.full_name)
    db.add(user)
    db.flush()  # assign user.id before recording the event
    record_event(db, USER_REGISTERED, user_id=user.id, properties={"method": "password"})
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, request: Request, response: Response, db: DbSession) -> TokenOut:
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.password_hash is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google sign-in. Use Continue with Google.",
        )
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_session(db, user, request)
    record_event(db, USER_LOGGED_IN, user_id=user.id, properties={"method": "password"})
    db.commit()
    set_session_cookie(response, token)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request, response: Response, current_user: CurrentUser, db: DbSession
) -> None:
    token = extract_raw_token(request)
    if token is not None:
        revoke_session(db, token)
        db.commit()
    clear_session_cookie(response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(response: Response, current_user: CurrentUser, db: DbSession) -> None:
    revoke_all_sessions(db, current_user.id)
    db.commit()
    clear_session_cookie(response)


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    request: Request, current_user: CurrentUser, db: DbSession
) -> list[SessionOut]:
    raw = extract_raw_token(request)
    current_hash = hash_token(raw) if raw else None
    now = datetime.now(UTC)
    sessions = db.scalars(
        select(AuthSession)
        .where(
            AuthSession.user_id == current_user.id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        .order_by(AuthSession.created_at.desc())
    ).all()
    return [
        SessionOut(
            id=s.id,
            created_at=s.created_at,
            last_used_at=s.last_used_at,
            user_agent=s.user_agent,
            current=s.token_hash == current_hash,
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session_by_id(
    session_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    session = db.get(AuthSession, session_id)
    if session is None or session.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)
        db.commit()


@router.get("/google/authorize")
def google_authorize() -> RedirectResponse:
    if not google_client.configured:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured"
        )
    settings = get_settings()
    state = secrets.token_urlsafe(16)
    response = RedirectResponse(google_client.authorize_url(state))
    response.set_cookie(
        OAUTH_STATE_COOKIE,
        state,
        max_age=600,
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return response


@router.get("/google/callback")
def google_callback(
    request: Request,
    db: DbSession,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    settings = get_settings()

    def redirect_error(reason: str) -> RedirectResponse:
        response = RedirectResponse(f"{settings.frontend_url}/login?error={reason}")
        response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
        return response

    if error:  # user cancelled on Google's consent screen
        return redirect_error("oauth_cancelled")
    expected_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not state or not expected_state or not secrets.compare_digest(state, expected_state):
        return redirect_error("oauth_failed")
    if not code:
        return redirect_error("oauth_failed")
    try:
        google_user = google_client.exchange_code(code)
    except GoogleOAuthError:
        logger.warning("Google OAuth code exchange failed", exc_info=True)
        return redirect_error("oauth_failed")
    if not google_user.email_verified:
        return redirect_error("oauth_email_unverified")

    identity = db.scalar(
        select(UserIdentity).where(
            UserIdentity.provider == "google",
            UserIdentity.provider_subject == google_user.sub,
        )
    )
    if identity is not None:
        user = db.get(User, identity.user_id)
        if user is None:
            return redirect_error("oauth_failed")
    else:
        email = google_user.email.lower()
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, password_hash=None, full_name=google_user.name)
            db.add(user)
            db.flush()
            record_event(db, USER_REGISTERED, user_id=user.id, properties={"method": "google"})
        # existing user by email: account linking only — no registration event
        db.add(
            UserIdentity(
                user_id=user.id,
                provider="google",
                provider_subject=google_user.sub,
                email_at_link=email,
            )
        )
    record_event(db, USER_LOGGED_IN, user_id=user.id, properties={"method": "google"})
    token = create_session(db, user, request)
    db.commit()

    response = RedirectResponse(f"{settings.frontend_url}/")
    set_session_cookie(response, token)
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
    return response


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def password_reset_request(data: PasswordResetRequestIn, db: DbSession) -> dict:
    settings = get_settings()
    body: dict = {"detail": "If the account exists, a reset link was created"}
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    # google-only accounts (no password) are skipped: nothing to reset
    if user is not None and user.password_hash is not None:
        raw = generate_token()
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(raw),
                expires_at=datetime.now(UTC) + RESET_TOKEN_TTL,
            )
        )
        db.commit()
        reset_url = f"{settings.frontend_url}/reset-password?token={raw}"
        logger.info("Password reset link for %s: %s", user.email, reset_url)
        if settings.debug:
            body["reset_url"] = reset_url
    return body


@router.post("/password-reset/confirm")
def password_reset_confirm(data: PasswordResetConfirmIn, db: DbSession) -> dict:
    reset_token = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(data.token))
    )
    now = datetime.now(UTC)
    if reset_token is None or reset_token.used_at is not None or reset_token.expires_at <= now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
    user = db.get(User, reset_token.user_id)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
    user.password_hash = hash_password(data.new_password)
    reset_token.used_at = now
    revoke_all_sessions(db, user.id)
    db.commit()
    return {"detail": "Password updated"}


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser) -> User:
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdate, current_user: CurrentUser, db: DbSession) -> User:
    fields = data.model_dump(exclude_unset=True)
    grant_consent = fields.pop("ai_consent", None)
    for key, value in fields.items():
        setattr(current_user, key, value)
    if grant_consent and current_user.ai_consent_at is None:
        current_user.ai_consent_at = datetime.now(UTC)

    # A recruiter has no career profile step, so picking the role is the whole of
    # their onboarding. Job seekers finish it in /career-profile.
    if current_user.role is UserRole.RECRUITER:
        _finish_onboarding(db, current_user, skipped_at_step=None)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/onboarding/complete", response_model=UserOut)
def complete_onboarding(
    current_user: CurrentUser, db: DbSession, skipped_at_step: int | None = None
) -> User:
    """Let the user into the app.

    Called when the profile is confirmed and when the user skips it — a skipped
    profile is a normal state, not a blocked one.
    """
    _finish_onboarding(db, current_user, skipped_at_step=skipped_at_step)
    db.commit()
    db.refresh(current_user)
    return current_user


def _finish_onboarding(db: DbSession, user: User, *, skipped_at_step: int | None) -> None:
    """Idempotent: the event fires once, on the transition."""
    if user.onboarding_completed_at is not None:
        return
    user.onboarding_completed_at = datetime.now(UTC)
    record_event(
        db,
        ONBOARDING_COMPLETED,
        user_id=user.id,
        properties={"role": user.role.value if user.role else None},
    )
    if skipped_at_step is not None:
        record_event(
            db,
            CAREER_PROFILE_SKIPPED,
            user_id=user.id,
            properties={"step": skipped_at_step},
        )
