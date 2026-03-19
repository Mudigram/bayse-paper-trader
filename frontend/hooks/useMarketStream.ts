import { useEffect, useRef, useState } from "react";

interface PriceUpdate {
    marketId: string;
    yesPrice: number;
    noPrice: number;
}

const BAYSE_WS_URL = "wss://socket.bayse.markets/ws/v1/markets";

export function useMarketStream(bayseMarketId: string | null) {
    const [prices, setPrices] = useState<PriceUpdate | null>(null);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        if (!bayseMarketId) return;

        mountedRef.current = true;

        const connect = () => {
            if (!mountedRef.current) return;

            try {
                const ws = new WebSocket(BAYSE_WS_URL);
                wsRef.current = ws;

                ws.onopen = () => {
                    if (!mountedRef.current) return;
                    setConnected(true);

                    // Subscribe to price updates for this market
                    ws.send(
                        JSON.stringify({
                            type: "subscribe",
                            channel: "prices",
                            marketIds: [bayseMarketId],
                        })
                    );
                };

                ws.onmessage = (event) => {
                    if (!mountedRef.current) return;

                    try {
                        // Bayse batches messages with \n separator
                        const messages = event.data.split("\n").filter(Boolean);

                        for (const msg of messages) {
                            const data = JSON.parse(msg);

                            // Handle price update messages
                            if (
                                data.type === "price" ||
                                data.type === "prices" ||
                                data.channel === "prices"
                            ) {
                                const yesPrice =
                                    data.yesPrice ??
                                    data.yes_price ??
                                    data.outcome1Price ??
                                    0.5;
                                const noPrice =
                                    data.noPrice ??
                                    data.no_price ??
                                    data.outcome2Price ??
                                    0.5;

                                setPrices({
                                    marketId: bayseMarketId,
                                    yesPrice,
                                    noPrice,
                                });
                            }
                        }
                    } catch {
                        // Non-JSON message — ignore
                    }
                };

                ws.onerror = () => {
                    setConnected(false);
                };

                ws.onclose = () => {
                    if (!mountedRef.current) return;
                    setConnected(false);

                    // Reconnect after 3 seconds
                    reconnectRef.current = setTimeout(() => {
                        if (mountedRef.current) connect();
                    }, 3000);
                };
            } catch (err) {
                console.warn("WebSocket failed:", err);
                setConnected(false);
            }
        };

        connect();

        return () => {
            mountedRef.current = false;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            setConnected(false);
        };
    }, [bayseMarketId]);

    return { prices, connected };
}