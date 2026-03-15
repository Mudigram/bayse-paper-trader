import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from sqlalchemy import desc
from typing import Optional
import json

from main import get_session
from models.market import Market
from services.resolver import resolve_expired_markets, settle_market
from services.bayse_sync import sync_bayse_markets
from pydantic import BaseModel

router = APIRouter()


# ================================================================
# GET /api/markets
# List all active markets with optional filters
# ================================================================

@router.get("/")
def get_markets(
    category: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    session: Session = Depends(get_session),
):
    results = session.exec(select(Market)).all()

    # Filter
    if category:
        results = [m for m in results if m.category == category]
    if source:
        results = [m for m in results if m.source == source]
    if resolved is not None:
        results = [m for m in results if m.resolved == resolved]

    # Only active markets by default
    results = [m for m in results if m.active]

    # Sort by created_at descending
    results = sorted(results, key=lambda m: m.created_at, reverse=True)

    total = len(results)
    paginated = results[offset: offset + limit]

    return {
        "total": total,
        "results": [market_to_dict(m) for m in paginated],
    }


# ================================================================
# GET /api/markets/{id}
# Get a single market
# ================================================================

@router.get("/{market_id}")
def get_market(
    market_id: int,
    session: Session = Depends(get_session),
):
    market = session.get(Market, market_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return market_to_dict(market)


# ================================================================
# POST /api/markets/seed
# Seed some sample markets for testing
# ================================================================

@router.post("/seed")
def seed_markets(session: Session = Depends(get_session)):
    sample_markets = [
        {
            "title": "Will Super Eagles qualify for AFCON 2027?",
            "description": "Nigeria's national football team qualification campaign",
            "category": "sports",
            "resolution_date": "2026-06-30",
            "resolution_criteria": "Resolves YES if Nigeria qualifies. Source: CAF official website.",
            "confidence": 0.85,
            "tags_json": '["sports", "super-eagles", "afcon"]',
            "source": "virtual",
        },
        {
            "title": "Will CBN cut interest rates before June 2026?",
            "description": "Central Bank of Nigeria MPC decision",
            "category": "finance",
            "resolution_date": "2026-06-01",
            "resolution_criteria": "Resolves YES if CBN MPC announces a rate cut. Source: cbn.gov.ng",
            "confidence": 0.72,
            "tags_json": '["finance", "cbn", "interest-rate"]',
            "source": "virtual",
        },
        {
            "title": "Will Burna Boy win a Grammy in 2026?",
            "description": "Nigerian Afrobeats artist Grammy nomination",
            "category": "entertainment",
            "resolution_date": "2026-05-01",
            "resolution_criteria": "Resolves YES if Burna Boy wins any Grammy award. Source: grammy.com",
            "confidence": 0.68,
            "tags_json": '["entertainment", "burna-boy", "grammy"]',
            "source": "virtual",
        },
        {
            "title": "Will Naira strengthen to below ₦1500/$ by April 2026?",
            "description": "USD/NGN exchange rate prediction",
            "category": "finance",
            "resolution_date": "2026-04-30",
            "resolution_criteria": "Resolves YES if CBN official rate goes below ₦1500 per dollar. Source: cbn.gov.ng",
            "confidence": 0.61,
            "tags_json": '["finance", "naira", "forex"]',
            "source": "virtual",
        },
        {
            "title": "Will Tinubu's approval rating rise above 50% in Q2 2026?",
            "description": "Presidential approval rating poll",
            "category": "politics",
            "resolution_date": "2026-06-30",
            "resolution_criteria": "Resolves YES if a major Nigerian poll shows approval above 50%. Source: NOIPolls or Afrobarometer.",
            "confidence": 0.55,
            "tags_json": '["politics", "tinubu"]',
            "source": "virtual",
        },
    ]

    saved = 0
    for m in sample_markets:
        market = Market(**m)
        session.add(market)
        saved += 1

    session.commit()
    return {"message": f"Seeded {saved} markets"}


# ================================================================
# Helper
# ================================================================

def market_to_dict(m: Market) -> dict:
    try:
        tags = json.loads(m.tags_json)
    except Exception:
        tags = []

    return {
        "id": m.id,
        "source": m.source,
        "bayse_market_id": m.bayse_market_id,
        "title": m.title,
        "description": m.description,
        "category": m.category,
        "resolution_date": m.resolution_date,
        "resolution_criteria": m.resolution_criteria,
        "resolved": m.resolved,
        "resolution": m.resolution,
        "yes_price": m.yes_price,
        "no_price": m.no_price,
        "total_volume": m.total_volume,
        "yes_volume": m.yes_volume,
        "no_volume": m.no_volume,
        "confidence": m.confidence,
        "source_url": m.source_url,
        "tags": tags,
        "active": m.active,
        "created_at": m.created_at,
    }

class ResolveRequest(BaseModel):
    resolution: str  # "yes" | "no"

@router.post("/{market_id}/resolve")
def resolve_market(
    market_id: int,
    body: ResolveRequest,
    session: Session = Depends(get_session),
):
    try:
        result = settle_market(market_id, body.resolution, verbose=False)
        return {
            "message": f"Market resolved as {body.resolution.upper()}",
            "result": result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/admin/expired")
def get_expired_markets():
    result = resolve_expired_markets(verbose=False)
    return result

@router.post("/sync/bayse")
def sync_from_bayse():
    result = sync_bayse_markets(verbose=False)
    return {
        "message": "Bayse sync complete",
        "result": result,
    }