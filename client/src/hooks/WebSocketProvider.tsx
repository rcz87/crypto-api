import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';

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
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const getWebSocketUrl = () => {
    if (typeof window === 'undefined') return '';
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // For production domain
    if (host === 'guardiansofthegreentoken.com') {
      return 'wss://guardiansofthegreentoken.com/ws';
    }
    
    // For development and Replit
    return `${protocol}//${host}/ws`;
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
        reconnectAttempts.current = 0;
        
        // Send initial connection message
        ws.send(JSON.stringify({
          type: 'connection',
          timestamp: new Date().toISOString()
        }));
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
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached. Will retry in 5 minutes.');
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
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
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
    sendMessage: context.sendMessage
  };
}