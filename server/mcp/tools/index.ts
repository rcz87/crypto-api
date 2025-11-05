/**
 * MCP Tools Index
 * Exports all available tools for the MCP server
 */

export { guardiansTools } from './guardians.tools.js';
export { tradingTools } from './trading.tools.js';
export { brainTools } from './brain.tools.js';

/**
 * Combined tools export for convenience
 */
import { guardiansTools } from './guardians.tools.js';
import { tradingTools } from './trading.tools.js';
import { brainTools } from './brain.tools.js';

export const allTools = {
  ...guardiansTools,
  ...tradingTools,
  ...brainTools,
};

/**
 * Get tools count by category
 */
export function getToolsStats() {
  return {
    guardians: Object.keys(guardiansTools).length,
    trading: Object.keys(tradingTools).length,
    brain: Object.keys(brainTools).length,
    total: Object.keys(allTools).length,
  };
}
