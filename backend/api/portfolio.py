import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from main import get_session
from models.user import User
from models.position import Position
from models.transaction import Transaction
from models.market import Market
from api.auth import get_user_by_token

router = APIRouter()


# ================================================================
# GET /api/portfolio
# Full portfolio summary for a user
# ================================================================

@router.get("/")
def get_portfolio(
    token: str,
    session: Session = Depends(get_session),
):
    user = get_user_by_token(token, session)

    # Get all positions
    positions = session.exec(
        select(Position).where(Position.user_id == user.id)
    ).all()

    # Calculate unrealized P&L on open positions
    open_positions = []
    total_invested = 0.0
    total_current_value = 0.0

    for p in positions:
        if p.settled:
            continue

        market = session.get(Market, p.market_id)
        if not market:
            continue

        current_price = market.yes_price if p.side == "yes" else market.no_price
        current_value = p.shares * current_price
        unrealized_pnl = current_value - p.amount

        total_invested += p.amount
        total_current_value += current_value

        open_positions.append({
            "id": p.id,
            "side": p.side,
            "amount": p.amount,
            "shares": round(p.shares, 4),
            "price_at_purchase": p.price_at_purchase,
            "current_price": current_price,
            "current_value": round(current_value, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "created_at": p.created_at,
            "market": {
                "id": market.id,
                "title": market.title,
                "category": market.category,
                "resolution_date": market.resolution_date,
                "yes_price": market.yes_price,
                "no_price": market.no_price,
            }
        })

    # Get settled positions
    settled_positions = [p for p in positions if p.settled]
    total_realized_pnl = sum(p.pnl or 0 for p in settled_positions)

    # Get recent transactions
    transactions = session.exec(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.id)
    ).all()

    recent_transactions = sorted(
        transactions,
        key=lambda t: t.created_at,
        reverse=True
    )[:10]

    # Portfolio value = cash balance + current value of open positions
    portfolio_value = user.balance + total_current_value

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "avatar": user.avatar,
            "balance": round(user.balance, 2),
            "total_trades": user.total_trades,
            "total_won": user.total_won,
            "total_lost": user.total_lost,
        },
        "summary": {
            "portfolio_value": round(portfolio_value, 2),
            "cash_balance": round(user.balance, 2),
            "total_invested": round(total_invested, 2),
            "total_current_value": round(total_current_value, 2),
            "unrealized_pnl": round(total_current_value - total_invested, 2),
            "realized_pnl": round(total_realized_pnl, 2),
            "total_pnl": round(
                (total_current_value - total_invested) + total_realized_pnl, 2
            ),
        },
        "open_positions": open_positions,
        "recent_transactions": [
            {
                "id": t.id,
                "type": t.type,
                "amount": t.amount,
                "balance_after": t.balance_after,
                "description": t.description,
                "created_at": t.created_at,
            }
            for t in recent_transactions
        ],
    }


# ================================================================
# GET /api/portfolio/leaderboard
# Top traders by portfolio value
# ================================================================

@router.get("/leaderboard")
def get_leaderboard(session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()

    leaderboard = []
    for user in users:
        # Get open positions value
        positions = session.exec(
            select(Position).where(
                Position.user_id == user.id,
                Position.settled == False
            )
        ).all()

        open_value = 0.0
        for p in positions:
            market = session.get(Market, p.market_id)
            if market:
                current_price = market.yes_price if p.side == "yes" else market.no_price
                open_value += p.shares * current_price

        portfolio_value = user.balance + open_value
        starting_balance = 1000000.0
        pnl = portfolio_value - starting_balance
        pnl_percent = (pnl / starting_balance) * 100

        leaderboard.append({
            "rank": 0,
            "user_id": user.id,
            "username": user.username,
            "avatar": user.avatar,
            "portfolio_value": round(portfolio_value, 2),
            "pnl": round(pnl, 2),
            "pnl_percent": round(pnl_percent, 2),
            "total_trades": user.total_trades,
        })

    # Sort by portfolio value
    leaderboard.sort(key=lambda x: x["portfolio_value"], reverse=True)

    # Assign ranks
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1

    return {"leaderboard": leaderboard}