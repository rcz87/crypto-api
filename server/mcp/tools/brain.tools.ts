/**
 * Brain Orchestrator & AI Signal MCP Tools
 * Wraps AI-powered market intelligence and signal generation
 * Provides access to the Brain Orchestrator and AI Signal Engine
 */

import axios from 'axios';
import { mcpConfig } from '../config.js';

/**
 * Trigger brain analysis for specific symbols
 * Returns comprehensive AI-powered market intelligence
 */
export async function getBrainAnalysisTool(params: { symbols?: string[] }) {
  const { symbols = ['BTC', 'ETH', 'SOL'] } = params;

  try {
    const response = await axios.post(
      `${mcpConfig.nodeServiceUrl}/gpts/brain/analysis`,
      { symbols },
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
      source: 'brain_orchestrator'
    };
  } catch (error: any) {
    console.error('[MCP BrainTools] Brain analysis error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to run brain analysis',
      source: 'brain_orchestrator'
    };
  }
}

/**
 * Get recent brain orchestrator insights
 * Returns historical insights from the AI brain
 */
export async function getBrainInsightsTool(params: { limit?: number }) {
  const { limit = 10 } = params;

  try {
    const response = await axios.get(
      `${mcpConfig.nodeServiceUrl}/gpts/brain/insights`,
      {
        params: { limit },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MCP-Server/1.0'
        }
      }
    );

    return {
      success: true,
      data: response.data,
      source: 'brain_insights'
    };
  } catch (error: any) {
    console.error('[MCP BrainTools] Brain insights error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch brain insights',
      source: 'brain_insights'
    };
  }
}

/**
 * Get brain orchestrator statistics
 * Returns performance metrics and statistics
 */
export async function getBrainStatsTool() {
  try {
    const response = await axios.get(
      `${mcpConfig.nodeServiceUrl}/gpts/brain/stats`,
      {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MCP-Server/1.0'
        }
      }
    );

    return {
      success: true,
      data: response.data,
      source: 'brain_stats'
    };
  } catch (error: any) {
    console.error('[MCP BrainTools] Brain stats error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch brain stats',
      source: 'brain_stats'
    };
  }
}

/**
 * Get CoinAPI health status
 * Shows WebSocket connectivity and gap detection
 */
export async function getCoinAPIHealthTool() {
  try {
    const response = await axios.get(
      `${mcpConfig.nodeServiceUrl}/gpts/health/coinapi`,
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
      source: 'coinapi_health'
    };
  } catch (error: any) {
    console.error('[MCP BrainTools] CoinAPI health error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch CoinAPI health',
      source: 'coinapi_health'
    };
  }
}

/**
 * Get GPT Actions health status
 * Overall health check for all GPT endpoints
 */
export async function getGPTsHealthTool() {
  try {
    const response = await axios.get(
      `${mcpConfig.nodeServiceUrl}/gpts/health`,
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
      source: 'gpts_health'
    };
  } catch (error: any) {
    console.error('[MCP BrainTools] GPTs health error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to fetch GPTs health',
      source: 'gpts_health'
    };
  }
}

/**
 * MCP Tool Definitions for Brain Orchestrator & AI
 */
export const brainTools = {
  get_brain_analysis: {
    name: 'get_brain_analysis',
    description: 'Run AI-powered brain analysis for specified symbols. Returns comprehensive market intelligence with regime detection, confluence scoring, and actionable insights.',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Symbols to analyze',
          default: ['BTC', 'ETH', 'SOL']
        }
      }
    },
    handler: getBrainAnalysisTool
  },

  get_brain_insights: {
    name: 'get_brain_insights',
    description: 'Get recent insights from the brain orchestrator. Shows historical AI analysis and pattern detection results.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of insights to return',
          default: 10
        }
      }
    },
    handler: getBrainInsightsTool
  },

  get_brain_stats: {
    name: 'get_brain_stats',
    description: 'Get brain orchestrator performance statistics and metrics',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: getBrainStatsTool
  },

  get_coinapi_health: {
    name: 'get_coinapi_health',
    description: 'Check CoinAPI service health including WebSocket connectivity and gap detection',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: getCoinAPIHealthTool
  },

  get_gpts_health: {
    name: 'get_gpts_health',
    description: 'Check overall GPT Actions health status and Python service connectivity',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: getGPTsHealthTool
  }
};
