import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from datetime import datetime, timezone

from main import get_session
from models.user import User
from models.market import Market
from models.position import Position
from models.transaction import Transaction
from api.auth import get_user_by_token

router = APIRouter()

MINIMUM_TRADE = 100.0   # minimum ₦100 per trade
MAXIMUM_TRADE = 5000.0  # maximum ₦5000 per trade


class TradeRequest(BaseModel):
    token: str
    market_id: int
    side: str       # "yes" | "no"
    amount: float   # amount in Naira


# ================================================================
# POST /api/trading/trade
# Place a trade on a market
# ================================================================

@router.post("/trade")
def place_trade(
    body: TradeRequest,
    session: Session = Depends(get_session),
):
    # Auth
    user = get_user_by_token(body.token, session)

    # Validate side
    if body.side not in ("yes", "no"):
        raise HTTPException(status_code=400, detail="Side must be 'yes' or 'no'")

    # Validate amount
    if body.amount < MINIMUM_TRADE:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum trade is ₦{MINIMUM_TRADE:,.0f}"
        )
    if body.amount > MAXIMUM_TRADE:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum trade is ₦{MAXIMUM_TRADE:,.0f}"
        )

    # Get market
    market = session.get(Market, body.market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if not market.active:
        raise HTTPException(status_code=400, detail="Market is not active")
    if market.resolved:
        raise HTTPException(status_code=400, detail="Market is already resolved")

    # Check balance
    if user.balance < body.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. You have ₦{user.balance:,.0f}"
        )

    # Get current price for the side
    price = market.yes_price if body.side == "yes" else market.no_price
    shares = body.amount / price

    # Create position
    position = Position(
        user_id=user.id,
        market_id=market.id,
        side=body.side,
        amount=body.amount,
        price_at_purchase=price,
        shares=shares,
    )
    session.add(position)

    # Deduct balance
    user.balance -= body.amount
    user.total_trades += 1
    user.last_seen = datetime.now(timezone.utc).isoformat()
    session.add(user)

    # Record transaction
    transaction = Transaction(
        user_id=user.id,
        market_id=market.id,
        type="trade",
        amount=-body.amount,
        balance_after=user.balance,
        description=f"Bought {body.side.upper()} on: {market.title[:60]}",
    )
    session.add(transaction)

    # Update market volumes and price
    market.total_volume += body.amount
    if body.side == "yes":
        market.yes_volume += body.amount
    else:
        market.no_volume += body.amount

    # Recalculate prices based on volume
    update_market_prices(market)
    session.add(market)

    session.commit()
    session.refresh(position)

    return {
        "message": "Trade placed successfully",
        "position": {
            "id": position.id,
            "side": position.side,
            "amount": position.amount,
            "shares": round(position.shares, 4),
            "price_at_purchase": position.price_at_purchase,
        },
        "balance_after": round(user.balance, 2),
        "market": {
            "yes_price": round(market.yes_price, 3),
            "no_price": round(market.no_price, 3),
            "total_volume": round(market.total_volume, 2),
        }
    }


# ================================================================
# GET /api/trading/positions
# Get all positions for a user
# ================================================================

@router.get("/positions")
def get_positions(
    token: str,
    session: Session = Depends(get_session),
):
    user = get_user_by_token(token, session)

    positions = session.exec(
        select(Position).where(Position.user_id == user.id)
    ).all()

    result = []
    for p in positions:
        market = session.get(Market, p.market_id)
        result.append({
            "id": p.id,
            "side": p.side,
            "amount": p.amount,
            "shares": round(p.shares, 4),
            "price_at_purchase": p.price_at_purchase,
            "settled": p.settled,
            "pnl": p.pnl,
            "created_at": p.created_at,
            "market": {
                "id": market.id if market else None,
                "title": market.title if market else "Unknown",
                "category": market.category if market else "",
                "resolved": market.resolved if market else False,
                "resolution": market.resolution if market else None,
                "yes_price": market.yes_price if market else 0.5,
                "no_price": market.no_price if market else 0.5,
                "resolution_date": market.resolution_date if market else "",
            }
        })

    return {"positions": result}


# ================================================================
# Price update logic
# Simple AMM-style price update based on volume
# ================================================================

def update_market_prices(market: Market):
    """
    Update YES/NO prices based on relative volume.
    More YES bets → YES price goes up, NO price goes down.
    Prices always sum to 1.0
    """
    total = market.yes_volume + market.no_volume

    if total == 0:
        market.yes_price = 0.5
        market.no_price = 0.5
        return

    # Weighted average with starting prior of 50/50
    prior_weight = 500.0  # dampens early price swings
    yes_weighted = market.yes_volume + prior_weight
    no_weighted = market.no_volume + prior_weight

    market.yes_price = round(yes_weighted / (yes_weighted + no_weighted), 3)
    market.no_price = round(1.0 - market.yes_price, 3)