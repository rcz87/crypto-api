import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { getWsBase } from '../lib/env';
import { useToast } from '@/hooks/use-toast';

interface MarketData {
  type: string;
  source: string;
  data: any;
  timestamp: string;
}

interface SystemStatus {
  type: string;
  data: {
    connectedClients: number;
    okxWebSocketStatus: string;
    metrics?: any;
    uptime: number;
  };
  timestamp: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: any;
  marketData: MarketData | null;
  systemStatus: SystemStatus | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastMessageAt: Date | null;
  connectionLatency: number | null;
  sendMessage: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting'>('disconnected');
  const [lastMessageAt, setLastMessageAt] = useState<Date | null>(null);
  const [connectionLatency, setConnectionLatency] = useState<number | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 15; // Increased for better stability
  const pingTimestampRef = useRef<number | null>(null);
  const { toast } = useToast();

  const getWebSocketUrl = () => {
    return getWsBase();
  };

  // Ping/Pong keep-alive mechanism
  const startPingPong = () => {
    // Clear any existing ping interval
    stopPingPong();
    
    // Send ping every 45 seconds to keep connection alive
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        pingTimestampRef.current = performance.now();
        wsRef.current.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        }));
      }
    }, 45000); // 45 seconds
  };

  const stopPingPong = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setConnectionStatus('connecting');
    const url = getWebSocketUrl();
    
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to:', url);
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Show success toast only after reconnect attempts (not first connection)
        if (reconnectAttempts.current > 0) {
          toast({
            title: '🟢 WebSocket Connected',
            description: 'Real-time data streaming restored',
            duration: 3000,
          });
        }
        
        reconnectAttempts.current = 0;
        
        // Send initial connection message
        ws.send(JSON.stringify({
          type: 'connection',
          timestamp: new Date().toISOString()
        }));
        
        // Start ping/pong keep-alive mechanism
        startPingPong();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Validate message data before processing
          if (!message || typeof message !== 'object') {
            console.warn('Received invalid WebSocket message format');
            return;
          }
          
          setLastMessage(message);
          setLastMessageAt(new Date());
          
          // Route message based on type
          switch (message.type) {
            case 'market_data':
              // Validate market data before setting
              if (message.data && typeof message.data === 'object') {
                setMarketData(message);
              }
              break;
            case 'system_update':
              setSystemStatus(message);
              break;
            case 'pong':
              // Handle pong response and calculate latency
              if (pingTimestampRef.current) {
                const latency = performance.now() - pingTimestampRef.current;
                setConnectionLatency(Math.round(latency));
                pingTimestampRef.current = null;
              }
              console.debug('Received pong from server');
              break;
            default:
              console.log('Received WebSocket message:', message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          // Don't let parse errors break the connection
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        
        // Stop ping/pong when disconnected
        stopPingPong();
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          // Exponential backoff: start at 1s, max 30s
          const baseDelay = 1000;
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          setConnectionStatus('reconnecting');
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          // Show reconnecting toast
          if (reconnectAttempts.current === 1) {
            toast({
              title: '🟡 Connection Lost',
              description: `Attempting to reconnect... (${reconnectAttempts.current}/${maxReconnectAttempts})`,
              duration: 4000,
            });
          } else if (reconnectAttempts.current <= 5) {
            toast({
              title: '🟡 Reconnecting...',
              description: `Attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`,
              duration: 3000,
            });
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached. Will retry in 5 minutes.');
          setConnectionStatus('error');
          
          // Show error toast
          toast({
            title: '🔴 Connection Failed',
            description: 'Maximum reconnection attempts reached. Will retry in 5 minutes.',
            variant: 'destructive',
            duration: 5000,
          });
          
          // Reset reconnection attempts after 5 minutes for fresh start
          setTimeout(() => {
            reconnectAttempts.current = 0;
            setConnectionStatus('connecting');
            connect();
          }, 300000); // 5 minutes
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        
        // Show error toast if it's the first error or after successful connection
        if (reconnectAttempts.current === 0) {
          toast({
            title: '🔴 WebSocket Error',
            description: 'Connection error occurred. Will attempt to reconnect.',
            variant: 'destructive',
            duration: 4000,
          });
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Stop ping/pong mechanism
    stopPingPong();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setLastMessageAt(null);
    setConnectionLatency(null);
    reconnectAttempts.current = 0;
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', message);
    }
  };

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  const value: WebSocketContextType = {
    isConnected,
    lastMessage,
    marketData,
    systemStatus,
    connectionStatus,
    reconnectAttempts: reconnectAttempts.current,
    maxReconnectAttempts,
    lastMessageAt,
    connectionLatency,
    sendMessage,
    connect,
    disconnect
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}

// Hook for backwards compatibility and convenience
export function useWebSocket() {
  const context = useWebSocketContext();
  
  return {
    isConnected: context.isConnected,
    lastMessage: context.lastMessage,
    marketData: context.marketData,
    systemStatus: context.systemStatus,
    connectionStatus: context.connectionStatus,
    lastMessageAt: context.lastMessageAt,
    connectionLatency: context.connectionLatency,
    sendMessage: context.sendMessage
  };
}