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

  // Listen for WebSocket market_data messages (trades channel)
  useEffect(() => {
    try {
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
      }
    } catch (error) {
      // Only log meaningful errors, ignore empty objects
      if (error instanceof Error && error.message && !error.message.includes('{}')) {
        console.warn('OrderFlow WebSocket parsing error:', error.message);
      }
    }
  }, [lastMessage, maxTrades]);

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