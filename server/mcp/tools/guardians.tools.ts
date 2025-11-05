/**
 * GuardiansOfTheToken MCP Tools
 * Wraps GuardiansOfTheToken API functionality for MCP protocol
 * These tools provide the same functionality as GPT Actions but via MCP stdio
 */

import axios from 'axios';
import { mcpConfig } from '../config.js';

export interface GuardiansToolParams {
  symbol?: string;
  timeframe?: string;
  operation?: 'scan' | 'monitor';
  mode?: 'single' | 'continuous';
  coins?: string[];
}

/**
 * Get whale data from CoinGlass/GuardiansOfTheToken
 * Detects whale accumulation and distribution patterns
 */
export async function getWhaleDataTool(params: GuardiansToolParams) {
  const { symbol = 'BTC', timeframe = '1h' } = params;

  try {
    const response = await axios.post(
      `${mcpConfig.nodeServiceUrl}/gpts/coinglass/whale-data`,
      {
        symbol,
        timeframe,
        operation: params.operation || 'scan',
        mode: params.mode || 'single',
        coins: params.coins || [symbol]
      },
      {
        timeout: mcpConfig.pythonServiceTimeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MCP-Server/1.0'
        }
      }
    );

    return {
      success: true,
      data: response.data,
      source: 'coinglass_guardians_api'
    };
  } catch (error: any) {
    console.error('[MCP GuardiansTools] Whale data error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch whale data',
      source: 'coinglass_guardians_api'
    };
  }
}

/**
 * Get live template for whale signals
 * Returns formatted markdown alerts for trading signals
 */
export async function getLiveTemplateTool(params: { coin?: string; template_type?: string }) {
  const { coin = 'BTC', template_type = 'accumulation_watch' } = params;

  try {
    const response = await axios.post(
      `${mcpConfig.nodeServiceUrl}/gpts/coinglass/live-template`,
      {
        coin,
        template_type
      },
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
      source: 'coinglass_live_template'
    };
  } catch (error: any) {
    console.error('[MCP GuardiansTools] Live template error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to generate live template',
      source: 'coinglass_live_template'
    };
  }
}

/**
 * Get institutional bias data
 * Shows where smart money is positioned
 */
export async function getInstitutionalBiasTool(params: { symbol: string }) {
  const { symbol } = params;

  if (!symbol) {
    return {
      success: false,
      error: 'Symbol parameter is required',
      source: 'institutional_bias'
    };
  }

  try {
    const response = await axios.get(
      `${mcpConfig.nodeServiceUrl}/gpts/institutional/bias`,
      {
        params: { symbol },
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
      source: 'institutional_bias_coinglass'
    };
  } catch (error: any) {
    console.error('[MCP GuardiansTools] Institutional bias error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch institutional bias',
      source: 'institutional_bias_coinglass'
    };
  }
}

/**
 * MCP Tool Definitions for GuardiansOfTheToken
 * These will be exposed via MCP protocol
 */
export const guardiansTools = {
  get_whale_data: {
    name: 'get_whale_data',
    description: 'Detect whale activity and accumulation/distribution patterns from CoinGlass/GuardiansOfTheToken API. Supports real-time whale monitoring.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading symbol (e.g., BTC, ETH, SOL)',
          default: 'BTC'
        },
        timeframe: {
          type: 'string',
          description: 'Timeframe for analysis (e.g., 1h, 4h, 1d)',
          default: '1h'
        },
        operation: {
          type: 'string',
          enum: ['scan', 'monitor'],
          description: 'Operation mode: scan (single check) or monitor (continuous)',
          default: 'scan'
        },
        mode: {
          type: 'string',
          enum: ['single', 'continuous'],
          description: 'Execution mode',
          default: 'single'
        }
      }
    },
    handler: getWhaleDataTool
  },

  get_live_template: {
    name: 'get_live_template',
    description: 'Generate professional live template for whale signals with formatted markdown alerts',
    inputSchema: {
      type: 'object',
      properties: {
        coin: {
          type: 'string',
          description: 'Coin symbol (e.g., BTC, ETH, SOL)',
          default: 'BTC'
        },
        template_type: {
          type: 'string',
          description: 'Template type (e.g., accumulation_watch, distribution_alert)',
          default: 'accumulation_watch'
        }
      }
    },
    handler: getLiveTemplateTool
  },

  get_institutional_bias: {
    name: 'get_institutional_bias',
    description: 'Get institutional positioning and bias analysis from GuardiansOfTheToken/CoinGlass',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading symbol (e.g., BTC-USDT-SWAP)',
          required: true
        }
      },
      required: ['symbol']
    },
    handler: getInstitutionalBiasTool
  }
};
