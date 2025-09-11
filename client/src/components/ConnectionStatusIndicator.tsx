import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWebSocketContext } from '@/hooks/WebSocketProvider';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { formatToWIB, formatLatency } from '@/lib/utils';

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
    maxReconnectAttempts,
    lastMessageAt,
    connectionLatency 
  } = useWebSocketContext();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          variant: 'default' as const,
          color: 'bg-green-500',
          icon: <Wifi className="w-3 h-3" />,
          text: 'Terhubung',
          description: 'Data real-time mengalir lancar',
          guidance: [
            'Semua data dashboard update otomatis',
            'Koneksi WebSocket stabil dan optimal',
            'Tidak ada tindakan diperlukan'
          ]
        };
      case 'connecting':
        return {
          variant: 'secondary' as const,
          color: 'bg-yellow-500',
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Menyambung',
          description: 'Sedang membangun koneksi ke server...',
          guidance: [
            'Tunggu beberapa detik untuk koneksi stabil',
            'Pastikan koneksi internet Anda stabil',
            'Jangan refresh halaman saat proses berlangsung'
          ]
        };
      case 'reconnecting':
        return {
          variant: 'outline' as const,
          color: 'bg-orange-500',
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Menyambung Ulang',
          description: `Percobaan ke-${reconnectAttempts} dari ${maxReconnectAttempts}`,
          guidance: [
            'Sistem otomatis mencoba sambung ulang',
            'Periksa koneksi internet jika terus gagal',
            'Data akan kembali normal setelah tersambung'
          ]
        };
      case 'error':
        return {
          variant: 'destructive' as const,
          color: 'bg-red-500',
          icon: <AlertTriangle className="w-3 h-3" />,
          text: 'Error',
          description: 'Koneksi gagal. Akan dicoba lagi dalam 5 menit.',
          guidance: [
            'Refresh halaman untuk mencoba koneksi ulang',
            'Periksa koneksi internet dan firewall',
            'Coba gunakan VPN jika masalah berlanjut',
            'Hubungi admin jika error persisten'
          ]
        };
      case 'disconnected':
      default:
        return {
          variant: 'outline' as const,
          color: 'bg-gray-500',
          icon: <WifiOff className="w-3 h-3" />,
          text: 'Terputus',
          description: 'Tidak ada koneksi real-time',
          guidance: [
            'Data tidak akan update otomatis',
            'Refresh halaman untuk koneksi ulang',
            'Periksa koneksi internet Anda',
            'Gunakan data manual sementara waktu'
          ]
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
        <TooltipContent className="max-w-sm">
          <div className="space-y-3">
            <div>
              <p className="font-medium">{statusConfig.text}</p>
              <p className="text-xs text-muted-foreground">{statusConfig.description}</p>
            </div>
            
            {connectionStatus === 'connected' && (
              <div className="text-xs text-green-600 space-y-1">
                <p className="font-medium">✅ WebSocket Aktif • Data Real-time</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sumber:</span>
                    <span>OKX Exchange</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Update:</span>
                    <span>{lastMessageAt ? formatToWIB(lastMessageAt) : 'Belum ada data'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Latensi:</span>
                    <span className="text-green-500">
                      {connectionLatency !== null ? `${connectionLatency}ms` : 'Mengukur...'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Enhanced guidance for all states */}
            <div className="border-t pt-2">
              <p className="text-xs font-medium text-blue-400 mb-1">💡 Panduan:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {statusConfig.guidance.map((tip, index) => (
                  <li key={index}>• {tip}</li>
                ))}
              </ul>
            </div>

            {connectionStatus === 'reconnecting' && (
              <div className="border-t pt-2">
                <p className="text-xs text-orange-400 font-medium">
                  🔄 Percobaan {reconnectAttempts} dari {maxReconnectAttempts}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sistem akan berhenti mencoba jika gagal terus menerus
                </p>
              </div>
            )}
            
            {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
              <div className="border-t pt-2">
                <p className="text-xs font-medium text-red-400 mb-1">⚠️ Langkah Pemecahan:</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>1. Periksa koneksi internet</div>
                  <div>2. Refresh halaman (F5 atau Ctrl+R)</div>
                  <div>3. Tunggu 30 detik lalu coba lagi</div>
                  <div>4. Nonaktifkan VPN/proxy jika ada</div>
                  <div>5. Coba browser berbeda jika masalah berlanjut</div>
                </div>
              </div>
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