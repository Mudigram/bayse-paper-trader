import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone
from sqlmodel import Session, select

from main import engine
from models.market import Market
from models.position import Position
from models.user import User
from models.transaction import Transaction


# ================================================================
# Market Resolver
#
# Checks all active markets for expired resolution dates.
# For markets that need manual resolution — flags them.
# For markets that are already marked resolved — settles positions.
# ================================================================

def resolve_expired_markets(verbose: bool = True) -> dict:
    """
    Check for markets past their resolution date.
    Flags them as needing resolution.
    Does NOT auto-resolve — a human still decides YES or NO.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    flagged = 0

    with Session(engine) as session:
        markets = session.exec(select(Market)).all()

        for market in markets:
            if not market.active:
                continue
            if market.resolved:
                continue
            if market.resolution_date <= today:
                flagged += 1
                if verbose:
                    print(f"⏰ Needs resolution: [{market.category}] {market.title[:60]}")
                    print(f"   Resolution date: {market.resolution_date}")
                    print(f"   Total volume: ₦{market.total_volume:,.0f}")
                    print()

    return {"flagged": flagged}


def settle_market(
    market_id: int,
    resolution: str,  # "yes" | "no"
    verbose: bool = True,
) -> dict:
    """
    Resolve a market and settle all positions.

    resolution = "yes" → YES bettors win, NO bettors lose
    resolution = "no"  → NO bettors win, YES bettors lose

    Payout = shares × ₦1.0 (each winning share pays out ₦1)
    """
    if resolution not in ("yes", "no"):
        raise ValueError("Resolution must be 'yes' or 'no'")

    settled_count = 0
    total_paid_out = 0.0

    with Session(engine) as session:
        market = session.get(Market, market_id)
        if not market:
            raise ValueError(f"Market {market_id} not found")

        if market.resolved:
            raise ValueError(f"Market {market_id} is already resolved")

        # Mark market as resolved
        market.resolved = True
        market.resolution = resolution
        market.active = False
        session.add(market)

        if verbose:
            print(f"\n✅ Resolving: {market.title}")
            print(f"   Resolution: {resolution.upper()}")

        # Get all unsettled positions for this market
        positions = session.exec(
            select(Position).where(
                Position.market_id == market_id,
                Position.settled == False,
            )
        ).all()

        for position in positions:
            user = session.get(User, position.user_id)
            if not user:
                continue

            # Did they win?
            won = position.side == resolution

            if won:
                # Payout = shares × 1.0 (full value)
                payout = position.shares * 1.0
                pnl = payout - position.amount
                user.balance += payout
                user.total_won += 1
                total_paid_out += payout

                transaction = Transaction(
                    user_id=user.id,
                    market_id=market_id,
                    type="settlement",
                    amount=payout,
                    balance_after=user.balance,
                    description=f"Won: {market.title[:50]} — {resolution.upper()} resolved",
                )
            else:
                # Lost — already deducted when trade was placed
                pnl = -position.amount
                user.total_lost += 1

                transaction = Transaction(
                    user_id=user.id,
                    market_id=market_id,
                    type="settlement",
                    amount=0,
                    balance_after=user.balance,
                    description=f"Lost: {market.title[:50]} — {resolution.upper()} resolved",
                )

            # Settle position
            position.settled = True
            position.pnl = round(pnl, 2)
            position.settled_at = datetime.now(timezone.utc).isoformat()

            session.add(position)
            session.add(user)
            session.add(transaction)
            settled_count += 1

            if verbose:
                outcome = "WON" if won else "LOST"
                print(f"   {outcome} @{user.username}: ₦{abs(pnl):,.0f}")

        session.commit()

    return {
        "market_id": market_id,
        "resolution": resolution,
        "positions_settled": settled_count,
        "total_paid_out": round(total_paid_out, 2),
    }


# ================================================================
# Add resolve endpoint to markets API
# ================================================================

if __name__ == "__main__":
    print("\n🔍 Checking for expired markets...\n")
    result = resolve_expired_markets(verbose=True)

    if result["flagged"] == 0:
        print("✅ No markets need resolution right now")
    else:
        print(f"\n⚠️  {result['flagged']} market(s) need manual resolution")
        print("Run settle_market(market_id, 'yes'/'no') to resolve them")