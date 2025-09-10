/**
 * Trading pair validation utilities for multi-pair support
 * Ensures proper format and availability on OKX exchange
 */

// Supported base currencies on OKX
const SUPPORTED_BASES = [
  'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'LTC', 'BCH',
  'ETC', 'LINK', 'UNI', 'AAVE', 'ATOM', 'XRP', 'DOGE', 'SHIB',
  'AVAX', 'FTM', 'NEAR', 'ALGO', 'MANA', 'SAND', 'AXS', 'ENJ',
  'CRV', 'COMP', 'MKR', 'YFI', 'SUSHI', '1INCH', 'BAT', 'ZRX',
  'KNC', 'LRC', 'REN', 'STORJ', 'GRT', 'FIL', 'AR', 'THETA',
  'ICP', 'EGLD', 'HBAR', 'VET', 'CHZ', 'ENS', 'IMX', 'GMT',
  'APE', 'GALA', 'LOOKS', 'MAGIC', 'OP', 'ARB', 'BLUR', 'SUI',
  'PEPE', 'FLOKI', 'BONK', 'WIF', 'BOME', 'POPCAT', 'MEW',
  'RENDER', 'BNB'
];

// Supported quote currencies (USDT is primary)
const SUPPORTED_QUOTES = ['USDT'];

// Supported contract types
const SUPPORTED_TYPES = ['SWAP', 'FUTURES'];

/**
 * Validates if trading pair is supported
 */
export function isValidTradingPair(pair: string): boolean {
  if (!pair || typeof pair !== 'string') {
    return false;
  }

  // Convert to uppercase for consistency
  const upperPair = pair.toUpperCase();
  
  // Check if it's in supported bases
  return SUPPORTED_BASES.includes(upperPair);
}

/**
 * Converts pair name to OKX instrument ID format
 */
export function formatTradingSymbol(pair: string, quote: string = 'USDT', type: string = 'SWAP'): string {
  if (!isValidTradingPair(pair)) {
    throw new Error(`Unsupported trading pair: ${pair}`);
  }

  const upperPair = pair.toUpperCase();
  const upperQuote = quote.toUpperCase();
  const upperType = type.toUpperCase();

  if (!SUPPORTED_QUOTES.includes(upperQuote)) {
    throw new Error(`Unsupported quote currency: ${quote}`);
  }

  if (!SUPPORTED_TYPES.includes(upperType)) {
    throw new Error(`Unsupported contract type: ${type}`);
  }

  return `${upperPair}-${upperQuote}-${upperType}`;
}

/**
 * Extracts base currency from trading symbol
 */
export function extractBaseCurrency(symbol: string): string {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol format');
  }

  const parts = symbol.split('-');
  if (parts.length < 2) {
    throw new Error('Invalid symbol format, expected format: BASE-QUOTE-TYPE');
  }

  return parts[0].toUpperCase();
}

/**
 * Gets list of all supported trading pairs
 */
export function getSupportedPairs(): string[] {
  return [...SUPPORTED_BASES];
}

/**
 * Validates and formats trading pair request
 */
export function validateAndFormatPair(pairParam: string): {
  isValid: boolean;
  pair: string;
  symbol: string;
  error?: string;
} {
  try {
    if (!pairParam) {
      return {
        isValid: false,
        pair: '',
        symbol: '',
        error: 'Trading pair parameter is required'
      };
    }

    const upperPair = pairParam.toUpperCase();
    
    if (!isValidTradingPair(upperPair)) {
      return {
        isValid: false,
        pair: upperPair,
        symbol: '',
        error: `Unsupported trading pair: ${upperPair}. Supported pairs: ${SUPPORTED_BASES.join(', ')}`
      };
    }

    const symbol = formatTradingSymbol(upperPair);

    return {
      isValid: true,
      pair: upperPair,
      symbol,
    };
  } catch (error) {
    return {
      isValid: false,
      pair: pairParam || '',
      symbol: '',
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

/**
 * Check if pair is a "major" pair with high liquidity
 */
export function isMajorPair(pair: string): boolean {
  const majorPairs = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'LTC', 'BCH', 'XRP', 'AVAX', 'BNB'];
  return majorPairs.includes(pair.toUpperCase());
}