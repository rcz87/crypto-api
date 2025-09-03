// Legacy hook that now uses WebSocketProvider context
// This maintains backward compatibility for existing components
import { useWebSocketContext } from './WebSocketProvider';

interface WebSocketMessage {
  type: 'connection' | 'market_data' | 'system_update' | 'response';
  status?: string;
  source?: string;
  data?: any;
  timestamp: string;
  message?: string;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  marketData: any | null;
  systemStatus: any | null;
  connectionStatus: string;
  sendMessage: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const context = useWebSocketContext();
  
  return {
    isConnected: context.isConnected,
    lastMessage: context.lastMessage,
    marketData: context.marketData,
    systemStatus: context.systemStatus,
    connectionStatus: context.connectionStatus,
    sendMessage: context.sendMessage,
    connect: context.connect,
    disconnect: context.disconnect,
  };
}

// Re-export the provider and context hook for direct use
export { WebSocketProvider, useWebSocketContext } from './WebSocketProvider';