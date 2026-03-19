"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { marketsApi, Market } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";
import axios from "axios";

const CATEGORY_COLORS: Record<string, string> = {
    sports: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    politics: "bg-red-500/10 text-red-400 border-red-500/20",
    entertainment: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    finance: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    crypto: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const CATEGORY_EMOJI: Record<string, string> = {
    sports: "⚽",
    politics: "🏛️",
    entertainment: "🎵",
    finance: "💰",
    crypto: "₿",
    other: "🌍",
};

const FILTERS = [
    { label: "All", value: "" },
    { label: "⚽ Sports", value: "sports" },
    { label: "🏛️ Politics", value: "politics" },
    { label: "🎵 Entertainment", value: "entertainment" },
    { label: "💰 Finance", value: "finance" },
    { label: "₿ Crypto", value: "crypto" },
];

export default function MarketsPage() {
    const router = useRouter();
    const { user, token, loading } = useAuth();

    const [markets, setMarkets] = useState<Market[]>([]);
    const [filtered, setFiltered] = useState<Market[]>([]);
    const [activeFilter, setActiveFilter] = useState("");
    const [search, setSearch] = useState("");
    const [fetching, setFetching] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        if (!loading && !user) router.replace("/");
    }, [user, loading, router]);

    const fetchMarkets = useCallback(async () => {
        setFetching(true);
        try {
            // Check if sync is needed
            const syncStatus = await axios.get(
                "http://localhost:8000/api/markets/sync/status"
            );
            if (syncStatus.data.needs_sync) {
                await marketsApi.syncBayse();
            }

            const data = await marketsApi.getAll();
            setMarkets(data.results);
            setFiltered(data.results);
        } catch (err) {
            console.error(err);
        } finally {
            setFetching(false);
        }
    }, []);

    useEffect(() => {
        fetchMarkets();
    }, [fetchMarkets]);

    // Filter + search
    useEffect(() => {
        let result = markets;

        if (activeFilter) {
            result = result.filter((m) => m.category === activeFilter);
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter((m) => m.title.toLowerCase().includes(q));
        }

        setFiltered(result);
    }, [markets, activeFilter, search]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await marketsApi.syncBayse();
            await fetchMarkets();
        } catch (err) {
            console.error(err);
        } finally {
            setSyncing(false);
        }
    };

    const formatPrice = (price: number) => `${Math.round(price * 100)}%`;

    const formatVolume = (volume: number) => {
        if (volume >= 1000) return `₦${(volume / 1000).toFixed(1)}k`;
        return `₦${Math.round(volume)}`;
    };

    const daysUntil = (dateStr: string) => {
        if (!dateStr) return null;
        const diff = new Date(dateStr).getTime() - Date.now();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days < 0) return "Expired";
        if (days === 0) return "Today";
        if (days === 1) return "1 day";
        return `${days}d`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 pb-24">
            {/* Top bar */}
            <div className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/80 shadow-sm shadow-black/20">
                <div className="max-w-2xl mx-auto px-4">
                    {/* Header row */}
                    <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-lg">Markets</span>
                            <span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/20">
                                {filtered.length}
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Balance pill */}
                            <div className="bg-gray-800/60 border border-gray-700/50 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 shadow-inner transition-all hover:bg-gray-800 group">
                                <span className="text-gray-400 text-xs">Balance</span>
                                <span className="text-green-400 text-sm font-bold tracking-tight group-hover:text-green-300 transition-colors">
                                    ₦{user?.balance.toLocaleString()}
                                </span>
                            </div>

                            {/* Avatar */}
                            {user && (
                                <button onClick={() => router.push("/portfolio")}>
                                    <UserAvatar username={user.username} size={32} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="pb-3">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                                🔍
                            </span>
                            <input
                                type="text"
                                placeholder="Search markets..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-800 text-white placeholder-gray-500 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-gray-900 transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Category filters */}
                    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                        {FILTERS.map((f) => (
                            <button
                                key={f.value}
                                onClick={() => setActiveFilter(f.value)}
                                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 ${activeFilter === f.value
                                    ? "bg-blue-600 shadow-lg shadow-blue-600/25 text-white scale-105"
                                    : "bg-gray-900/80 border border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200 hover:border-gray-700"
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Markets list */}
            <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
                {/* Sync button */}
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl py-2.5 text-sm text-gray-400 transition-colors"
                >
                    {syncing ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                            Syncing Bayse markets...
                        </>
                    ) : (
                        <>⟳ Sync latest Bayse markets</>
                    )}
                </button>

                {fetching ? (
                    // Skeleton loaders
                    <div className="space-y-3">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 animate-pulse"
                            >
                                <div className="h-4 bg-gray-800 rounded w-3/4 mb-3" />
                                <div className="h-3 bg-gray-800 rounded w-1/2 mb-4" />
                                <div className="flex gap-2">
                                    <div className="h-8 bg-gray-800 rounded-lg flex-1" />
                                    <div className="h-8 bg-gray-800 rounded-lg flex-1" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="text-gray-400 text-sm">No markets found</p>
                        <p className="text-gray-600 text-xs mt-1">
                            Try a different filter or sync Bayse markets
                        </p>
                    </div>
                ) : (
                    filtered.map((market) => (
                        <button
                            key={market.id}
                            onClick={() => router.push(`/markets/${market.id}`)}
                            className="group relative w-full text-left bg-gray-900/40 backdrop-blur-sm hover:bg-gray-800/60 border border-gray-800/80 hover:border-blue-500/30 rounded-3xl p-5 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 overflow-hidden"
                        >
                            {/* Glowing orb effect on hover */}
                            <div className="absolute -inset-24 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl pointer-events-none" />

                            {/* Top row */}
                            <div className="relative flex items-start justify-between gap-3 mb-4">
                                <div className="flex-1">
                                    {/* Category + source badges */}
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[market.category] ||
                                                CATEGORY_COLORS.other
                                                }`}
                                        >
                                            {CATEGORY_EMOJI[market.category] || "🌍"}{" "}
                                            {market.category}
                                        </span>
                                        {market.source === "bayse" && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                                                LIVE
                                            </span>
                                        )}
                                        {market.total_volume > 100 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                                                🔥 Hot
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2">
                                        {market.title}
                                    </h3>
                                </div>

                                {/* Resolution date */}
                                <div className="flex-shrink-0 text-right">
                                    <p className="text-gray-500 text-xs">
                                        {daysUntil(market.resolution_date)}
                                    </p>
                                </div>
                            </div>

                            {/* YES / NO price bars */}
                            <div className="relative flex gap-3 mb-4">
                                <div className="flex-1 bg-green-500/5 group-hover:bg-green-500/10 border border-green-500/20 group-hover:border-green-500/30 rounded-2xl px-4 py-3 transition-colors duration-300">
                                    <p className="text-green-400/80 text-xs font-semibold mb-0.5">YES</p>
                                    <p className="text-green-400 font-bold text-lg">
                                        {formatPrice(market.yes_price)}
                                    </p>
                                </div>
                                <div className="flex-1 bg-red-500/5 group-hover:bg-red-500/10 border border-red-500/20 group-hover:border-red-500/30 rounded-2xl px-4 py-3 transition-colors duration-300">
                                    <p className="text-red-400/80 text-xs font-semibold mb-0.5">NO</p>
                                    <p className="text-red-400 font-bold text-lg">
                                        {formatPrice(market.no_price)}
                                    </p>
                                </div>
                            </div>

                            {/* Volume + probability bar */}
                            <div className="relative space-y-2">
                                <div className="flex justify-between text-xs text-gray-500 font-medium">
                                    <span>Vol: <span className="text-gray-400">{formatVolume(market.total_volume)}</span></span>
                                    <span className="text-gray-400">
                                        {Math.round(market.yes_price * 100)}% chance YES
                                    </span>
                                </div>
                                <div className="h-1.5 bg-gray-800/80 rounded-full overflow-hidden shadow-inner backdrop-blur-sm">
                                    <div
                                        className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000 group-hover:shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                                        style={{ width: `${market.yes_price * 100}%` }}
                                    />
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}