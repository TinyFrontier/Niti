from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select

from app.ai.dependencies import AIProviderDep
from app.ai.provider import AIError
from app.auth.dependencies import CurrentUser, DbSession
from app.career_profiles import completeness, drafting
from app.career_profiles.models import CareerProfile
from app.career_profiles.schemas import (
    CareerProfileData,
    CareerProfileOut,
    CareerProfilePatch,
    CareerProfileUpdate,
    ProfileDraftIn,
    ProfileDraftOut,
)
from app.common.enums import CVExtractionStatus
from app.cv_versions.models import CVVersion
from app.events.names import CAREER_PROFILE_COMPLETED, CAREER_PROFILE_DRAFT_REQUESTED
from app.events.service import record_event
from app.users.models import User

router = APIRouter()


def _load(db: DbSession, user: User) -> CareerProfile | None:
    return db.execute(
        select(CareerProfile).where(CareerProfile.user_id == user.id)
    ).scalar_one_or_none()


def _get_or_create(db: DbSession, user: User) -> CareerProfile:
    profile = _load(db, user)
    if profile is None:
        profile = CareerProfile(user_id=user.id, profile_data={}, revision=0)
        db.add(profile)
        db.flush()
    return profile


def _validated(payload: dict) -> CareerProfileData:
    """A patch is a free-form dict, so its faults surface here rather than at the
    request boundary — they still have to reach the client as 422, not 500."""
    try:
        return CareerProfileData.model_validate(payload)
    except ValidationError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {"loc": list(fault["loc"]), "msg": fault["msg"]}
                for fault in error.errors(include_url=False)
            ],
        ) from error


def _as_out(profile: CareerProfile | None) -> CareerProfileOut:
    """An absent profile is rendered as an empty one, so clients have no special case."""
    data = CareerProfileData.model_validate(profile.profile_data if profile else {})
    return CareerProfileOut(
        data=data,
        revision=profile.revision if profile else 0,
        confirmed_at=profile.confirmed_at if profile else None,
        updated_at=profile.updated_at if profile else None,
        completeness=completeness.completeness(data),
        is_ready_for_matching=completeness.is_ready_for_matching(data),
        missing_for_matching=completeness.missing_for_matching(data),
    )


@router.get("", response_model=CareerProfileOut)
def get_career_profile(current_user: CurrentUser, db: DbSession) -> CareerProfileOut:
    return _as_out(_load(db, current_user))


@router.patch("", response_model=CareerProfileOut)
def patch_career_profile(
    payload: CareerProfilePatch, current_user: CurrentUser, db: DbSession
) -> CareerProfileOut:
    """Save one wizard step.

    Only the keys sent are replaced, and `revision` stays put: a draft in progress
    must not age an existing job match.
    """
    profile = _get_or_create(db, current_user)
    # validate the whole payload, not just the patch, so a step cannot leave the
    # stored profile in a shape the schema would reject later
    merged = _validated({**profile.profile_data, **payload.data})
    profile.profile_data = merged.model_dump(mode="json")
    db.commit()
    db.refresh(profile)
    return _as_out(profile)


@router.put("", response_model=CareerProfileOut)
def put_career_profile(
    payload: CareerProfileUpdate, current_user: CurrentUser, db: DbSession
) -> CareerProfileOut:
    profile = _get_or_create(db, current_user)
    updated = payload.data.model_dump(mode="json")
    # a confirmed profile that actually changed is a new revision — that is what
    # marks earlier job matches as stale
    if profile.confirmed_at is not None and updated != profile.profile_data:
        profile.revision += 1
    profile.profile_data = updated
    db.commit()
    db.refresh(profile)
    return _as_out(profile)


@router.post("/confirm", response_model=CareerProfileOut)
def confirm_career_profile(current_user: CurrentUser, db: DbSession) -> CareerProfileOut:
    profile = _get_or_create(db, current_user)
    data = CareerProfileData.model_validate(profile.profile_data)
    first_time = profile.confirmed_at is None
    profile.confirmed_at = datetime.now(UTC)
    if first_time:
        profile.revision = max(profile.revision, 1)
        record_event(
            db,
            CAREER_PROFILE_COMPLETED,
            user_id=current_user.id,
            properties={
                "completeness": completeness.completeness(data),
                "ready_for_matching": completeness.is_ready_for_matching(data),
            },
        )
    db.commit()
    db.refresh(profile)
    return _as_out(profile)


@router.post("/draft", response_model=ProfileDraftOut)
def draft_career_profile(
    payload: ProfileDraftIn,
    current_user: CurrentUser,
    db: DbSession,
    ai: AIProviderDep,
) -> ProfileDraftOut:
    """Propose a profile from a CV, a free-text description, or both.

    Nothing is stored: the user confirms the proposal through PATCH or PUT.
    """
    if current_user.ai_consent_at is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Sending documents to the AI provider needs your consent first",
        )
    free_text = (payload.free_text or "").strip() or None
    if payload.cv_version_id is None and free_text is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Provide a CV, a description of yourself, or both",
        )

    cv_text = _cv_text(db, current_user, payload) if payload.cv_version_id else None

    try:
        data, sources = drafting.draft(ai, cv_text=cv_text, free_text=free_text)
    except AIError as error:
        # 502: the failure is the provider's, and the user can retry or type it in
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=error.code) from error

    record_event(
        db,
        CAREER_PROFILE_DRAFT_REQUESTED,
        user_id=current_user.id,
        properties={"source": _source_label(cv_text, free_text), "fields": len(sources)},
    )
    db.commit()
    return ProfileDraftOut(data=data, sources=sources)


def _cv_text(db: DbSession, user: User, payload: ProfileDraftIn) -> str:
    cv = db.execute(
        select(CVVersion).where(
            CVVersion.id == payload.cv_version_id,
            CVVersion.user_id == user.id,
            CVVersion.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if cv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="CV version not found")
    if cv.extraction_status is not CVExtractionStatus.COMPLETED or not cv.extracted_text:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"No text could be read from this CV ({cv.extraction_status.value})",
        )
    return cv.extracted_text


def _source_label(cv_text: str | None, free_text: str | None) -> str:
    if cv_text and free_text:
        return "both"
    return "cv" if cv_text else "text"
