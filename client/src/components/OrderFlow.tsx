import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, AlertTriangle, Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react';
import {
  Table, TableHeader, TableBody,
  TableHead, TableRow, TableCell
} from '@/components/ui/table';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ErrorState } from '@/components/ui/error-states';
import { EmptyState } from '@/components/ui/empty-states';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Trade {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface OrderFlowProps {
  largeTradeThreshold?: number; // default 10k USDT
  maxTrades?: number;           // default 50 entries
}

export const OrderFlow: React.FC<OrderFlowProps> = ({
  largeTradeThreshold = 10000,
  maxTrades = 50,
}) => {
  const { lastMessage, isConnected, connectionStatus } = useWebSocket();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wsError, setWsError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Listen for WebSocket market_data messages (trades channel)
  useEffect(() => {
    try {
      setWsError(null); // Clear any previous errors
      
      if (!lastMessage || lastMessage.type !== 'market_data' || !lastMessage.data) {
        return;
      }
      
      const payload = lastMessage.data;
      
      // Validate payload structure before processing
      if (!payload || typeof payload !== 'object') {
        return;
      }
      
      if (payload.arg?.channel === 'trades' && Array.isArray(payload.data) && payload.data.length > 0) {
        const validTrades = payload.data.filter((t: any) => 
          t && typeof t === 'object' && t.px && t.sz && t.side && t.ts
        );
        
        if (validTrades.length === 0) {
          return;
        }
        
        const newTrades: Trade[] = validTrades.map((t: any) => ({
          price: parseFloat(t.px),
          size: parseFloat(t.sz),
          side: t.side === 'buy' ? 'buy' : 'sell',
          timestamp: Number(t.ts),
        }));
        
        setTrades(prev => {
          const combined = [...newTrades, ...prev];
          return combined.slice(0, maxTrades);
        });
        
        setLastUpdate(Date.now());
        setIsLoading(false); // Data received successfully
      }
    } catch (error) {
      console.error('OrderFlow WebSocket parsing error:', error);
      setWsError('Gagal memproses data trading dari WebSocket');
      setIsLoading(false);
    }
  }, [lastMessage, maxTrades]);

  // Handle connection state changes
  useEffect(() => {
    if (!isConnected && connectionStatus === 'connecting') {
      setIsLoading(true);
    } else if (!isConnected && connectionStatus === 'disconnected') {
      setIsLoading(false);
      setWsError('Koneksi WebSocket terputus');
    } else if (isConnected && connectionStatus === 'connected') {
      setWsError(null);
      // Reset loading state but don't immediately set to false - wait for data
    }
  }, [isConnected, connectionStatus]);

  // Auto-detect if we're not receiving data for too long
  useEffect(() => {
    const checkDataFlow = setInterval(() => {
      if (isConnected && lastUpdate > 0 && Date.now() - lastUpdate > 30000) { // 30 seconds without data
        setWsError('Tidak menerima data trading baru dalam 30 detik terakhir');
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkDataFlow);
  }, [isConnected, lastUpdate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-900 border-gray-800 rounded-lg shadow-lg border">
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center text-white">
              <span className="mr-2">
                <ArrowUp className="h-5 w-5 text-emerald-400 animate-pulse" />
              </span>
              Order Flow &amp; Recent Trades
            </h2>
            <Badge variant="secondary" className="animate-pulse">
              Memuat...
            </Badge>
          </div>
        </div>
        <div className="h-64 overflow-y-auto bg-gray-800/50 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Time</TableHead>
                <TableHead className="text-right text-gray-300">Price&nbsp;(USDT)</TableHead>
                <TableHead className="text-right text-gray-300">Size&nbsp;(SOL)</TableHead>
                <TableHead className="text-right text-gray-300">Value&nbsp;(USDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Trade loading skeleton */}
              {[...Array(8)].map((_, idx) => (
                <TableRow key={idx} className="border-gray-700">
                  <TableCell className="font-mono text-xs">
                    <div className="animate-pulse bg-gray-700 h-3 w-16 rounded"></div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="animate-pulse bg-gray-700 h-3 w-20 rounded ml-auto" style={{ animationDelay: `${idx * 0.1}s` }}></div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="animate-pulse bg-gray-700 h-3 w-16 rounded ml-auto" style={{ animationDelay: `${idx * 0.1 + 0.05}s` }}></div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="animate-pulse bg-gray-700 h-3 w-24 rounded ml-auto" style={{ animationDelay: `${idx * 0.1 + 0.1}s` }}></div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Activity className="w-4 h-4 animate-bounce" />
            <span className="text-sm">Memuat data flow trading real-time...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (wsError || (!isConnected && connectionStatus === 'error')) {
    return (
      <div className="bg-gray-900 border-gray-800 rounded-lg shadow-lg border">
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center text-white">
              <span className="mr-2">
                <ArrowUp className="h-5 w-5 text-emerald-400" />
              </span>
              Order Flow &amp; Recent Trades
            </h2>
            <Badge variant="destructive">
              Error
            </Badge>
          </div>
        </div>
        <div className="p-6">
          <ErrorState
            title="Data Order Flow Tidak Tersedia"
            description="Terjadi masalah saat memuat data flow trading real-time:"
            details={[
              "Koneksi WebSocket terputus atau tidak stabil",
              "Server trading data sedang mengalami gangguan", 
              "Terlalu banyak pengguna mengakses data secara bersamaan",
              "Masalah parsing data dari exchange"
            ]}
            suggestions={[
              "Periksa koneksi internet Anda",
              "Refresh halaman untuk reconnect WebSocket",
              "Tunggu beberapa menit jika server sedang overload",
              "Gunakan data dari komponen lain sementara waktu"
            ]}
            onRetry={() => {
              setWsError(null);
              setIsLoading(true);
              // Trigger reconnection through WebSocket context
              window.location.reload();
            }}
            retryLabel="Coba Sambung Ulang"
            icon={<Activity className="w-6 h-6" />}
            className="bg-gray-800/50"
          />
        </div>
      </div>
    );
  }

  // Disconnected state (show warning but still display data if available)
  if (!isConnected) {
    return (
      <div className="bg-gray-900 border-gray-800 rounded-lg shadow-lg border">
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center text-white">
              <span className="mr-2">
                <ArrowUp className="h-5 w-5 text-emerald-400" />
              </span>
              Order Flow &amp; Recent Trades
            </h2>
            <Badge variant="destructive">
              <WifiOff className="w-3 h-3 mr-1" />
              Terputus
            </Badge>
          </div>
        </div>
        
        {/* Connection warning */}
        <div className="px-6 py-3 bg-orange-900/20 border-b border-orange-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400 font-medium">Koneksi Real-time Terputus</span>
          </div>
          <div className="text-xs text-orange-200 mt-1">
            Data tidak update secara real-time. Tekan "Sambung Ulang" untuk koneksi ulang.
          </div>
        </div>

        <div className="h-64 overflow-y-auto bg-gray-800/50 rounded-lg opacity-75">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Time</TableHead>
                <TableHead className="text-right text-gray-300">Price&nbsp;(USDT)</TableHead>
                <TableHead className="text-right text-gray-300">Size&nbsp;(SOL)</TableHead>
                <TableHead className="text-right text-gray-300">Value&nbsp;(USDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.length === 0 ? (
                <TableRow className="border-gray-700">
                  <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                    <EmptyState
                      title="Tidak Ada Data Trading"
                      description="Belum ada data trading yang diterima dari WebSocket"
                      suggestions={[
                        "Sambung ulang koneksi WebSocket",
                        "Periksa status koneksi internet",
                        "Refresh halaman untuk reset koneksi"
                      ]}
                      icon={<Activity className="w-6 h-6" />}
                      className="py-4"
                      showSuggestions={false}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                trades.slice(0, 10).map((trade, idx) => {
                  const value = trade.price * trade.size;
                  const isLarge = value >= largeTradeThreshold;
                  const timeStr = new Date(trade.timestamp).toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                  });
                  return (
                    <TableRow
                      key={`${trade.timestamp}-${idx}`}
                      className={`opacity-60 ${isLarge ? 'bg-yellow-900/20 border-yellow-600/30' : 'border-gray-700'}`}
                    >
                      <TableCell className="font-mono text-xs text-gray-300">
                        {timeStr}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={trade.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}>
                          {trade.side === 'buy'
                            ? <ArrowUp className="inline h-3 w-3" />
                            : <ArrowDown className="inline h-3 w-3" />}
                        </span>{' '}
                        {trade.price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-300">
                        {trade.size.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-300">
                        {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {isLarge && (
                          <span className="ml-1 inline-block px-1 text-xs rounded bg-yellow-900/30 text-yellow-400 font-medium">
                            ⚠
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="p-4 text-center border-t border-gray-700">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Sambung Ulang
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border-gray-800 rounded-lg shadow-lg border">
      <div className="px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center text-white">
            <span className="mr-2">
              <ArrowUp className="h-5 w-5 text-emerald-400" />
            </span>
            Order Flow &amp; Recent Trades
          </h2>
          <div className="flex items-center space-x-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              trades.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
            }`} />
            <span className={trades.length > 0 ? 'text-green-400' : 'text-gray-400'}>
              {trades.length > 0 ? `${trades.length} trades` : 'Waiting for data...'}
            </span>
          </div>
        </div>
      </div>
      <div className="h-64 overflow-y-auto bg-gray-800/50 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700">
              <TableHead className="text-gray-300">Time</TableHead>
              <TableHead className="text-right text-gray-300">Price&nbsp;(USDT)</TableHead>
              <TableHead className="text-right text-gray-300">Size&nbsp;(SOL)</TableHead>
              <TableHead className="text-right text-gray-300">Value&nbsp;(USDT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.length === 0 ? (
              <TableRow className="border-gray-700">
                <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                  <EmptyState
                    title="Menunggu Data Trading"
                    description="WebSocket terhubung, menunggu data trading masuk..."
                    details={[
                      "Koneksi WebSocket aktif dan stabil",
                      "Menunggu trading activity dari exchange",
                      "Data akan muncul saat ada transaksi baru"
                    ]}
                    suggestions={[
                      "Tunggu beberapa detik untuk data masuk",
                      "Pastikan pasar trading sedang aktif",
                      "Data akan update otomatis saat ada transaksi"
                    ]}
                    icon={<Activity className="w-6 h-6" />}
                    className="py-4"
                  />
                </TableCell>
              </TableRow>
            ) : (
              trades.map((trade, idx) => {
                const value = trade.price * trade.size;
                const isLarge = value >= largeTradeThreshold;
                const timeStr = new Date(trade.timestamp).toLocaleTimeString([], {
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                return (
                  <TableRow
                    key={`${trade.timestamp}-${idx}`}
                    className={isLarge ? 'bg-yellow-900/30 border-yellow-600/50' : 'border-gray-700 hover:bg-gray-800/50'}
                  >
                    <TableCell className="font-mono text-xs text-gray-300">
                      {timeStr}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={trade.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}
                      >
                        {trade.side === 'buy'
                          ? <ArrowUp className="inline h-3 w-3" />
                          : <ArrowDown className="inline h-3 w-3" />}
                      </span>{' '}
                      {trade.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-gray-300">
                      {trade.size.toFixed(3)}
                    </TableCell>
                      <TableCell className="text-right font-mono text-gray-300">
                      {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {isLarge && (
                        <span className="ml-1 inline-block px-1 text-xs rounded bg-yellow-900/50 text-yellow-400 font-medium">
                          ⚠
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};