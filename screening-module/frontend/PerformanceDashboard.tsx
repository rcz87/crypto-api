// Performance Dashboard - React component for performance analysis
// Professional performance visualization for institutional trading

import React, { useEffect, useState } from 'react';

type SummaryRow = { 
  symbol: string; 
  timeframe: string; 
  trade_count: number; 
  win_rate: number; 
  avg_pnl: number; 
  total_pnl: number;
  avg_rr: number;
  best_trade: number;
  worst_trade: number;
};

type EquityPoint = { 
  ts: number; 
  equity: number; 
  drawdown?: number; 
  peak?: number; 
};

type PerformanceMetrics = {
  totalTrades: number;
  winRate: number;
  avgTrade: number;
  expectancy: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  totalReturnPct: number;
  profitFactor: number;
};

export default function PerformanceDashboard() {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [curve, setCurve] = useState<EquityPoint[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedPeriod]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch performance summary
      const summaryRes = await fetch(`/api/perf/summary?days=${selectedPeriod}`);
      if (!summaryRes.ok) throw new Error('Failed to fetch summary');
      const summaryData = await summaryRes.json();
      
      // Fetch equity curve
      const equityRes = await fetch('/api/perf/equity');
      if (!equityRes.ok) throw new Error('Failed to fetch equity curve');
      const equityData = await equityRes.json();
      
      if (summaryData.success) {
        setSummary(summaryData.data.by_strategy || []);
      }
      
      if (equityData.success) {
        setCurve(equityData.data.curve || []);
        setMetrics(equityData.data.metrics || null);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Performance dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value || 0).toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-red-800 font-medium">Error Loading Performance Data</h3>
          <p className="text-red-600 mt-1">{error}</p>
          <button 
            onClick={fetchPerformanceData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Period:</label>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">7 Days</option>
            <option value="30">30 Days</option>
            <option value="90">90 Days</option>
            <option value="365">1 Year</option>
          </select>
          <button 
            onClick={fetchPerformanceData}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            title="Total Return" 
            value={formatPercentage(metrics.totalReturnPct)} 
            color={metrics.totalReturnPct >= 0 ? 'green' : 'red'}
          />
          <MetricCard 
            title="Win Rate" 
            value={formatPercentage(metrics.winRate)} 
            color={metrics.winRate >= 50 ? 'green' : 'yellow'}
          />
          <MetricCard 
            title="Sharpe Ratio" 
            value={metrics.sharpeRatio.toFixed(2)} 
            color={metrics.sharpeRatio >= 1 ? 'green' : metrics.sharpeRatio >= 0 ? 'yellow' : 'red'}
          />
          <MetricCard 
            title="Max Drawdown" 
            value={formatPercentage(metrics.maxDrawdownPct)} 
            color={metrics.maxDrawdownPct <= 10 ? 'green' : metrics.maxDrawdownPct <= 20 ? 'yellow' : 'red'}
          />
        </div>
      )}

      {/* Equity Curve */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Equity Curve</h2>
        <div className="w-full h-80 bg-gray-50 border rounded-lg p-4">
          <EquityChart data={curve} />
        </div>
      </div>

      {/* Performance Summary Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Strategy Performance</h2>
        </div>
        
        {summary.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900">No Performance Data</h3>
            <p className="mt-1">Start generating signals to see performance metrics.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Symbol</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Timeframe</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Trades</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Win Rate</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Avg PnL</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Total PnL</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Avg R:R</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Best Trade</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-900">Worst Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {summary.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{row.symbol}</td>
                    <td className="px-6 py-4 text-gray-600">{row.timeframe}</td>
                    <td className="px-6 py-4 text-gray-900">{row.trade_count}</td>
                    <td className="px-6 py-4">
                      <span className={`${
                        row.win_rate >= 0.6 ? 'text-green-600' : 
                        row.win_rate >= 0.4 ? 'text-yellow-600' : 'text-red-600'
                      } font-medium`}>
                        {formatPercentage(row.win_rate * 100)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={row.avg_pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(row.avg_pnl)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${row.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.total_pnl)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{row.avg_rr?.toFixed(2) || 'N/A'}</td>
                    <td className="px-6 py-4 text-green-600 font-medium">
                      {formatCurrency(row.best_trade)}
                    </td>
                    <td className="px-6 py-4 text-red-600 font-medium">
                      {formatCurrency(row.worst_trade)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ 
  title, 
  value, 
  color 
}: { 
  title: string; 
  value: string; 
  color: 'green' | 'yellow' | 'red' | 'blue'; 
}) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-sm font-medium opacity-75">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

// Simple Equity Chart Component
function EquityChart({ data }: { data: EquityPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📈</div>
          <div>No equity data available</div>
        </div>
      </div>
    );
  }

  const width = 800;
  const height = 280;
  const padding = 40;
  
  const minEquity = Math.min(...data.map(d => d.equity));
  const maxEquity = Math.max(...data.map(d => d.equity));
  const equityRange = Math.max(1, maxEquity - minEquity);
  
  const xScale = (index: number) => padding + (index / (data.length - 1)) * (width - 2 * padding);
  const yScale = (equity: number) => padding + (1 - (equity - minEquity) / equityRange) * (height - 2 * padding);
  
  const pathData = data.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${xScale(index).toFixed(1)} ${yScale(point.equity).toFixed(1)}`
  ).join(' ');

  // Calculate some key levels
  const startEquity = data[0]?.equity || 0;
  const endEquity = data[data.length - 1]?.equity || 0;
  const isProfit = endEquity >= startEquity;

  return (
    <div className="w-full h-full relative">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="border rounded">
        {/* Background */}
        <rect x={0} y={0} width={width} height={height} fill="#fafafa" stroke="#e5e7eb" />
        
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(ratio => (
          <line 
            key={ratio}
            x1={padding} 
            y1={padding + ratio * (height - 2 * padding)} 
            x2={width - padding} 
            y2={padding + ratio * (height - 2 * padding)}
            stroke="#e5e7eb" 
            strokeDasharray="5,5"
          />
        ))}
        
        {/* Equity line */}
        <path 
          d={pathData} 
          fill="none" 
          stroke={isProfit ? "#10b981" : "#ef4444"} 
          strokeWidth={2.5}
        />
        
        {/* Start and end points */}
        <circle 
          cx={xScale(0)} 
          cy={yScale(startEquity)} 
          r={4} 
          fill="#6b7280" 
        />
        <circle 
          cx={xScale(data.length - 1)} 
          cy={yScale(endEquity)} 
          r={4} 
          fill={isProfit ? "#10b981" : "#ef4444"} 
        />
        
        {/* Labels */}
        <text x={padding} y={padding - 10} fontSize="12" fill="#6b7280" fontWeight="500">
          Equity Curve
        </text>
        <text x={width - padding} y={height - 10} fontSize="11" fill="#6b7280" textAnchor="end">
          {new Date(data[data.length - 1]?.ts || Date.now()).toLocaleDateString()}
        </text>
        <text x={padding} y={height - 10} fontSize="11" fill="#6b7280">
          {new Date(data[0]?.ts || Date.now()).toLocaleDateString()}
        </text>
      </svg>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded shadow-sm border p-3 text-xs">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded ${isProfit ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="font-medium">
            {isProfit ? '+' : ''}{((endEquity - startEquity) / startEquity * 100).toFixed(2)}%
          </span>
        </div>
        <div className="text-gray-600 mt-1">
          Start: ${startEquity.toLocaleString()}
        </div>
        <div className="text-gray-600">
          Current: ${endEquity.toLocaleString()}
        </div>
      </div>
    </div>
  );
}