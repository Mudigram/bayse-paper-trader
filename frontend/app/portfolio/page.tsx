"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { portfolioApi, Portfolio } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";
import BottomNav from "@/components/ui/BottomNav";

const CATEGORY_COLORS: Record<string, string> = {
    sports: "text-blue-400",
    politics: "text-red-400",
    entertainment: "text-purple-400",
    finance: "text-yellow-400",
    crypto: "text-orange-400",
    other: "text-gray-400",
};

export default function PortfolioPage() {
    const router = useRouter();
    const { user, token, loading, logout } = useAuth();
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [fetching, setFetching] = useState(true);
    const [activeTab, setActiveTab] = useState<"open" | "history">("open");

    useEffect(() => {
        if (!loading && !user) router.replace("/");
    }, [user, loading, router]);

    const fetchPortfolio = useCallback(async () => {
        if (!token) return;
        setFetching(true);
        try {
            const data = await portfolioApi.get(token);
            setPortfolio(data);
        } catch (err) {
            console.error(err);
        } finally {
            setFetching(false);
        }
    }, [token]);

    useEffect(() => {
        fetchPortfolio();
    }, [fetchPortfolio]);

    const formatNaira = (amount: number) => {
        if (Math.abs(amount) >= 1000000)
            return `₦${(amount / 1000000).toFixed(2)}M`;
        if (Math.abs(amount) >= 1000) return `₦${(amount / 1000).toFixed(1)}k`;
        return `₦${Math.round(amount).toLocaleString()}`;
    };

    const formatPnl = (amount: number) => {
        const prefix = amount >= 0 ? "+" : "";
        return `${prefix}${formatNaira(amount)}`;
    };

    const startingBalance = 1000000;
    const portfolioValue = portfolio?.summary.portfolio_value ?? startingBalance;
    const totalPnl = portfolioValue - startingBalance;
    const pnlPercent = ((totalPnl / startingBalance) * 100).toFixed(2);
    const isPositive = totalPnl >= 0;

    if (loading || fetching) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 pb-24">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <span className="text-white font-bold text-lg">Portfolio</span>
                    <button
                        onClick={() => {
                            logout();
                            router.replace("/");
                        }}
                        className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
                {/* User card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center gap-4 mb-5">
                        {user && (
                            <UserAvatar username={user.username} size={56} showBlink />
                        )}
                        <div>
                            <p className="text-white font-bold text-lg">@{user?.username}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-gray-500 text-xs">
                                    {portfolio?.user.total_trades ?? 0} trades
                                </span>
                                <span className="text-green-400 text-xs">
                                    {portfolio?.user.total_won ?? 0}W
                                </span>
                                <span className="text-red-400 text-xs">
                                    {portfolio?.user.total_lost ?? 0}L
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Portfolio value */}
                    <div className="text-center py-4 border-t border-gray-800">
                        <p className="text-gray-500 text-xs mb-1">Portfolio Value</p>
                        <p className="text-white text-4xl font-bold mb-2">
                            {formatNaira(portfolioValue)}
                        </p>
                        <div
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${isPositive
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}
                        >
                            <span>{isPositive ? "▲" : "▼"}</span>
                            <span>
                                {formatPnl(totalPnl)} ({isPositive ? "+" : ""}
                                {pnlPercent}%)
                            </span>
                        </div>
                    </div>

                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-800">
                        <div className="text-center">
                            <p className="text-gray-500 text-xs mb-1">Cash</p>
                            <p className="text-white text-sm font-bold">
                                {formatNaira(portfolio?.summary.cash_balance ?? 0)}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-gray-500 text-xs mb-1">Invested</p>
                            <p className="text-white text-sm font-bold">
                                {formatNaira(portfolio?.summary.total_invested ?? 0)}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-gray-500 text-xs mb-1">Unrealized</p>
                            <p
                                className={`text-sm font-bold ${(portfolio?.summary.unrealized_pnl ?? 0) >= 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                            >
                                {formatPnl(portfolio?.summary.unrealized_pnl ?? 0)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Progress bar vs starting balance */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>Started with ₦1,000,000</span>
                        <span className={isPositive ? "text-green-400" : "text-red-400"}>
                            {isPositive ? "+" : ""}
                            {pnlPercent}%
                        </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${isPositive
                                    ? "bg-gradient-to-r from-green-600 to-green-400"
                                    : "bg-gradient-to-r from-red-600 to-red-400"
                                }`}
                            style={{
                                width: `${Math.min(
                                    Math.max((portfolioValue / startingBalance) * 50, 2),
                                    100
                                )}%`,
                            }}
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab("open")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "open"
                                ? "bg-blue-500 text-white"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                    >
                        Open Positions ({portfolio?.open_positions.length ?? 0})
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "history"
                                ? "bg-blue-500 text-white"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                    >
                        History
                    </button>
                </div>

                {/* Open Positions */}
                {activeTab === "open" && (
                    <div className="space-y-3">
                        {portfolio?.open_positions.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-4xl mb-3">📭</p>
                                <p className="text-gray-400 text-sm">No open positions</p>
                                <button
                                    onClick={() => router.push("/markets")}
                                    className="mt-4 bg-blue-500 text-white text-sm px-6 py-2.5 rounded-xl font-medium"
                                >
                                    Browse Markets
                                </button>
                            </div>
                        ) : (
                            portfolio?.open_positions.map((position) => (
                                <button
                                    key={position.id}
                                    onClick={() =>
                                        router.push(`/markets/${position.market.id}`)
                                    }
                                    className="w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-all"
                                >
                                    {/* Market title */}
                                    <p className="text-white text-sm font-medium line-clamp-1 mb-3">
                                        {position.market.title}
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {/* Side badge */}
                                            <span
                                                className={`text-xs px-2.5 py-1 rounded-lg font-bold ${position.side === "yes"
                                                        ? "bg-green-500/10 text-green-400"
                                                        : "bg-red-500/10 text-red-400"
                                                    }`}
                                            >
                                                {position.side.toUpperCase()}
                                            </span>
                                            <span className="text-gray-500 text-xs">
                                                {formatNaira(position.amount)} invested
                                            </span>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-white text-sm font-bold">
                                                {formatNaira(position.current_value)}
                                            </p>
                                            <p
                                                className={`text-xs font-medium ${position.unrealized_pnl >= 0
                                                        ? "text-green-400"
                                                        : "text-red-400"
                                                    }`}
                                            >
                                                {formatPnl(position.unrealized_pnl)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Category + resolution */}
                                    <div className="flex justify-between mt-2 text-xs text-gray-600">
                                        <span
                                            className={
                                                CATEGORY_COLORS[position.market.category] ||
                                                "text-gray-500"
                                            }
                                        >
                                            {position.market.category}
                                        </span>
                                        <span>
                                            Resolves {position.market.resolution_date}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Transaction history */}
                {activeTab === "history" && (
                    <div className="space-y-2">
                        {portfolio?.recent_transactions.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-4xl mb-3">📜</p>
                                <p className="text-gray-400 text-sm">No transactions yet</p>
                            </div>
                        ) : (
                            portfolio?.recent_transactions.map((tx) => (
                                <div
                                    key={tx.id}
                                    className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex items-center justify-between"
                                >
                                    <div className="flex-1">
                                        <p className="text-white text-xs font-medium line-clamp-1">
                                            {tx.description}
                                        </p>
                                        <p className="text-gray-600 text-xs mt-0.5">
                                            Balance after: {formatNaira(tx.balance_after)}
                                        </p>
                                    </div>
                                    <div className="text-right ml-3">
                                        <p
                                            className={`text-sm font-bold ${tx.amount >= 0 ? "text-green-400" : "text-red-400"
                                                }`}
                                        >
                                            {tx.amount >= 0 ? "+" : ""}
                                            {formatNaira(tx.amount)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}