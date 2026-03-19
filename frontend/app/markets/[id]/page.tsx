"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { marketsApi, tradingApi, Market } from "@/lib/api";
import { useMarketStream } from "@/hooks/useMarketStream";

const CATEGORY_COLORS: Record<string, string> = {
  sports: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  politics: "bg-red-500/10 text-red-400 border-red-500/20",
  entertainment: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  finance: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  crypto: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

type Side = "yes" | "no";
type TradeStatus = "idle" | "loading" | "success" | "error";

export default function MarketPage() {
  const router = useRouter();
  const params = useParams();
  const { user, token, loading, updateUser } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [fetching, setFetching] = useState(true);
  const [side, setSide] = useState<Side>("yes");
  const [amount, setAmount] = useState("");
  const [tradeStatus, setTradeStatus] = useState<TradeStatus>("idle");
  const [tradeMessage, setTradeMessage] = useState("");
  const [showCriteria, setShowCriteria] = useState(false);
  const { prices, connected } = useMarketStream(
    market?.source === "bayse" ? market.bayse_market_id : null
  );

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  const fetchMarket = useCallback(async () => {
    if (!params.id) return;
    setFetching(true);
    try {
      const data = await marketsApi.getById(Number(params.id));
      setMarket(data);
    } catch {
      router.replace("/markets");
    } finally {
      setFetching(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    if (!prices || !market) return;
    setMarket((prev) =>
      prev
        ? {
          ...prev,
          yes_price: prices.yesPrice,
          no_price: prices.noPrice,
        }
        : prev
    );
  }, [prices]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  const currentPrice = market
    ? side === "yes"
      ? market.yes_price
      : market.no_price
    : 0.5;

  const amountNum = parseFloat(amount) || 0;
  const estimatedShares = amountNum > 0 ? amountNum / currentPrice : 0;
  const estimatedPayout = estimatedShares * 1.0;
  const estimatedProfit = estimatedPayout - amountNum;

  const MIN_TRADE = 100;
  const MAX_TRADE = 100000;

  const handleTrade = async () => {
    if (!token || !market) return;
    if (amountNum < MIN_TRADE) {
      setTradeMessage(`Minimum trade is ₦${MIN_TRADE.toLocaleString()}`);
      return;
    }
    if (amountNum > MAX_TRADE) {
      setTradeMessage(`Maximum trade is ₦${MAX_TRADE.toLocaleString()}`);
      return;
    }
    if (amountNum > (user?.balance || 0)) {
      setTradeMessage("Insufficient balance");
      return;
    }

    setTradeStatus("loading");
    setTradeMessage("");

    try {
      const result = await tradingApi.placeTrade(
        token,
        market.id,
        side,
        amountNum
      );

      setMarket((prev) =>
        prev
          ? {
            ...prev,
            yes_price: result.market.yes_price,
            no_price: result.market.no_price,
            total_volume: result.market.total_volume,
          }
          : prev
      );

      if (user) {
        updateUser({ ...user, balance: result.balance_after });
      }

      setTradeStatus("success");
      setTradeMessage(
        `✅ Trade placed! Bought ${result.position.shares.toFixed(2)} ${side.toUpperCase()} shares`
      );
      setAmount("");
    } catch (err: unknown) {
      setTradeStatus("error");
      const error = err as { response?: { data?: { detail?: string } } };
      setTradeMessage(
        error?.response?.data?.detail || "Trade failed. Try again."
      );
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "TBD";
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const daysUntil = (dateStr: string) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "Expired";
    if (days === 0) return "Resolves today";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!market) return null;

  return (
    <div className="min-h-screen bg-gray-950 pb-28">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            ←
          </button>
          <span className="text-white font-semibold text-sm line-clamp-1 flex-1">
            {market.title}
          </span>
          <div className="bg-gray-800 rounded-full px-3 py-1.5">
            <span className="text-green-400 text-xs font-bold">
              ₦{user?.balance.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Market header card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[market.category] || CATEGORY_COLORS.other
                }`}
            >
              {market.category}
            </span>
            {market.source === "bayse" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                LIVE on Bayse
              </span>
            )}
            {market.resolved && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-medium">
                Resolved: {market.resolution?.toUpperCase()}
              </span>
            )}
          </div>

          {market.source === "bayse" && (
            <div className="flex items-center gap-1.5 mb-3">
              <div
                className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-gray-600"
                  }`}
              />
              <span className="text-xs text-gray-500">
                {connected ? "Live prices" : "Connecting..."}
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-white font-bold text-base leading-snug mb-3">
            {market.title}
          </h1>

          {/* Description */}
          {market.description && (
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              {market.description}
            </p>
          )}

          {/* Resolution date */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>📅 Resolves {formatDate(market.resolution_date)}</span>
            <span
              className={
                daysUntil(market.resolution_date) === "Expired"
                  ? "text-red-400"
                  : "text-blue-400"
              }
            >
              {daysUntil(market.resolution_date)}
            </span>
          </div>
        </div>

        {/* Price display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 text-center">
            <p className="text-green-400 text-3xl font-bold mb-1">
              {Math.round(market.yes_price * 100)}%
            </p>
            <p className="text-green-400/70 text-xs font-medium">YES chance</p>
            <p className="text-gray-500 text-xs mt-1">
              ₦{market.yes_price.toFixed(3)} per share
            </p>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-center">
            <p className="text-red-400 text-3xl font-bold mb-1">
              {Math.round(market.no_price * 100)}%
            </p>
            <p className="text-red-400/70 text-xs font-medium">NO chance</p>
            <p className="text-gray-500 text-xs mt-1">
              ₦{market.no_price.toFixed(3)} per share
            </p>
          </div>
        </div>

        {/* Probability bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>YES {Math.round(market.yes_price * 100)}%</span>
            <span>
              Vol: ₦
              {market.total_volume >= 1000
                ? `${(market.total_volume / 1000).toFixed(1)}k`
                : Math.round(market.total_volume)}
            </span>
            <span>NO {Math.round(market.no_price * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
              style={{ width: `${market.yes_price * 100}%` }}
            />
          </div>
        </div>

        {/* Trade panel */}
        {!market.resolved && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <h2 className="text-white font-semibold text-sm mb-4">
              Place Trade
            </h2>

            {/* YES / NO toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSide("yes")}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${side === "yes"
                  ? "bg-green-500 text-white shadow-lg shadow-green-500/25"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
              >
                YES {Math.round(market.yes_price * 100)}%
              </button>
              <button
                onClick={() => setSide("no")}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${side === "no"
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
              >
                NO {Math.round(market.no_price * 100)}%
              </button>
            </div>

            {/* Amount input */}
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                ₦
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setTradeMessage("");
                  setTradeStatus("idle");
                }}
                placeholder="Enter amount"
                min={MIN_TRADE}
                max={MAX_TRADE}
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Quick amount buttons */}
            <div className="flex gap-2 mb-4">
              {[1000, 5000, 10000, 50000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setAmount(String(preset));
                    setTradeMessage("");
                    setTradeStatus("idle");
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs py-2 rounded-lg transition-colors"
                >
                  ₦{preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>

            {/* Estimated payout */}
            {amountNum >= MIN_TRADE && (
              <div className="bg-gray-800 rounded-xl p-3 mb-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Shares</span>
                  <span className="text-white">
                    {estimatedShares.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    If {side.toUpperCase()} wins
                  </span>
                  <span className="text-green-400 font-bold">
                    ₦{estimatedPayout.toFixed(0)} (+₦
                    {estimatedProfit.toFixed(0)})
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    If {side === "yes" ? "NO" : "YES"} wins
                  </span>
                  <span className="text-red-400">-₦{amountNum.toFixed(0)}</span>
                </div>
              </div>
            )}

            {/* Trade message */}
            {tradeMessage && (
              <div
                className={`text-xs px-3 py-2 rounded-lg mb-3 ${tradeStatus === "success"
                  ? "bg-green-500/10 text-green-400"
                  : tradeStatus === "error"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-gray-800 text-gray-400"
                  }`}
              >
                {tradeMessage}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleTrade}
              disabled={
                amountNum < MIN_TRADE ||
                amountNum > MAX_TRADE ||
                tradeStatus === "loading"
              }
              className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${side === "yes"
                ? "bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-white shadow-lg shadow-green-500/20"
                : "bg-red-500 hover:bg-red-400 disabled:bg-gray-700 disabled:text-gray-500 text-white shadow-lg shadow-red-500/20"
                }`}
            >
              {tradeStatus === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Placing trade...
                </span>
              ) : amountNum < MIN_TRADE ? (
                "Enter amount to trade"
              ) : (
                `Buy ${side.toUpperCase()} for ₦${amountNum.toLocaleString()}`
              )}
            </button>

            <p className="text-center text-gray-600 text-xs mt-3">
              Min ₦{MIN_TRADE.toLocaleString()} · Max ₦{MAX_TRADE.toLocaleString()} per trade
            </p>
          </div>
        )}

        {/* Resolution criteria accordion */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowCriteria(!showCriteria)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <span className="font-medium">📋 Resolution Criteria</span>
            <span className="text-gray-500">{showCriteria ? "▲" : "▼"}</span>
          </button>

          {showCriteria && (
            <div className="px-4 pb-4 border-t border-gray-800">
              <p className="text-gray-400 text-sm leading-relaxed pt-3">
                {market.resolution_criteria || "No resolution criteria provided."}
              </p>
              {market.source_url && (
                <a
                  href={market.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 text-xs mt-3 hover:underline"
                >
                  View source →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Tags */}
        {market.tags && market.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap pb-2">
            {market.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-800 text-gray-500 px-2 py-1 rounded-lg"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}