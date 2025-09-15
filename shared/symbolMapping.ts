/**
 * Unified Symbol Mapping System
 * 
 * Prevents API conflicts across OKX, CoinGlass, and CoinAPI providers
 * by providing consistent symbol conversion for 65+ cryptocurrencies.
 */

export type ProviderType = 'okx' | 'coinglass' | 'coinapi';
export type UserSymbol = string; // User-facing symbol like 'SOL', 'BTC', 'ETH'

export interface ProviderSymbols {
  okx: string;      // Format: "SOL-USDT-SWAP", "BTC-USDT-SWAP"
  coinglass: string; // Format: "SOL", "BTC" 
  coinapi: string;   // Format: "SOL/USDT", "BTC/USDT"
}

/**
 * Comprehensive symbol mapping for 65+ cryptocurrencies
 * Maps user-friendly symbols to provider-specific formats
 */
export const SYMBOL_MAPPING: Record<UserSymbol, ProviderSymbols> = {
  // Major cryptocurrencies
  'BTC': {
    okx: 'BTC-USDT-SWAP',
    coinglass: 'BTC',
    coinapi: 'BTC/USDT'
  },
  'ETH': {
    okx: 'ETH-USDT-SWAP',
    coinglass: 'ETH',
    coinapi: 'ETH/USDT'
  },
  'SOL': {
    okx: 'SOL-USDT-SWAP',
    coinglass: 'SOL',
    coinapi: 'SOL/USDT'
  },
  
  // Layer 1 protocols
  'ADA': {
    okx: 'ADA-USDT-SWAP',
    coinglass: 'ADA',
    coinapi: 'ADA/USDT'
  },
  'AVAX': {
    okx: 'AVAX-USDT-SWAP',
    coinglass: 'AVAX',
    coinapi: 'AVAX/USDT'
  },
  'DOT': {
    okx: 'DOT-USDT-SWAP',
    coinglass: 'DOT',
    coinapi: 'DOT/USDT'
  },
  'ATOM': {
    okx: 'ATOM-USDT-SWAP',
    coinglass: 'ATOM',
    coinapi: 'ATOM/USDT'
  },
  'NEAR': {
    okx: 'NEAR-USDT-SWAP',
    coinglass: 'NEAR',
    coinapi: 'NEAR/USDT'
  },
  'ALGO': {
    okx: 'ALGO-USDT-SWAP',
    coinglass: 'ALGO',
    coinapi: 'ALGO/USDT'
  },
  'FTM': {
    okx: 'FTM-USDT-SWAP',
    coinglass: 'FTM',
    coinapi: 'FTM/USDT'
  },
  'LUNA': {
    okx: 'LUNA-USDT-SWAP',
    coinglass: 'LUNA',
    coinapi: 'LUNA/USDT'
  },
  'ONE': {
    okx: 'ONE-USDT-SWAP',
    coinglass: 'ONE',
    coinapi: 'ONE/USDT'
  },
  
  // Layer 2 & Scaling solutions
  'MATIC': {
    okx: 'MATIC-USDT-SWAP',
    coinglass: 'MATIC',
    coinapi: 'MATIC/USDT'
  },
  'ARB': {
    okx: 'ARB-USDT-SWAP',
    coinglass: 'ARB',
    coinapi: 'ARB/USDT'
  },
  'OP': {
    okx: 'OP-USDT-SWAP',
    coinglass: 'OP',
    coinapi: 'OP/USDT'
  },
  'LRC': {
    okx: 'LRC-USDT-SWAP',
    coinglass: 'LRC',
    coinapi: 'LRC/USDT'
  },
  
  // DeFi tokens
  'UNI': {
    okx: 'UNI-USDT-SWAP',
    coinglass: 'UNI',
    coinapi: 'UNI/USDT'
  },
  'SUSHI': {
    okx: 'SUSHI-USDT-SWAP',
    coinglass: 'SUSHI',
    coinapi: 'SUSHI/USDT'
  },
  'AAVE': {
    okx: 'AAVE-USDT-SWAP',
    coinglass: 'AAVE',
    coinapi: 'AAVE/USDT'
  },
  'COMP': {
    okx: 'COMP-USDT-SWAP',
    coinglass: 'COMP',
    coinapi: 'COMP/USDT'
  },
  'MKR': {
    okx: 'MKR-USDT-SWAP',
    coinglass: 'MKR',
    coinapi: 'MKR/USDT'
  },
  'SNX': {
    okx: 'SNX-USDT-SWAP',
    coinglass: 'SNX',
    coinapi: 'SNX/USDT'
  },
  'CRV': {
    okx: 'CRV-USDT-SWAP',
    coinglass: 'CRV',
    coinapi: 'CRV/USDT'
  },
  '1INCH': {
    okx: '1INCH-USDT-SWAP',
    coinglass: '1INCH',
    coinapi: '1INCH/USDT'
  },
  'YFI': {
    okx: 'YFI-USDT-SWAP',
    coinglass: 'YFI',
    coinapi: 'YFI/USDT'
  },
  
  // Meme coins
  'DOGE': {
    okx: 'DOGE-USDT-SWAP',
    coinglass: 'DOGE',
    coinapi: 'DOGE/USDT'
  },
  'SHIB': {
    okx: 'SHIB-USDT-SWAP',
    coinglass: 'SHIB',
    coinapi: 'SHIB/USDT'
  },
  'PEPE': {
    okx: 'PEPE-USDT-SWAP',
    coinglass: 'PEPE',
    coinapi: 'PEPE/USDT'
  },
  'FLOKI': {
    okx: 'FLOKI-USDT-SWAP',
    coinglass: 'FLOKI',
    coinapi: 'FLOKI/USDT'
  },
  
  // Exchange tokens
  'BNB': {
    okx: 'BNB-USDT-SWAP',
    coinglass: 'BNB',
    coinapi: 'BNB/USDT'
  },
  'CRO': {
    okx: 'CRO-USDT-SWAP',
    coinglass: 'CRO',
    coinapi: 'CRO/USDT'
  },
  'FTT': {
    okx: 'FTT-USDT-SWAP',
    coinglass: 'FTT',
    coinapi: 'FTT/USDT'
  },
  'LEO': {
    okx: 'LEO-USDT-SWAP',
    coinglass: 'LEO',
    coinapi: 'LEO/USDT'
  },
  
  // Privacy coins
  'XMR': {
    okx: 'XMR-USDT-SWAP',
    coinglass: 'XMR',
    coinapi: 'XMR/USDT'
  },
  'ZEC': {
    okx: 'ZEC-USDT-SWAP',
    coinglass: 'ZEC',
    coinapi: 'ZEC/USDT'
  },
  'DASH': {
    okx: 'DASH-USDT-SWAP',
    coinglass: 'DASH',
    coinapi: 'DASH/USDT'
  },
  
  // Enterprise & utility tokens
  'LINK': {
    okx: 'LINK-USDT-SWAP',
    coinglass: 'LINK',
    coinapi: 'LINK/USDT'
  },
  'VET': {
    okx: 'VET-USDT-SWAP',
    coinglass: 'VET',
    coinapi: 'VET/USDT'
  },
  'XLM': {
    okx: 'XLM-USDT-SWAP',
    coinglass: 'XLM',
    coinapi: 'XLM/USDT'
  },
  'TRX': {
    okx: 'TRX-USDT-SWAP',
    coinglass: 'TRX',
    coinapi: 'TRX/USDT'
  },
  'THETA': {
    okx: 'THETA-USDT-SWAP',
    coinglass: 'THETA',
    coinapi: 'THETA/USDT'
  },
  'HBAR': {
    okx: 'HBAR-USDT-SWAP',
    coinglass: 'HBAR',
    coinapi: 'HBAR/USDT'
  },
  'ICP': {
    okx: 'ICP-USDT-SWAP',
    coinglass: 'ICP',
    coinapi: 'ICP/USDT'
  },
  'EOS': {
    okx: 'EOS-USDT-SWAP',
    coinglass: 'EOS',
    coinapi: 'EOS/USDT'
  },
  
  // Gaming & NFT tokens
  'AXS': {
    okx: 'AXS-USDT-SWAP',
    coinglass: 'AXS',
    coinapi: 'AXS/USDT'
  },
  'SAND': {
    okx: 'SAND-USDT-SWAP',
    coinglass: 'SAND',
    coinapi: 'SAND/USDT'
  },
  'MANA': {
    okx: 'MANA-USDT-SWAP',
    coinglass: 'MANA',
    coinapi: 'MANA/USDT'
  },
  'ENJ': {
    okx: 'ENJ-USDT-SWAP',
    coinglass: 'ENJ',
    coinapi: 'ENJ/USDT'
  },
  'CHZ': {
    okx: 'CHZ-USDT-SWAP',
    coinglass: 'CHZ',
    coinapi: 'CHZ/USDT'
  },
  
  // AI & Infrastructure tokens
  'FET': {
    okx: 'FET-USDT-SWAP',
    coinglass: 'FET',
    coinapi: 'FET/USDT'
  },
  'OCEAN': {
    okx: 'OCEAN-USDT-SWAP',
    coinglass: 'OCEAN',
    coinapi: 'OCEAN/USDT'
  },
  'AGIX': {
    okx: 'AGIX-USDT-SWAP',
    coinglass: 'AGIX',
    coinapi: 'AGIX/USDT'
  },
  'AR': {
    okx: 'AR-USDT-SWAP',
    coinglass: 'AR',
    coinapi: 'AR/USDT'
  },
  'FIL': {
    okx: 'FIL-USDT-SWAP',
    coinglass: 'FIL',
    coinapi: 'FIL/USDT'
  },
  
  // Other major altcoins
  'LTC': {
    okx: 'LTC-USDT-SWAP',
    coinglass: 'LTC',
    coinapi: 'LTC/USDT'
  },
  'BCH': {
    okx: 'BCH-USDT-SWAP',
    coinglass: 'BCH',
    coinapi: 'BCH/USDT'
  },
  'XRP': {
    okx: 'XRP-USDT-SWAP',
    coinglass: 'XRP',
    coinapi: 'XRP/USDT'
  },
  'ETC': {
    okx: 'ETC-USDT-SWAP',
    coinglass: 'ETC',
    coinapi: 'ETC/USDT'
  },
  'BSV': {
    okx: 'BSV-USDT-SWAP',
    coinglass: 'BSV',
    coinapi: 'BSV/USDT'
  },
  'FLOW': {
    okx: 'FLOW-USDT-SWAP',
    coinglass: 'FLOW',
    coinapi: 'FLOW/USDT'
  },
  'APT': {
    okx: 'APT-USDT-SWAP',
    coinglass: 'APT',
    coinapi: 'APT/USDT'
  },
  'SUI': {
    okx: 'SUI-USDT-SWAP',
    coinglass: 'SUI',
    coinapi: 'SUI/USDT'
  },
  'DYDX': {
    okx: 'DYDX-USDT-SWAP',
    coinglass: 'DYDX',
    coinapi: 'DYDX/USDT'
  },
  'GMX': {
    okx: 'GMX-USDT-SWAP',
    coinglass: 'GMX',
    coinapi: 'GMX/USDT'
  },
  
  // Stablecoins
  'USDT': {
    okx: 'USDT-USDC-SWAP',
    coinglass: 'USDT',
    coinapi: 'USDT/USDC'
  },
  'USDC': {
    okx: 'USDC-USDT-SWAP', 
    coinglass: 'USDC',
    coinapi: 'USDC/USDT'
  },
  'DAI': {
    okx: 'DAI-USDT-SWAP',
    coinglass: 'DAI',
    coinapi: 'DAI/USDT'
  },
  'BUSD': {
    okx: 'BUSD-USDT-SWAP',
    coinglass: 'BUSD',
    coinapi: 'BUSD/USDT'
  }
};

/**
 * Get the list of all supported user symbols
 */
export function getSupportedSymbols(): UserSymbol[] {
  return Object.keys(SYMBOL_MAPPING);
}

/**
 * Get symbol format for a specific provider
 * @param userSymbol - User-friendly symbol (e.g., 'SOL', 'BTC')
 * @param provider - Target provider ('okx', 'coinglass', 'coinapi')
 * @returns Provider-specific symbol format or null if not found
 */
export function getSymbolFor(userSymbol: UserSymbol, provider: ProviderType): string | null {
  const normalizedSymbol = userSymbol.toUpperCase();
  const mapping = SYMBOL_MAPPING[normalizedSymbol];
  
  if (!mapping) {
    console.warn(`[SymbolMapping] Unknown symbol: ${userSymbol}`);
    return null;
  }
  
  return mapping[provider];
}

/**
 * Get all provider symbols for a given user symbol
 * @param userSymbol - User-friendly symbol
 * @returns Object with all provider-specific formats
 */
export function getAllProviderSymbols(userSymbol: UserSymbol): ProviderSymbols | null {
  const normalizedSymbol = userSymbol.toUpperCase();
  const mapping = SYMBOL_MAPPING[normalizedSymbol];
  
  if (!mapping) {
    console.warn(`[SymbolMapping] Unknown symbol: ${userSymbol}`);
    return null;
  }
  
  return { ...mapping };
}

/**
 * Convert from provider-specific format back to user symbol
 * @param providerSymbol - Provider-specific symbol
 * @param provider - Source provider
 * @returns User-friendly symbol or null if not found
 */
export function getUserSymbolFrom(providerSymbol: string, provider: ProviderType): UserSymbol | null {
  for (const [userSymbol, mapping] of Object.entries(SYMBOL_MAPPING)) {
    if (mapping[provider] === providerSymbol) {
      return userSymbol;
    }
  }
  
  console.warn(`[SymbolMapping] Unknown provider symbol: ${providerSymbol} for ${provider}`);
  return null;
}

/**
 * Validate if a user symbol is supported
 * @param userSymbol - Symbol to validate
 * @returns True if symbol is supported
 */
export function isSymbolSupported(userSymbol: UserSymbol): boolean {
  return Object.prototype.hasOwnProperty.call(SYMBOL_MAPPING, userSymbol.toUpperCase());
}

/**
 * Get symbol mapping statistics
 * @returns Object with mapping statistics
 */
export function getSymbolMappingStats() {
  const totalSymbols = Object.keys(SYMBOL_MAPPING).length;
  const providers = ['okx', 'coinglass', 'coinapi'] as const;
  
  return {
    totalSymbols,
    supportedProviders: providers.length,
    providers: providers.reduce((acc, provider) => {
      acc[provider] = {
        totalMapped: Object.values(SYMBOL_MAPPING).filter(mapping => mapping[provider]).length
      };
      return acc;
    }, {} as Record<ProviderType, { totalMapped: number }>)
  };
}

/**
 * Log symbol mapping usage for monitoring
 * @param userSymbol - Symbol being mapped
 * @param provider - Target provider
 * @param success - Whether mapping was successful
 */
export function logSymbolMapping(userSymbol: UserSymbol, provider: ProviderType, success: boolean): void {
  const timestamp = new Date().toISOString();
  console.log(`[SymbolMapping] ${timestamp} - ${userSymbol} → ${provider}: ${success ? 'SUCCESS' : 'FAILED'}`);
  
  // Here you could add metrics collection for monitoring
  // Example: metricsCollector.recordSymbolMapping(userSymbol, provider, success);
}

// Export all symbol mappings for external validation
export { SYMBOL_MAPPING as RAW_SYMBOL_MAPPING };

// Export type definitions for external usage
export type { ProviderSymbols, ProviderType, UserSymbol };