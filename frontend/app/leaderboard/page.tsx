"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { portfolioApi, LeaderboardEntry } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";
import BottomNav from "@/components/ui/BottomNav";

const RANK_STYLES: Record<number, string> = {
    1: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    2: "bg-gray-400/10 border-gray-400/30 text-gray-300",
    3: "bg-orange-500/10 border-orange-500/30 text-orange-400",
};

const RANK_EMOJI: Record<number, string> = {
    1: "🥇",
    2: "🥈",
    3: "🥉",
};

export default function LeaderboardPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [fetching, setFetching] = useState(true);
    const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

    useEffect(() => {
        if (!loading && !user) router.replace("/");
    }, [user, loading, router]);

    const fetchLeaderboard = useCallback(async () => {
        setFetching(true);
        try {
            const data = await portfolioApi.getLeaderboard();
            setLeaderboard(data.leaderboard);

            // Find current user's rank
            if (user) {
                const found = data.leaderboard.find(
                    (e) => e.username === user.username
                );
                if (found) setUserRank(found);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setFetching(false);
        }
    }, [user]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    const formatNaira = (amount: number) => {
        if (Math.abs(amount) >= 1000000)
            return `₦${(amount / 1000000).toFixed(2)}M`;
        if (Math.abs(amount) >= 1000) return `₦${(amount / 1000).toFixed(1)}k`;
        return `₦${Math.round(amount).toLocaleString()}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const top3 = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3);

    return (
        <div className="min-h-screen bg-gray-950 pb-24">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <span className="text-white font-bold text-lg">Leaderboard</span>
                    <button
                        onClick={fetchLeaderboard}
                        className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                    >
                        ⟳ Refresh
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
                {fetching ? (
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 animate-pulse"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-800 rounded-full" />
                                    <div className="flex-1">
                                        <div className="h-3 bg-gray-800 rounded w-1/3 mb-2" />
                                        <div className="h-2 bg-gray-800 rounded w-1/4" />
                                    </div>
                                    <div className="h-4 bg-gray-800 rounded w-16" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-4xl mb-3">🏆</p>
                        <p className="text-gray-400 text-sm">No traders yet</p>
                        <p className="text-gray-600 text-xs mt-1">
                            Be the first to make a trade
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Your rank card — shown if not in top 3 */}
                        {userRank && userRank.rank > 3 && (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
                                <p className="text-blue-400 text-xs font-medium mb-3">
                                    Your ranking
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center">
                                        <span className="text-blue-400 font-bold text-sm">
                                            #{userRank.rank}
                                        </span>
                                    </div>
                                    <UserAvatar username={userRank.username} size={40} />
                                    <div className="flex-1">
                                        <p className="text-white text-sm font-semibold">
                                            @{userRank.username}
                                        </p>
                                        <p className="text-gray-500 text-xs">
                                            {userRank.total_trades} trades
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white text-sm font-bold">
                                            {formatNaira(userRank.portfolio_value)}
                                        </p>
                                        <p
                                            className={`text-xs font-medium ${userRank.pnl >= 0 ? "text-green-400" : "text-red-400"
                                                }`}
                                        >
                                            {userRank.pnl >= 0 ? "+" : ""}
                                            {userRank.pnl_percent.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Podium — top 3 */}
                        {top3.length > 0 && (
                            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                                <p className="text-gray-500 text-xs font-medium mb-4 text-center">
                                    TOP TRADERS
                                </p>

                                {/* Podium visual */}
                                <div className="flex items-end justify-center gap-3 mb-4">
                                    {/* 2nd place */}
                                    {top3[1] && (
                                        <div className="flex flex-col items-center gap-2">
                                            <UserAvatar username={top3[1].username} size={44} />
                                            <p className="text-gray-300 text-xs font-medium">
                                                @{top3[1].username}
                                            </p>
                                            <div className="bg-gray-700 w-16 h-12 rounded-t-lg flex items-center justify-center">
                                                <span className="text-xl">🥈</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* 1st place */}
                                    {top3[0] && (
                                        <div className="flex flex-col items-center gap-2 -mt-4">
                                            <div className="relative">
                                                <UserAvatar
                                                    username={top3[0].username}
                                                    size={56}
                                                    showBlink
                                                />
                                                <span className="absolute -top-2 -right-2 text-lg">
                                                    👑
                                                </span>
                                            </div>
                                            <p className="text-yellow-400 text-xs font-bold">
                                                @{top3[0].username}
                                            </p>
                                            <div className="bg-yellow-500/20 border border-yellow-500/30 w-16 h-16 rounded-t-lg flex items-center justify-center">
                                                <span className="text-2xl">🥇</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* 3rd place */}
                                    {top3[2] && (
                                        <div className="flex flex-col items-center gap-2">
                                            <UserAvatar username={top3[2].username} size={44} />
                                            <p className="text-gray-400 text-xs font-medium">
                                                @{top3[2].username}
                                            </p>
                                            <div className="bg-gray-700 w-16 h-8 rounded-t-lg flex items-center justify-center">
                                                <span className="text-xl">🥉</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Top 3 stats */}
                                <div className="space-y-2 border-t border-gray-800 pt-3">
                                    {top3.map((entry) => (
                                        <div
                                            key={entry.user_id}
                                            className={`flex items-center gap-3 p-2.5 rounded-xl border ${entry.username === user?.username
                                                    ? "border-blue-500/30 bg-blue-500/5"
                                                    : RANK_STYLES[entry.rank] ||
                                                    "border-gray-800 bg-transparent"
                                                }`}
                                        >
                                            <span className="text-lg w-6 text-center">
                                                {RANK_EMOJI[entry.rank]}
                                            </span>
                                            <UserAvatar username={entry.username} size={32} />
                                            <div className="flex-1">
                                                <p className="text-white text-xs font-semibold">
                                                    @{entry.username}
                                                    {entry.username === user?.username && (
                                                        <span className="text-blue-400 ml-1">(you)</span>
                                                    )}
                                                </p>
                                                <p className="text-gray-600 text-xs">
                                                    {entry.total_trades} trades
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white text-sm font-bold">
                                                    {formatNaira(entry.portfolio_value)}
                                                </p>
                                                <p
                                                    className={`text-xs font-medium ${entry.pnl >= 0 ? "text-green-400" : "text-red-400"
                                                        }`}
                                                >
                                                    {entry.pnl >= 0 ? "+" : ""}
                                                    {entry.pnl_percent.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rest of leaderboard */}
                        {rest.length > 0 && (
                            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-800">
                                    <p className="text-gray-500 text-xs font-medium">
                                        ALL TRADERS
                                    </p>
                                </div>
                                <div className="divide-y divide-gray-800">
                                    {rest.map((entry) => (
                                        <div
                                            key={entry.user_id}
                                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${entry.username === user?.username
                                                    ? "bg-blue-500/5"
                                                    : "hover:bg-gray-800/50"
                                                }`}
                                        >
                                            <span className="text-gray-600 text-xs font-bold w-6 text-center">
                                                {entry.rank}
                                            </span>
                                            <UserAvatar username={entry.username} size={36} />
                                            <div className="flex-1">
                                                <p className="text-white text-sm font-medium">
                                                    @{entry.username}
                                                    {entry.username === user?.username && (
                                                        <span className="text-blue-400 text-xs ml-1">
                                                            (you)
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-gray-600 text-xs">
                                                    {entry.total_trades} trades
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white text-sm font-bold">
                                                    {formatNaira(entry.portfolio_value)}
                                                </p>
                                                <p
                                                    className={`text-xs font-medium ${entry.pnl >= 0 ? "text-green-400" : "text-red-400"
                                                        }`}
                                                >
                                                    {entry.pnl >= 0 ? "+" : ""}
                                                    {entry.pnl_percent.toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <BottomNav />
        </div>
    );
}