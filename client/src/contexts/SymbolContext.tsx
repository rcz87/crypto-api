import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRoute, useLocation } from "wouter";

interface SymbolContextType {
  symbol: string;
  setSymbol: (symbol: string) => void;
  supportedSymbols: string[];
  recentSymbols: string[];
  addToRecent: (symbol: string) => void;
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}

const SymbolContext = createContext<SymbolContextType>({
  symbol: "SOLUSDT",
  setSymbol: () => {},
  supportedSymbols: [],
  recentSymbols: [],
  addToRecent: () => {},
  watchlist: [],
  addToWatchlist: () => {},
  removeFromWatchlist: () => {},
});

// Popular trading pairs
const SUPPORTED_SYMBOLS = [
  "SOLUSDT",
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "DOTUSDT",
  "MATICUSDT",
  "LINKUSDT",
  "LTCUSDT",
  "UNIUSDT",
  "ATOMUSDT",
  "NEARUSDT",
  "ARBUSDT",
  "OPUSDT",
  "INJUSDT",
  "SUIUSDT",
  "SEIUSDT",
  "APTUSDT",
  "WLDUSDT",
  "PEPEUSDT",
  "SHIBUSDT",
  "FILUSDT",
  "TIAUSDT",
  "FTMUSDT",
  "AAVEUSDT",
  "SANDUSDT",
  "MANAUSDT",
  "AXSUSDT",
  "GALAUSDT",
  "APEUSDT",
  "CRVUSDT",
  "RUNEUSDT",
  "IMXUSDT",
  "STXUSDT",
  "ORDIUSDT",
  "KASUSDT",
  "TONCOINUSDT",
  "AIUSDT",
  "RENDERUSDT",
  "TAOUSDT",
  "FETUSDT",
  "OCEANUSDT",
  "AGIXUSDT",
  "ARKMUSDT",
  "WIFUSDT",
  "JUPUSDT",
  "PYTHUSDT",
  "JTOUSDT",
  "ONDOUSDT",
  "ENAUSDT",
  "ETHFIUSDT",
  "BBUSDT",
  "NOTUSDT",
  "IOUSDT",
  "ZKUSDT",
  "LISTAUSDT",
  "OMNIUSDT",
  "SAGAUSDT",
  "TAOUSDT",
  "VANRYUSDT",
  "DYMUSDT"
];

const MAX_RECENT_SYMBOLS = 10;

export function SymbolProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [symbol, setSymbolState] = useState<string>("SOLUSDT");
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedRecent = localStorage.getItem("recentSymbols");
    const savedWatchlist = localStorage.getItem("watchlist");
    
    if (savedRecent) {
      try {
        setRecentSymbols(JSON.parse(savedRecent));
      } catch (e) {
        console.error("Failed to parse recent symbols:", e);
      }
    }
    
    if (savedWatchlist) {
      try {
        setWatchlist(JSON.parse(savedWatchlist));
      } catch (e) {
        console.error("Failed to parse watchlist:", e);
      }
    }
  }, []);

  // Save recent symbols to localStorage
  useEffect(() => {
    if (recentSymbols.length > 0) {
      localStorage.setItem("recentSymbols", JSON.stringify(recentSymbols));
    }
  }, [recentSymbols]);

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  const setSymbol = (newSymbol: string) => {
    const upperSymbol = newSymbol.toUpperCase();
    if (SUPPORTED_SYMBOLS.includes(upperSymbol)) {
      setSymbolState(upperSymbol);
      addToRecent(upperSymbol);
    } else {
      console.warn(`Symbol ${upperSymbol} is not supported`);
    }
  };

  const addToRecent = (sym: string) => {
    setRecentSymbols(prev => {
      const filtered = prev.filter(s => s !== sym);
      const updated = [sym, ...filtered].slice(0, MAX_RECENT_SYMBOLS);
      return updated;
    });
  };

  const addToWatchlist = (sym: string) => {
    if (!watchlist.includes(sym)) {
      setWatchlist(prev => [...prev, sym]);
    }
  };

  const removeFromWatchlist = (sym: string) => {
    setWatchlist(prev => prev.filter(s => s !== sym));
  };

  return (
    <SymbolContext.Provider
      value={{
        symbol,
        setSymbol,
        supportedSymbols: SUPPORTED_SYMBOLS,
        recentSymbols,
        addToRecent,
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
      }}
    >
      {children}
    </SymbolContext.Provider>
  );
}

export function useSymbol() {
  const context = useContext(SymbolContext);
  if (!context) {
    throw new Error("useSymbol must be used within SymbolProvider");
  }
  return context;
}