// Enhanced Multi-Coin Screening Component with Filters and Export
import React, { useEffect, useMemo, useState } from "react";

type Row = {
  symbol: string;
  score: number;
  label: "BUY" | "SELL" | "HOLD";
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  summary: string;
  // Enhanced MTF fields
  regime?: "trending" | "ranging" | "volatile" | "quiet";
  htf?: {
    combined: { bias: "bullish" | "bearish" | "neutral"; strength: number };
    quality: "high" | "medium" | "low";
  };
  mtf?: {
    appliedTilt: number;
    agree: boolean;
    disagree: boolean;
    reason: string;
  };
};

type ApiResponse = {
  timestamp: number;
  processingTime?: number;
  results: Row[];
  stats?: {
    totalSymbols: number;
    buySignals: number;
    sellSignals: number;
    holdSignals: number;
    avgScore: number;
    topPicks?: Array<{ symbol: string; score: number; label: string }>;
  };
  meta?: {
    responseTime: number;
    requestTime: string;
    version: string;
  };
};

const PRESET_SYMBOLS = {
  top10: ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOT", "MATIC", "UNI"],
  defi: ["UNI", "AAVE", "COMP", "MKR", "SNX", "CRV", "1INCH", "YFI"],
  layer1: ["ETH", "SOL", "ADA", "AVAX", "DOT", "NEAR", "ATOM", "FTM"],
  memes: ["DOGE", "SHIB", "PEPE", "FLOKI", "WIF"]
};

export default function MultiCoinScreening() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [stats, setStats] = useState<ApiResponse["stats"] | null>(null);
  
  // Filters
  const [timeframe, setTimeframe] = useState("15m");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [minConfidence, setMinConfidence] = useState(0);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(PRESET_SYMBOLS.top10);
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  const fetchData = async () => {
    if (selectedSymbols.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/screener/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // API key would be added here in production
          'x-api-key': (window as any).API_KEY || ''
        },
        body: JSON.stringify({
          symbols: selectedSymbols,
          timeframe,
          limit: 500
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      
      if (data.results) {
        setRows(data.results);
        setStats(data.stats || null);
        setLastUpdate(new Date().toLocaleTimeString());
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Screening fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, timeframe, selectedSymbols]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [timeframe, selectedSymbols]);

  // Filtered data
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (row.score < minScore || row.score > maxScore) return false;
      if (labelFilter !== "all" && row.label !== labelFilter) return false;
      if (riskFilter !== "all" && row.riskLevel !== riskFilter) return false;
      if (row.confidence < minConfidence) return false;
      return true;
    });
  }, [rows, minScore, maxScore, labelFilter, riskFilter, minConfidence]);

  // Export to CSV
  const exportCSV = () => {
    const header = "Symbol,Score,Label,Risk Level,Confidence,Summary\n";
    const csvContent = filteredRows.map(row => 
      `${row.symbol},${row.score},${row.label},${row.riskLevel},${row.confidence},"${row.summary.replace(/"/g, '""')}"`
    ).join("\n");
    
    const blob = new Blob([header + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `screening-${timeframe}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Preset symbol selection
  const selectPreset = (preset: keyof typeof PRESET_SYMBOLS) => {
    setSelectedSymbols(PRESET_SYMBOLS[preset]);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Multi-Coin Screening</h1>
          <p className="text-gray-600">Advanced 8-layer confluence analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">
            Last update: {lastUpdate}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.buySignals}</div>
            <div className="text-sm text-gray-600">BUY Signals</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-red-600">{stats.sellSignals}</div>
            <div className="text-sm text-gray-600">SELL Signals</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600">{stats.holdSignals}</div>
            <div className="text-sm text-gray-600">HOLD Signals</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{stats.avgScore.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Avg Score</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">{stats.totalSymbols}</div>
            <div className="text-sm text-gray-600">Total Symbols</div>
          </div>
        </div>
      )}

      {/* Symbol Presets */}
      <div className="bg-white p-4 rounded-lg border">
        <label className="block text-sm font-medium text-gray-700 mb-2">Symbol Presets</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESET_SYMBOLS).map(([key, symbols]) => (
            <button
              key={key}
              onClick={() => selectPreset(key as keyof typeof PRESET_SYMBOLS)}
              className={`px-3 py-1 rounded-md text-sm ${
                JSON.stringify(selectedSymbols.sort()) === JSON.stringify(symbols.sort())
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              } border`}
            >
              {key.toUpperCase()} ({symbols.length})
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"].map(tf => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Score</label>
            <input 
              type="number" 
              value={minScore} 
              onChange={(e) => setMinScore(Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              min="0" max="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Signal</label>
            <select 
              value={labelFilter} 
              onChange={(e) => setLabelFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="HOLD">HOLD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk</label>
            <select 
              value={riskFilter} 
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Auto Refresh</label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded mr-2"
              />
              <span className="text-sm">Every {refreshInterval}s</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Export</label>
            <button 
              onClick={exportCSV}
              disabled={filteredRows.length === 0}
              className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              CSV ({filteredRows.length})
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600 font-medium">Error:</div>
            <div className="ml-2 text-red-700">{error}</div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Symbol</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Score</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Signal</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Regime</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">HTF Bias</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">MTF</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Risk</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Confidence</th>
                <th className="px-4 py-3 text-left font-medium text-gray-900">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.map((row, index) => (
                <tr key={`${row.symbol}-${index}`} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-medium text-gray-900">{row.symbol}</td>
                  
                  {/* Score with visual bar */}
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <span className="font-medium text-sm">{row.score}</span>
                      <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                          style={{ width: `${row.score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  
                  {/* Signal */}
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      row.label === 'BUY' ? 'bg-green-100 text-green-800' :
                      row.label === 'SELL' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {row.label}
                    </span>
                  </td>
                  
                  {/* Regime */}
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                      row.regime === 'trending' ? 'bg-blue-100 text-blue-700' :
                      row.regime === 'ranging' ? 'bg-purple-100 text-purple-700' :
                      row.regime === 'volatile' ? 'bg-orange-100 text-orange-700' :
                      row.regime === 'quiet' ? 'bg-gray-100 text-gray-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {row.regime === 'trending' ? '🔥 Trend' :
                       row.regime === 'ranging' ? '📊 Range' :
                       row.regime === 'volatile' ? '⚡ Volatile' :
                       row.regime === 'quiet' ? '😴 Quiet' : '-'}
                    </span>
                  </td>
                  
                  {/* HTF Bias */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col space-y-1">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                        row.htf?.combined.bias === 'bullish' ? 'bg-green-100 text-green-700' :
                        row.htf?.combined.bias === 'bearish' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {row.htf?.combined.bias === 'bullish' ? '📈 Bull' :
                         row.htf?.combined.bias === 'bearish' ? '📉 Bear' :
                         '➡️ Neutral'}
                      </span>
                      {row.htf && (
                        <span className="text-xs text-gray-500">
                          {row.htf.combined.strength}/10 • {row.htf.quality}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* MTF Alignment */}
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-1">
                      <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded ${
                        row.mtf?.agree ? 'bg-green-100 text-green-700' :
                        row.mtf?.disagree ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {row.mtf?.agree ? '✅' : row.mtf?.disagree ? '❌' : '➖'}
                      </span>
                      {row.mtf && (
                        <span className={`text-xs font-medium ${
                          row.mtf.appliedTilt > 0 ? 'text-green-600' :
                          row.mtf.appliedTilt < 0 ? 'text-red-600' :
                          'text-gray-500'
                        }`}>
                          {row.mtf.appliedTilt > 0 ? '+' : ''}{row.mtf.appliedTilt}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* Risk Level */}
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      row.riskLevel === 'low' ? 'bg-blue-100 text-blue-800' :
                      row.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {row.riskLevel?.toUpperCase() || 'MED'}
                    </span>
                  </td>
                  
                  {/* Confidence */}
                  <td className="px-4 py-4 text-gray-900 text-sm">
                    {(row.confidence * 100).toFixed(0)}%
                  </td>
                  
                  {/* Summary (truncated) */}
                  <td className="px-4 py-4 text-gray-600 max-w-xs truncate text-sm">{row.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Analyzing {selectedSymbols.length} symbols...</span>
            </div>
          </div>
        )}

        {!loading && filteredRows.length === 0 && !error && (
          <div className="text-center py-8 text-gray-500">
            No results match your filters
          </div>
        )}
      </div>
    </div>
  );
}