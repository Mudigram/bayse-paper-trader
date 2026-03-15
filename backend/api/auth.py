import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from datetime import datetime, timezone
import secrets

from main import get_session
from models.user import User

router = APIRouter()

AVATARS = ["🦁", "🐯", "🦅", "🏆", "⚽", "🎵", "💰", "🌍", "🔥", "👑"]


class LoginRequest(BaseModel):
    username: str
    avatar: str = "🦁"


class UserResponse(BaseModel):
    id: int
    username: str
    avatar: str
    balance: float
    total_trades: int
    total_won: int
    total_lost: int
    session_token: str
    created_at: str


def get_user_by_token(
    token: str,
    session: Session,
) -> User:
    """Reusable auth check — call this in any route that needs auth."""
    user = session.exec(
        select(User).where(User.session_token == token)
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session token")
    return user


# ================================================================
# POST /api/auth/login
# Username-only login. Creates account if new, logs in if exists.
# ================================================================

@router.post("/login")
def login(
    body: LoginRequest,
    session: Session = Depends(get_session),
) -> UserResponse:
    username = body.username.strip().lower()

    if not username or len(username) < 3:
        raise HTTPException(
            status_code=400,
            detail="Username must be at least 3 characters"
        )

    if len(username) > 20:
        raise HTTPException(
            status_code=400,
            detail="Username must be 20 characters or less"
        )

    if body.avatar not in AVATARS:
        raise HTTPException(
            status_code=400,
            detail=f"Avatar must be one of: {AVATARS}"
        )

    # Check if user exists
    existing = session.exec(
        select(User).where(User.username == username)
    ).first()

    if existing:
        # User exists — log them in, refresh token
        existing.session_token = secrets.token_hex(32)
        existing.last_seen = datetime.now(timezone.utc).isoformat()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return build_response(existing)

    # New user — create account
    token = secrets.token_hex(32)
    user = User(
        username=username,
        avatar=body.avatar,
        balance=10000.0,
        session_token=token,
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    return build_response(user)


# ================================================================
# GET /api/auth/me
# Get current user from session token
# ================================================================

@router.get("/me")
def get_me(
    token: str,
    session: Session = Depends(get_session),
) -> UserResponse:
    user = get_user_by_token(token, session)
    user.last_seen = datetime.now(timezone.utc).isoformat()
    session.add(user)
    session.commit()
    session.refresh(user)
    return build_response(user)


# ================================================================
# GET /api/auth/check-username
# Check if a username is already taken
# ================================================================

@router.get("/check-username")
def check_username(
    username: str,
    session: Session = Depends(get_session),
):
    username = username.strip().lower()
    existing = session.exec(
        select(User).where(User.username == username)
    ).first()

    return {
        "username": username,
        "available": existing is None,
        "message": "Username is available" if existing is None else "Username already taken — you'll be logged in automatically",
    }


# ================================================================
# GET /api/auth/avatars
# Return available avatars
# ================================================================

@router.get("/avatars")
def get_avatars():
    return {"avatars": AVATARS}


# ================================================================
# Helper
# ================================================================

def build_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        avatar=user.avatar,
        balance=user.balance,
        total_trades=user.total_trades,
        total_won=user.total_won,
        total_lost=user.total_lost,
        session_token=user.session_token,
        created_at=user.created_at,
    )