from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


class Market(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Where this market came from
    # "bayse" = real Bayse market | "virtual" = from Street Trends
    source: str = Field(default="virtual")

    # For real Bayse markets — store the Bayse market ID
    bayse_market_id: Optional[str] = Field(default=None)

    title: str
    description: str = Field(default="")
    category: str  # sports | politics | entertainment | finance

    # Resolution
    resolution_date: str
    resolution_criteria: str
    resolved: bool = Field(default=False)
    resolution: Optional[str] = Field(default=None)  # "yes" | "no"

    # Pricing — simple 50/50 to start, moves with trades
    yes_price: float = Field(default=0.5)   # 0.0 to 1.0
    no_price: float = Field(default=0.5)

    # Volume
    total_volume: float = Field(default=0.0)
    yes_volume: float = Field(default=0.0)
    no_volume: float = Field(default=0.0)

    # Funnel fields — from Street Trends
    confidence: float = Field(default=0.0)
    source_url: str = Field(default="")
    tags_json: str = Field(default="[]")

    # Status
    active: bool = Field(default=True)

    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )