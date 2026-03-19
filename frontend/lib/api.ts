import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:8000/api",
    headers: {
        "Content-Type": "application/json",
    },
});

// ================================================================
// Types
// ================================================================

export interface User {
    id: number;
    username: string;
    avatar: string;
    balance: number;
    total_trades: number;
    total_won: number;
    total_lost: number;
    session_token: string;
    created_at: string;
}

export interface Market {
    id: number;
    source: "bayse" | "virtual";
    bayse_market_id: string | null;
    title: string;
    description: string;
    category: string;
    resolution_date: string;
    resolution_criteria: string;
    resolved: boolean;
    resolution: string | null;
    yes_price: number;
    no_price: number;
    total_volume: number;
    yes_volume: number;
    no_volume: number;
    confidence: number;
    source_url: string;
    tags: string[];
    active: boolean;
    created_at: string;
}

export interface Position {
    id: number;
    side: "yes" | "no";
    amount: number;
    shares: number;
    price_at_purchase: number;
    current_price: number;
    current_value: number;
    unrealized_pnl: number;
    settled: boolean;
    pnl: number | null;
    created_at: string;
    market: {
        id: number;
        title: string;
        category: string;
        resolved: boolean;
        resolution: string | null;
        yes_price: number;
        no_price: number;
        resolution_date: string;
    };
}

export interface Portfolio {
    user: {
        id: number;
        username: string;
        avatar: string;
        balance: number;
        total_trades: number;
        total_won: number;
        total_lost: number;
    };
    summary: {
        portfolio_value: number;
        cash_balance: number;
        total_invested: number;
        total_current_value: number;
        unrealized_pnl: number;
        realized_pnl: number;
        total_pnl: number;
    };
    open_positions: Position[];
    recent_transactions: {
        id: number;
        type: string;
        amount: number;
        balance_after: number;
        description: string;
        created_at: string;
    }[];
}

export interface LeaderboardEntry {
    rank: number;
    user_id: number;
    username: string;
    avatar: string;
    portfolio_value: number;
    pnl: number;
    pnl_percent: number;
    total_trades: number;
}

// ================================================================
// Auth
// ================================================================

export const authApi = {
    checkUsername: async (username: string) => {
        const res = await api.get("/auth/check-username", {
            params: { username },
        });
        return res.data as {
            username: string;
            available: boolean;
            message: string;
        };
    },

    login: async (username: string, avatar: string = "🦁") => {
        const res = await api.post("/auth/login", { username, avatar });
        return res.data as User;
    },

    getMe: async (token: string) => {
        const res = await api.get("/auth/me", { params: { token } });
        return res.data as User;
    },
};

// ================================================================
// Markets
// ================================================================

export const marketsApi = {
    getAll: async (category?: string, source?: string) => {
        const params: Record<string, string> = {};
        if (category) params.category = category;
        if (source) params.source = source;
        const res = await api.get("/markets/", { params });
        return res.data as { total: number; results: Market[] };
    },

    getById: async (id: number) => {
        const res = await api.get(`/markets/${id}`);
        return res.data as Market;
    },

    syncBayse: async () => {
        const res = await api.post("/markets/sync/bayse");
        return res.data;
    },
};

// ================================================================
// Trading
// ================================================================

export const tradingApi = {
    placeTrade: async (
        token: string,
        market_id: number,
        side: "yes" | "no",
        amount: number
    ) => {
        const res = await api.post("/trading/trade", {
            token,
            market_id,
            side,
            amount,
        });
        return res.data;
    },

    getPositions: async (token: string) => {
        const res = await api.get("/trading/positions", { params: { token } });
        return res.data as { positions: Position[] };
    },
};

// ================================================================
// Portfolio
// ================================================================

export const portfolioApi = {
    get: async (token: string) => {
        const res = await api.get("/portfolio/", { params: { token } });
        return res.data as Portfolio;
    },

    getLeaderboard: async () => {
        const res = await api.get("/portfolio/leaderboard");
        return res.data as { leaderboard: LeaderboardEntry[] };
    },
};