"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { authApi } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();

  const [username, setUsername] = useState("");
  type StatusType = "idle" | "checking" | "available" | "taken" | "loading" | "error";
  const [status, setStatus] = useState<StatusType>("idle");
  const [message, setMessage] = useState("");
  const [isNew, setIsNew] = useState(true);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace("/markets");
    }
  }, [user, loading, router]);

  // Debounced username check
  const checkUsername = useCallback(async (value: string) => {
    if (value.length < 3) {
      setStatus("idle");
      setMessage("");
      return;
    }

    setStatus("checking");

    try {
      const result = await authApi.checkUsername(value);
      setIsNew(result.available);
      setStatus(result.available ? "available" : "taken");
      setMessage(result.message);
    } catch {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) checkUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleSubmit = async () => {
    if (username.length < 3) return;
    if (status === "checking") return;

    setStatus("loading");

    try {
      await login(username.trim().toLowerCase());
      router.push("/markets");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-gray-950 to-gray-950 pointer-events-none" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo area */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 mb-4 shadow-lg shadow-blue-500/25">
            <span className="text-2xl">BPT</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Bayse Paper Trader
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Trade Nigerian prediction markets. No real money.
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
            {/* Starting balance badge */}
            <div className="flex items-center justify-center mb-6">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5">
                <span className="text-blue-400 text-sm font-medium">
                  Start with ₦1,000,000 virtual balance
                </span>
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-300 mb-2">
              Choose your username
            </label>

            {/* Input */}
            <div className="relative mb-2">
              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
                }
                onKeyDown={handleKeyDown}
                placeholder="e.g. naijabull"
                maxLength={20}
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
              />

              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {status === "checking" && (
                  <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                )}
                {status === "available" && (
                  <span className="text-blue-400 text-sm">✓</span>
                )}
                {status === "taken" && (
                  <span className="text-yellow-400 text-sm">→</span>
                )}
              </div>
            </div>

            {/* Status message */}
            <div className="h-5 mb-4">
              {message && (
                <p
                  className={`text-xs ${status === "available"
                    ? "text-blue-400"
                    : status === "taken"
                      ? "text-yellow-400"
                      : "text-red-400"
                    }`}
                >
                  {message}
                </p>
              )}
            </div>

            {/* Avatar preview */}
            {username.length >= 3 && status !== "checking" && (
              <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3 mb-4">
                <UserAvatar username={username} size={44} showBlink />
                <div>
                  <p className="text-white text-sm font-medium">@{username}</p>
                  <p className="text-gray-400 text-xs">
                    {isNew ? "Your new avatar" : "Welcome back"}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-blue-400 text-sm font-bold">₦1,000,000</p>
                  <p className="text-gray-500 text-xs">balance</p>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={
                username.length < 3 ||
                status === "checking" ||
                status === "loading"
              }
              className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 font-bold py-3 rounded-xl text-sm transition-all active:scale-95"
            >
              {status === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                  Entering...
                </span>
              ) : isNew && username.length >= 3 ? (
                "Create Account & Start Trading →"
              ) : username.length >= 3 ? (
                "Welcome Back — Enter →"
              ) : (
                "Enter username to continue"
              )}
            </button>

            <p className="text-center text-gray-600 text-xs mt-4">
              No email. No password. No KYC. Just trade.
            </p>
          </div>

          {/* Social proof */}
          <div className="mt-6 flex items-center justify-center gap-6 text-gray-600 text-xs">
            <span>🇳🇬 Nigerian markets</span>
            <span>•</span>
            <span>⚡ Instant access</span>
            <span>•</span>
            <span>🏆 Leaderboard</span>
          </div>
        </div>
      </div>
    </div>
  );
}