from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    username: str = Field(unique=True, index=True)
    avatar: str = Field(default="🦁")
    
    # Virtual balance in Naira
    balance: float = Field(default=1000000.0)
    
    # Session token for staying logged in
    session_token: str = Field(default="")
    
    # Stats
    total_trades: int = Field(default=0)
    total_won: int = Field(default=0)
    total_lost: int = Field(default=0)
    
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    last_seen: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )