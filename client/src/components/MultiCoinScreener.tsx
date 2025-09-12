import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Search, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ScreeningResult {
  symbol: string;
  label: "BUY" | "SELL" | "HOLD";
  score: number;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  summary: string;
  priceTargets?: {
    tp1: number;
    tp2: number;
    sl: number;
  };
}

interface ScreeningResponse {
  results: ScreeningResult[];
  stats: {
    totalSymbols: number;
    buySignals: number;
    sellSignals: number;
    holdSignals: number;
  };
  meta: {
    duration: number;
    timestamp: string;
  };
}

// Popular crypto symbols untuk quick add
const POPULAR_SYMBOLS = [
  "BTC-USDT-SWAP",
  "ETH-USDT-SWAP", 
  "SOL-USDT-SWAP",
  "BNB-USDT-SWAP",
  "ADA-USDT-SWAP",
  "DOT-USDT-SWAP",
  "MATIC-USDT-SWAP",
  "AVAX-USDT-SWAP",
  "LINK-USDT-SWAP",
  "UNI-USDT-SWAP"
];

export function MultiCoinScreener() {
  const [symbols, setSymbols] = useState<string[]>(["SOL-USDT-SWAP"]); // Default SOL
  const [newSymbol, setNewSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("15m");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation untuk run screening
  const screeningMutation = useMutation({
    mutationFn: async (request: { symbols: string[]; timeframe: string; limit: number }) => {
      const response = await fetch("/api/screening/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Screening failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Screening failed");
      }
      
      return result.data as ScreeningResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Screening Completed",
        description: `Analyzed ${data.stats.totalSymbols} coins in ${data.meta.duration}ms. Found ${data.stats.buySignals} BUY signals.`,
      });
      
      // Cache results
      queryClient.setQueryData(["screening", symbols, timeframe], data);
    },
    onError: (error: Error) => {
      toast({
        title: "Screening Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const addSymbol = () => {
    const symbol = newSymbol.toUpperCase().trim();
    if (!symbol) return;
    
    // Format symbol untuk OKX (add -USDT-SWAP jika belum ada)
    const formattedSymbol = symbol.endsWith("-USDT-SWAP") 
      ? symbol 
      : symbol.replace(/[\/\-]?USDT.*$/, "") + "-USDT-SWAP";
    
    if (symbols.includes(formattedSymbol)) {
      toast({
        title: "Symbol Already Added",
        description: `${formattedSymbol} is already in the list`,
        variant: "destructive",
      });
      return;
    }
    
    if (symbols.length >= 20) {
      toast({
        title: "Too Many Symbols",
        description: "Maximum 20 symbols allowed for optimal performance",
        variant: "destructive",
      });
      return;
    }
    
    setSymbols([...symbols, formattedSymbol]);
    setNewSymbol("");
  };

  const removeSymbol = (symbolToRemove: string) => {
    setSymbols(symbols.filter(s => s !== symbolToRemove));
  };

  const addPopularSymbol = (symbol: string) => {
    if (!symbols.includes(symbol) && symbols.length < 20) {
      setSymbols([...symbols, symbol]);
    }
  };

  const runScreening = () => {
    if (symbols.length === 0) {
      toast({
        title: "No Symbols",
        description: "Add at least one symbol to screen",
        variant: "destructive",
      });
      return;
    }
    
    screeningMutation.mutate({
      symbols,
      timeframe,
      limit: 200
    });
  };

  const getSignalColor = (label: "BUY" | "SELL" | "HOLD") => {
    switch (label) {
      case "BUY": return "text-green-500 bg-green-50 dark:bg-green-900/20";
      case "SELL": return "text-red-500 bg-red-50 dark:bg-red-900/20";
      case "HOLD": return "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
    }
  };

  const getSignalIcon = (label: "BUY" | "SELL" | "HOLD") => {
    switch (label) {
      case "BUY": return <TrendingUp className="w-4 h-4" />;
      case "SELL": return <TrendingDown className="w-4 h-4" />;
      case "HOLD": return <Minus className="w-4 h-4" />;
    }
  };

  const results = screeningMutation.data?.results || [];
  const stats = screeningMutation.data?.stats;

  return (
    <Card className="w-full" data-testid="multi-coin-screener">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Multi-Coin Screening
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Analyze multiple cryptocurrencies for trading opportunities using institutional-grade algorithms
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Symbol Input */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add symbol (e.g., BTC, ETH, SOL)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addSymbol()}
              data-testid="input-new-symbol"
            />
            <Button onClick={addSymbol} size="sm" data-testid="button-add-symbol">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Popular Symbols */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Quick add:</span>
            {POPULAR_SYMBOLS.slice(0, 6).map((symbol) => (
              <Button
                key={symbol}
                variant="outline"
                size="sm"
                onClick={() => addPopularSymbol(symbol)}
                disabled={symbols.includes(symbol)}
                className="h-7 text-xs"
                data-testid={`button-quick-${symbol}`}
              >
                {symbol.replace("-USDT-SWAP", "")}
              </Button>
            ))}
          </div>
        </div>

        {/* Selected Symbols */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Selected Symbols ({symbols.length}/20)</span>
            <div className="flex gap-2">
              <select 
                value={timeframe} 
                onChange={(e) => setTimeframe(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background"
                data-testid="select-timeframe"
              >
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">1d</option>
              </select>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 min-h-[40px] border rounded-md p-2">
            {symbols.map((symbol) => (
              <Badge
                key={symbol}
                variant="secondary"
                className="flex items-center gap-1"
                data-testid={`symbol-badge-${symbol}`}
              >
                {symbol.replace("-USDT-SWAP", "")}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive/80"
                  onClick={() => removeSymbol(symbol)}
                  data-testid={`button-remove-${symbol}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {symbols.length === 0 && (
              <span className="text-sm text-muted-foreground">No symbols selected</span>
            )}
          </div>
        </div>

        {/* Run Screening Button */}
        <Button
          onClick={runScreening}
          disabled={symbols.length === 0 || screeningMutation.isPending}
          className="w-full"
          data-testid="button-run-screening"
        >
          {screeningMutation.isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Analyzing {symbols.length} coins...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Run Multi-Coin Screening
            </>
          )}
        </Button>

        {/* Results Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold">{stats.totalSymbols}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-500">{stats.buySignals}</div>
              <div className="text-xs text-muted-foreground">BUY</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">{stats.sellSignals}</div>
              <div className="text-xs text-muted-foreground">SELL</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-500">{stats.holdSignals}</div>
              <div className="text-xs text-muted-foreground">HOLD</div>
            </div>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Screening Results</h3>
            <ScrollArea className="h-[400px] border rounded-md">
              <div className="space-y-2 p-4">
                {results.map((result) => (
                  <div
                    key={result.symbol}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    data-testid={`result-${result.symbol}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-medium">
                        {result.symbol.replace("-USDT-SWAP", "")}
                      </div>
                      <Badge 
                        className={cn("flex items-center gap-1", getSignalColor(result.label))}
                      >
                        {getSignalIcon(result.label)}
                        {result.label}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <div className="text-right">
                        <div className="font-medium">Score: {result.score.toFixed(1)}</div>
                        <div className="text-muted-foreground">
                          {(result.confidence * 100).toFixed(0)}% confidence
                        </div>
                      </div>
                      <Badge variant={result.riskLevel === "high" ? "destructive" : result.riskLevel === "medium" ? "secondary" : "default"}>
                        {result.riskLevel} risk
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Error State */}
        {screeningMutation.isError && (
          <div className="flex items-center gap-2 p-3 border border-destructive/50 rounded-lg bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">
              {screeningMutation.error?.message || "Screening failed"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}