from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


class Position(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="user.id")
    market_id: int = Field(foreign_key="market.id")

    # What they bought
    side: str  # "yes" | "no"
    amount: float  # amount in Naira wagered
    price_at_purchase: float  # price when they bought (0.0 to 1.0)
    shares: float  # amount / price_at_purchase

    # Resolution outcome
    settled: bool = Field(default=False)
    pnl: Optional[float] = Field(default=None)  # profit or loss in Naira

    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    settled_at: Optional[str] = Field(default=None)