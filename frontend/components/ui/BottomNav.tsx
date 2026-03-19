"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
    { label: "Markets", path: "/markets", icon: "📊" },
    { label: "Portfolio", path: "/portfolio", icon: "💼" },
    { label: "Leaderboard", path: "/leaderboard", icon: "🏆" },
];

export default function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur border-t border-gray-800">
            <div className="max-w-2xl mx-auto flex">
                {TABS.map((tab) => {
                    const active = pathname.startsWith(tab.path);
                    return (
                        <button
                            key={tab.path}
                            onClick={() => router.push(tab.path)}
                            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${active ? "text-blue-400" : "text-gray-600 hover:text-gray-400"
                                }`}
                        >
                            <span className="text-xl">{tab.icon}</span>
                            <span className="text-xs font-medium">{tab.label}</span>
                            {active && (
                                <div className="absolute bottom-0 w-8 h-0.5 bg-blue-500 rounded-full" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}