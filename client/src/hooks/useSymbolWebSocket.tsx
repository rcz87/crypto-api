import { useEffect, useRef, useCallback, useState } from "react";
import { useSymbol } from "@/contexts/SymbolContext";
import { useToast } from "@/hooks/use-toast";

interface WebSocketMessage {
  type: string;
  arg?: {
    channel: string;
    instId?: string;
  };
  data?: any[];
  status?: string;
  timestamp?: string;
}

interface SymbolWebSocketState {
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  marketData: WebSocketMessage | null;
  lastUpdate: number;
  reconnectAttempts: number;
}

const WS_URL = import.meta.env.VITE_WS_URL || 
  (window.location.protocol === "https:" ? "wss://" : "ws://") + 
  window.location.host + "/ws";

const RECONNECT_INTERVALS = [1000, 2000, 5000, 10000, 30000]; // Progressive backoff
const MAX_RECONNECT_ATTEMPTS = 5;

export function useSymbolWebSocket() {
  const { symbol } = useSymbol();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  
  const [state, setState] = useState<SymbolWebSocketState>({
    isConnected: false,
    connectionStatus: "disconnected",
    marketData: null,
    lastUpdate: 0,
    reconnectAttempts: 0
  });

  // Clean up function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
  }, []);

  // Connect to WebSocket for specific symbol
  const connect = useCallback((symbolToConnect: string) => {
    // Clean up any existing connection
    cleanup();
    
    setState(prev => ({ ...prev, connectionStatus: "connecting" }));

    try {
      const ws = new WebSocket(`${WS_URL}?symbol=${symbolToConnect}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket connected for ${symbolToConnect}`);
        setState(prev => ({
          ...prev,
          isConnected: true,
          connectionStatus: "connected",
          reconnectAttempts: 0
        }));

        // Send initial connection message
        ws.send(JSON.stringify({
          type: "connection",
          symbol: symbolToConnect,
          timestamp: new Date().toISOString()
        }));

        // Setup ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "ping",
              symbol: symbolToConnect,
              timestamp: new Date().toISOString()
            }));
          }
        }, 45000); // Ping every 45 seconds
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          
          // Filter messages for current symbol
          if (data.arg?.instId && !data.arg.instId.includes(symbolToConnect.replace("USDT", ""))) {
            return;
          }

          setState(prev => ({
            ...prev,
            marketData: data,
            lastUpdate: Date.now()
          }));
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for ${symbolToConnect}:`, error);
        setState(prev => ({ ...prev, connectionStatus: "error" }));
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed for ${symbolToConnect}:`, event.code, event.reason);
        setState(prev => ({
          ...prev,
          isConnected: false,
          connectionStatus: "disconnected"
        }));

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt reconnection with backoff
        if (state.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const interval = RECONNECT_INTERVALS[Math.min(state.reconnectAttempts, RECONNECT_INTERVALS.length - 1)];
          console.log(`Reconnecting in ${interval}ms (attempt ${state.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
            connect(symbolToConnect);
          }, interval);
        } else {
          toast({
            title: "Koneksi WebSocket Terputus",
            description: `Tidak dapat terhubung ke data real-time untuk ${symbolToConnect}. Silakan refresh halaman.`,
            variant: "destructive"
          });
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setState(prev => ({ ...prev, connectionStatus: "error" }));
    }
  }, [toast, state.reconnectAttempts]);

  // Subscribe to specific channels for the symbol
  const subscribe = useCallback((channels: string[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, cannot subscribe");
      return;
    }

    const subscribeMessage = {
      type: "subscribe",
      channels: channels.map(channel => ({
        channel,
        instId: symbol
      })),
      timestamp: new Date().toISOString()
    };

    wsRef.current.send(JSON.stringify(subscribeMessage));
  }, [symbol]);

  // Unsubscribe from channels
  const unsubscribe = useCallback((channels: string[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscribeMessage = {
      type: "unsubscribe",
      channels: channels.map(channel => ({
        channel,
        instId: symbol
      })),
      timestamp: new Date().toISOString()
    };

    wsRef.current.send(JSON.stringify(unsubscribeMessage));
  }, [symbol]);

  // Effect to handle symbol changes
  useEffect(() => {
    if (symbol) {
      // Disconnect from old symbol and connect to new one
      connect(symbol);
    }

    return () => {
      cleanup();
    };
  }, [symbol]); // Only reconnect when symbol changes

  // Manual reconnect function
  const reconnect = useCallback(() => {
    setState(prev => ({ ...prev, reconnectAttempts: 0 }));
    connect(symbol);
  }, [symbol, connect]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    reconnect,
    symbol
  };
}