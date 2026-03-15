import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import httpx
import hmac
import hashlib
import base64
import json
import time
from datetime import datetime, timezone
from sqlmodel import Session, select

from main import engine
from models.market import Market

BAYSE_BASE_URL = os.getenv("BAYSE_BASE_URL", "https://relay.bayse.markets")
BAYSE_PUBLIC_KEY = os.getenv("BAYSE_PUBLIC_KEY", "")
BAYSE_SECRET_KEY = os.getenv("BAYSE_SECRET_KEY", "")


# ================================================================
# Auth helpers — same HMAC pattern as bayse-js SDK
# ================================================================

def hash_body(body: dict | None) -> str:
    if not body:
        return hashlib.sha256(b"").hexdigest()
    body_bytes = json.dumps(body, separators=(",", ":")).encode()
    return hashlib.sha256(body_bytes).hexdigest()


def sign_request(method: str, path: str, body: dict | None = None) -> dict:
    timestamp = str(int(time.time()))
    body_hash = hash_body(body)
    payload = f"{timestamp}.{method.upper()}.{path}.{body_hash}"
    signature = base64.b64encode(
        hmac.new(
            BAYSE_SECRET_KEY.encode(),
            payload.encode(),
            hashlib.sha256
        ).digest()
    ).decode()

    return {
        "X-Public-Key": BAYSE_PUBLIC_KEY,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
        "Content-Type": "application/json",
    }


def public_get(path: str) -> dict:
    """Unauthenticated GET — for public endpoints."""
    with httpx.Client() as client:
        response = client.get(
            f"{BAYSE_BASE_URL}{path}",
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()


# ================================================================
# Sync Bayse markets into Paper Trader DB
# ================================================================

def sync_bayse_markets(verbose: bool = True) -> dict:
    """
    Pull active events from Bayse API and save to Paper Trader DB.
    """
    if not BAYSE_PUBLIC_KEY:
        print("⚠️  BAYSE_PUBLIC_KEY not set — skipping Bayse sync")
        return {"synced": 0, "skipped": 0, "errors": 0}

    synced = 0
    skipped = 0
    errors = 0

    try:
        events_response = public_get("/v1/pm/events?page=1&size=50")
        events = events_response.get("events", [])

        if verbose:
            print(f"📡 Found {len(events)} Bayse events")

        with Session(engine) as session:
            for event in events:
                try:
                    event_id = event.get("id", "")
                    event_title = event.get("title", "")
                    event_category = event.get("category", "other")
                    event_status = event.get("status", "")

                    # Skip closed events
                    if event_status != "open":
                        skipped += 1
                        continue

                    # Resolution date — try resolutionDate first, fall back to closingDate
                    resolution_date = (
                        event.get("resolutionDate", "") or
                        event.get("closingDate", "")
                    )
                    # Trim to date only if datetime string
                    if "T" in resolution_date:
                        resolution_date = resolution_date[:10]

                    resolution_source = event.get("resolutionSource", "")
                    description = event.get("description", "")
                    markets = event.get("markets", [])

                    for market in markets:
                        bayse_market_id = market.get("id", "")
                        market_status = market.get("status", "")

                        # Skip closed markets
                        if market_status != "open":
                            skipped += 1
                            continue

                        # Skip if already synced
                        existing = session.exec(
                            select(Market).where(
                                Market.bayse_market_id == bayse_market_id
                            )
                        ).first()

                        if existing:
                            skipped += 1
                            continue

                        # Prices — Bayse uses yesBuyPrice / noBuyPrice
                        yes_price = market.get("yesBuyPrice", 0.5)
                        no_price = market.get("noBuyPrice", 0.5)

                        # Resolution criteria from market rules
                        rules = market.get("rules", "")

                        # Market title — combine event title + market title
                        market_title = event_title
                        sub_title = market.get("title", "")
                        if sub_title and sub_title.lower() not in ("yes", "no", "up", "down"):
                            market_title = f"{event_title} — {sub_title}"

                        new_market = Market(
                            source="bayse",
                            bayse_market_id=bayse_market_id,
                            title=market_title,
                            description=description,
                            category=map_category(event_category),
                            resolution_date=resolution_date or "2026-12-31",
                            resolution_criteria=rules,
                            yes_price=yes_price,
                            no_price=no_price,
                            total_volume=event.get("totalVolume", 0.0),
                            confidence=1.0,
                            source_url=f"https://bayse.markets/events/{event.get('slug', event_id)}",
                            tags_json=json.dumps(
                                [map_category(event_category), "bayse"] +
                                event.get("hashtags", [])
                            ),
                        )

                        session.add(new_market)
                        synced += 1

                        if verbose:
                            print(f"   ✅ Synced: {market_title[:60]}")

                except Exception as e:
                    errors += 1
                    if verbose:
                        print(f"   ❌ Error syncing market: {e}")

            session.commit()

    except Exception as e:
        if verbose:
            print(f"❌ Bayse sync failed: {e}")
        errors += 1

    return {"synced": synced, "skipped": skipped, "errors": errors}


def map_category(bayse_category: str) -> str:
    """Map Bayse category names to our category names."""
    mapping = {
        "football": "sports",
        "soccer": "sports",
        "basketball": "sports",
        "sport": "sports",
        "sports": "sports",
        "politics": "politics",
        "government": "politics",
        "economy": "finance",
        "finance": "finance",
        "crypto": "finance",
        "entertainment": "entertainment",
        "music": "entertainment",
        "celebrity": "entertainment",
    }
    return mapping.get(bayse_category.lower(), "other")


if __name__ == "__main__":
    print("\n🔄 Syncing Bayse markets...\n")
    result = sync_bayse_markets(verbose=True)
    print(f"\n📊 Sync complete — synced: {result['synced']}, skipped: {result['skipped']}, errors: {result['errors']}")