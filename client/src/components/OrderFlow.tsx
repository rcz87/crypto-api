import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table, TableHeader, TableBody,
  TableHead, TableRow, TableCell
} from '@/components/ui/table';
import { useWebSocket } from '@/hooks/useWebSocket';

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
  const { lastMessage } = useWebSocket();
  const [trades, setTrades] = useState<Trade[]>([]);

  // Dengarkan pesan WebSocket bertipe market_data (channel trades)
  useEffect(() => {
    console.log('🔄 OrderFlow WebSocket Message:', { 
      hasMessage: !!lastMessage,
      messageType: lastMessage?.type,
      hasData: !!lastMessage?.data,
      channel: lastMessage?.data?.arg?.channel,
      dataLength: lastMessage?.data?.data?.length 
    });

    if (!lastMessage || lastMessage.type !== 'market_data' || !lastMessage.data) {
      return;
    }
    
    const payload = lastMessage.data;
    console.log('📊 Processing market data:', { 
      channel: payload.arg?.channel, 
      hasTradesData: Array.isArray(payload.data),
      dataCount: payload.data?.length 
    });

    if (payload.arg?.channel === 'trades' && Array.isArray(payload.data)) {
      console.log('💰 Raw trades data:', payload.data);
      
      const newTrades: Trade[] = payload.data.map((t: any) => ({
        price: parseFloat(t.px),
        size: parseFloat(t.sz),
        side: t.side === 'buy' ? 'buy' : 'sell',
        timestamp: Number(t.ts),
      }));
      
      console.log('✅ Processed trades:', newTrades);
      
      setTrades(prev => {
        const combined = [...newTrades, ...prev];
        const result = combined.slice(0, maxTrades);
        console.log('📈 Updated trades count:', result.length);
        return result;
      });
    }
  }, [lastMessage, maxTrades]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center text-gray-900">
            <span className="mr-2">
              <ArrowUp className="h-5 w-5 text-emerald-500" />
            </span>
            Order Flow &amp; Recent Trades
          </h2>
          <div className="flex items-center space-x-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              trades.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span className={trades.length > 0 ? 'text-green-600' : 'text-gray-500'}>
              {trades.length > 0 ? `${trades.length} trades` : 'Waiting for data...'}
            </span>
          </div>
        </div>
      </div>
      <div className="h-64 overflow-y-auto border border-gray-200 rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Price&nbsp;(USDT)</TableHead>
              <TableHead className="text-right">Size&nbsp;(SOL)</TableHead>
              <TableHead className="text-right">Value&nbsp;(USDT)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  Waiting for live trade data...
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
                    className={isLarge ? 'bg-yellow-50' : undefined}
                  >
                    <TableCell className="font-mono text-xs text-gray-500">
                      {timeStr}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={trade.side === 'buy' ? 'text-emerald-600' : 'text-red-600'}
                      >
                        {trade.side === 'buy'
                          ? <ArrowUp className="inline h-3 w-3" />
                          : <ArrowDown className="inline h-3 w-3" />}
                      </span>{' '}
                      {trade.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {trade.size.toFixed(3)}
                    </TableCell>
                      <TableCell className="text-right font-mono">
                      {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {isLarge && (
                        <span className="ml-1 inline-block px-1 text-xs rounded bg-yellow-200 text-yellow-800 font-medium">
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