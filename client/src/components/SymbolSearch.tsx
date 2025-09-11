import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Star, Clock, TrendingUp, X } from "lucide-react";
import { useSymbol } from "@/contexts/SymbolContext";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SymbolSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  const { 
    symbol, 
    setSymbol, 
    supportedSymbols, 
    recentSymbols, 
    watchlist,
    addToWatchlist,
    removeFromWatchlist 
  } = useSymbol();
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter symbols based on query
  const filteredSymbols = query.length > 0
    ? supportedSymbols.filter(s => 
        s.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20)
    : [];

  const handleSelectSymbol = (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    setLocation(`/${selectedSymbol}`);
    setQuery("");
    setOpen(false);
  };

  const toggleWatchlist = (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (watchlist.includes(sym)) {
      removeFromWatchlist(sym);
    } else {
      addToWatchlist(sym);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[200px] justify-start text-left font-normal"
          data-testid="button-symbol-search"
        >
          <Search className="mr-2 h-4 w-4" />
          <span className="font-medium">{symbol}</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari simbol... (BTC, ETH, SOL)"
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            data-testid="input-symbol-search"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {/* Search Results */}
          {filteredSymbols.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                Hasil Pencarian
              </div>
              {filteredSymbols.map((sym) => (
                <div
                  key={sym}
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent",
                    sym === symbol && "bg-accent"
                  )}
                  onClick={() => handleSelectSymbol(sym)}
                  data-testid={`item-symbol-${sym}`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{sym.replace("USDT", "/USDT")}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => toggleWatchlist(sym, e)}
                  >
                    <Star
                      className={cn(
                        "h-3 w-3",
                        watchlist.includes(sym) 
                          ? "fill-yellow-500 text-yellow-500" 
                          : "text-muted-foreground"
                      )}
                    />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Watchlist */}
          {query.length === 0 && watchlist.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1 flex items-center gap-1">
                <Star className="h-3 w-3" />
                Watchlist
              </div>
              {watchlist.map((sym) => (
                <div
                  key={sym}
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent",
                    sym === symbol && "bg-accent"
                  )}
                  onClick={() => handleSelectSymbol(sym)}
                  data-testid={`watchlist-symbol-${sym}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sym.replace("USDT", "/USDT")}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => toggleWatchlist(sym, e)}
                  >
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Recent Symbols */}
          {query.length === 0 && recentSymbols.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Terakhir Dilihat
              </div>
              {recentSymbols.map((sym) => (
                <div
                  key={sym}
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent",
                    sym === symbol && "bg-accent"
                  )}
                  onClick={() => handleSelectSymbol(sym)}
                  data-testid={`recent-symbol-${sym}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sym.replace("USDT", "/USDT")}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => toggleWatchlist(sym, e)}
                  >
                    <Star
                      className={cn(
                        "h-3 w-3",
                        watchlist.includes(sym) 
                          ? "fill-yellow-500 text-yellow-500" 
                          : "text-muted-foreground"
                      )}
                    />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Popular Pairs */}
          {query.length === 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                Popular Pairs
              </div>
              <div className="flex flex-wrap gap-1 px-2">
                {["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"].map((sym) => (
                  <Badge
                    key={sym}
                    variant="secondary"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSelectSymbol(sym)}
                  >
                    {sym.replace("USDT", "")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {query.length > 0 && filteredSymbols.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Tidak ada hasil untuk "{query}"
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}