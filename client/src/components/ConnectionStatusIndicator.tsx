import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWebSocketContext } from '@/hooks/WebSocketProvider';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';

interface ConnectionStatusIndicatorProps {
  className?: string;
  showText?: boolean;
  compact?: boolean;
}

export const ConnectionStatusIndicator = ({ 
  className = '', 
  showText = false, 
  compact = false 
}: ConnectionStatusIndicatorProps) => {
  const { 
    isConnected, 
    connectionStatus, 
    reconnectAttempts, 
    maxReconnectAttempts 
  } = useWebSocketContext();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          variant: 'default' as const,
          color: 'bg-green-500',
          icon: <Wifi className="w-3 h-3" />,
          text: 'Connected',
          description: 'Real-time data streaming'
        };
      case 'connecting':
        return {
          variant: 'secondary' as const,
          color: 'bg-yellow-500',
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Connecting',
          description: 'Establishing connection...'
        };
      case 'reconnecting':
        return {
          variant: 'outline' as const,
          color: 'bg-orange-500',
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Reconnecting',
          description: `Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`
        };
      case 'error':
        return {
          variant: 'destructive' as const,
          color: 'bg-red-500',
          icon: <AlertTriangle className="w-3 h-3" />,
          text: 'Error',
          description: 'Connection failed. Retrying in 5 minutes.'
        };
      case 'disconnected':
      default:
        return {
          variant: 'outline' as const,
          color: 'bg-gray-500',
          icon: <WifiOff className="w-3 h-3" />,
          text: 'Disconnected',
          description: 'No real-time connection'
        };
    }
  };

  const statusConfig = getStatusConfig();

  const StatusBadge = () => (
    <Badge 
      variant={statusConfig.variant}
      className={`flex items-center gap-1.5 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} ${className}`}
      data-testid={`connection-status-${connectionStatus}`}
    >
      <div className={`w-2 h-2 rounded-full ${statusConfig.color} ${isConnected ? 'animate-pulse' : ''}`} />
      {statusConfig.icon}
      {showText && (
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium`}>
          {statusConfig.text}
        </span>
      )}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">
            <StatusBadge />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{statusConfig.text}</p>
            <p className="text-xs text-muted-foreground">{statusConfig.description}</p>
            {connectionStatus === 'connected' && (
              <p className="text-xs text-green-600">
                WebSocket: Active • Data: Live
              </p>
            )}
            {connectionStatus === 'reconnecting' && (
              <p className="text-xs text-orange-600">
                Attempt {reconnectAttempts} of {maxReconnectAttempts}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Compact version for mobile
export const CompactConnectionStatusIndicator = (props: Omit<ConnectionStatusIndicatorProps, 'compact'>) => (
  <ConnectionStatusIndicator {...props} compact={true} />
);

// Desktop version with text
export const DesktopConnectionStatusIndicator = (props: Omit<ConnectionStatusIndicatorProps, 'showText'>) => (
  <ConnectionStatusIndicator {...props} showText={true} />
);