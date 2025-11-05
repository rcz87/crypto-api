/**
 * Trading MCP Tools
 * Wraps trading, screener, and AI signal functionality for MCP protocol
 * Provides same capabilities as GPT Actions via stdio transport
 */

import axios from 'axios';
import { mcpConfig } from '../config.js';

/**
 * Get unified advanced market operations
 * Supports: whale_alerts, market_sentiment, volume_spikes, multi_coin_screening,
 *           new_listings, opportunities, alpha_screening, micro_caps
 */
export async function getUnifiedAdvancedTool(params: {
  op: string;
  symbol?: string;
  exchange?: string;
  symbols?: string[];
  timeframe?: string;
  limit?: number;
  minScore?: number;
  maxMarketCap?: number;
  minVolumeChange?: number;
}) {
  const { op } = params;

  if (!op) {
    return {
      success: false,
      error: 'Operation (op) parameter is required'
    };
  }

  try {
    const response = await axios.post(
      `${mcpConfig.nodeServiceUrl}/gpts/unified/advanced`,
      params,
      {
        timeout: mcpConfig.defaultTimeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MCP-Server/1.0'
        }
      }
    );

    return {
      success: true,
      data: response.data,
      source: 'unified_advanced_api'
    };
  } catch (error: any) {
    console.error(`[MCP TradingTools] Unified advanced (${op}) error:`, error.message);
    return {
      success: false,
      error: error.message || `Failed to execute operation: ${op}`,
      source: 'unified_advanced_api'
    };
  }
}

/**
 * Get available trading symbols
 */
export async function getSymbolsTool() {
  try {
    const response = await axios.get(
      `${mcpConfig.nodeServiceUrl}/gpts/unified/symbols`,
      {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MCP-Server/1.0'
        }
      }
    );

    return {
      success: true,
      data: response.data,
      source: 'symbols_api'
    };
  } catch (error: any) {
    console.error('[MCP TradingTools] Get symbols error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch symbols',
      source: 'symbols_api'
    };
  }
}

/**
 * Get market data for specific symbol
 */
export async function getMarketDataTool(params: { symbol: string }) {
  const { symbol } = params;

  if (!symbol) {
    return {
      success: false,
      error: 'Symbol parameter is required'
    };
  }

  try {
    const response = await axios.get(
      `${mcpConfig.nodeServiceUrl}/gpts/unified/market/${symbol.toUpperCase()}`,
      {
        timeout: mcpConfig.pythonServiceTimeout,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MCP-Server/1.0'
        }
      }
    );

    return {
      success: true,
      data: response.data,
      source: 'market_data_api'
    };
  } catch (error: any) {
    console.error(`[MCP TradingTools] Get market data (${symbol}) error:`, error.message);
    return {
      success: false,
      error: error.message || `Failed to fetch market data for ${symbol}`,
      source: 'market_data_api'
    };
  }
}

/**
 * MCP Tool Definitions for Trading Operations
 */
export const tradingTools = {
  get_symbols: {
    name: 'get_symbols',
    description: 'Get list of all supported trading symbols (71 symbols including BTC, ETH, SOL, etc.)',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: getSymbolsTool
  },

  get_market_data: {
    name: 'get_market_data',
    description: 'Get real-time market data for a specific symbol including price, volume, and changes',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading symbol (e.g., BTC, ETH, SOL)',
          required: true
        }
      },
      required: ['symbol']
    },
    handler: getMarketDataTool
  },

  whale_alerts: {
    name: 'whale_alerts',
    description: 'Get whale alerts showing large buy/sell orders from institutional traders',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading symbol',
          default: 'BTC'
        },
        exchange: {
          type: 'string',
          description: 'Exchange to monitor (e.g., hyperliquid, okx)',
          default: 'hyperliquid'
        },
        min_usd: {
          type: 'number',
          description: 'Minimum order size in USD',
          default: 1000000
        }
      }
    },
    handler: (params: any) => getUnifiedAdvancedTool({ op: 'whale_alerts', ...params })
  },

  market_sentiment: {
    name: 'market_sentiment',
    description: 'Analyze market sentiment based on funding rate, order flow, and institutional positioning',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading symbol',
          default: 'BTC'
        }
      }
    },
    handler: (params: any) => getUnifiedAdvancedTool({ op: 'market_sentiment', ...params })
  },

  multi_coin_screening: {
    name: 'multi_coin_screening',
    description: 'Screen multiple coins with 8-layer confluence analysis (SMC, EMA, RSI, MACD, Funding, OI, CVD, Fibo)',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of symbols to screen',
          default: ['BTC', 'ETH', 'SOL']
        },
        timeframe: {
          type: 'string',
          description: 'Timeframe for analysis',
          default: '15m'
        }
      }
    },
    handler: (params: any) => getUnifiedAdvancedTool({ op: 'multi_coin_screening', ...params })
  },

  new_listings: {
    name: 'new_listings',
    description: 'Find new token listings with volume spike detection and hidden gems scoring',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of listings to return',
          default: 20
        },
        maxMarketCap: {
          type: 'number',
          description: 'Maximum market cap filter (in USD)',
          default: 500000000
        },
        minVolumeChange: {
          type: 'number',
          description: 'Minimum volume change percentage',
          default: 50
        }
      }
    },
    handler: (params: any) => getUnifiedAdvancedTool({ op: 'new_listings', ...params })
  },

  volume_spikes: {
    name: 'volume_spikes',
    description: 'Detect volume spikes with whale activity and order flow analysis',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of spikes to return',
          default: 20
        }
      }
    },
    handler: (params: any) => getUnifiedAdvancedTool({ op: 'volume_spikes', ...params })
  },

  opportunities: {
    name: 'opportunities',
    description: 'Find trading opportunities using AI scoring (liquidity, momentum, risk, smart money, technical)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol to analyze (optional)',
        },
        minScore: {
          type: 'number',
          description: 'Minimum opportunity score (0-100)',
          default: 60
        }
      }
    },
    handler: (params: any) => getUnifiedAdvancedTool({ op: 'opportunities', ...params })
  },

  alpha_screening: {
    name: 'alpha_screening',
    description: 'Screen for alpha opportunities with fundamental, tokenomics, and narrative analysis',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol to screen',
          default: 'BTC'
        }
      }
    },
    handler: (params: any) => getUnifiedAdvancedTool({ op: 'alpha_screening', ...params })
  },

  micro_caps: {
    name: 'micro_caps',
    description: 'Find micro-cap gems with whale accumulation detection and potential multiplier estimation',
    inputSchema: {
      type: 'object',
      properties: {
        maxMarketCap: {
          type: 'number',
          description: 'Maximum market cap (in USD)',
          default: 100000000
        },
        minScore: {
          type: 'number',
          description: 'Minimum alpha score',
          default: 50
        },
        limit: {
          type: 'number',
          description: 'Number of results',
          default: 20
        },
        minVolumeChange: {
          type: 'number',
          description: 'Minimum volume change percentage',
          default: 30
        }
      }
    },
    handler: (params: any) => getUnifiedAdvancedTool({ op: 'micro_caps', ...params })
  }
};
