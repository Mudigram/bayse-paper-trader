from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    user_id: int = Field(foreign_key="user.id")
    market_id: Optional[int] = Field(default=None, foreign_key="market.id")

    # Transaction type
    type: str  # "trade" | "settlement" | "refund" | "starting_balance"

    amount: float  # positive = credit, negative = debit
    balance_after: float

    description: str = Field(default="")

    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )