from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./papertrader.db")
engine = create_engine(DATABASE_URL, echo=False)


def create_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


app = FastAPI(title="Bayse Paper Trader API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.auth import router as auth_router
from api.markets import router as markets_router
from api.trading import router as trading_router
from api.portfolio import router as portfolio_router

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(markets_router, prefix="/api/markets", tags=["markets"])
app.include_router(trading_router, prefix="/api/trading", tags=["trading"])
app.include_router(portfolio_router, prefix="/api/portfolio", tags=["portfolio"])

create_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)