#!/usr/bin/env node

/**
 * Crypto Trading Intelligence MCP Server
 *
 * This MCP server exposes crypto trading intelligence via stdio transport.
 * It wraps existing GPT Actions functionality without modifying the Express.js API.
 *
 * Features:
 * - GuardiansOfTheToken whale detection
 * - Multi-coin screening (8-layer confluence)
 * - Brain orchestrator AI analysis
 * - New listings & micro-caps discovery
 * - Volume spikes & whale alerts
 * - Market sentiment analysis
 *
 * Usage:
 *   node server/mcp/index.ts
 *
 * Or via Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "crypto-trading": {
 *         "command": "node",
 *         "args": ["/path/to/crypto-api/server/mcp/index.ts"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { mcpConfig } from './config.js';
import { guardiansTools } from './tools/guardians.tools.js';
import { tradingTools } from './tools/trading.tools.js';
import { brainTools } from './tools/brain.tools.js';

/**
 * Combine all tool definitions
 */
const allTools = {
  ...guardiansTools,
  ...tradingTools,
  ...brainTools,
};

/**
 * Convert tool definitions to MCP Tool format
 */
function getToolsList(): Tool[] {
  return Object.values(allTools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

/**
 * Main MCP Server
 */
class CryptoTradingMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: mcpConfig.name,
        version: mcpConfig.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: getToolsList(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      console.error(`[MCP Server] Tool called: ${name}`);

      const tool = allTools[name as keyof typeof allTools];

      if (!tool) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Unknown tool: ${name}`,
                available_tools: Object.keys(allTools),
              }, null, 2),
            },
          ],
        };
      }

      try {
        // Call the tool handler
        const result = await tool.handler(args || {});

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        console.error(`[MCP Server] Tool ${name} error:`, error);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: error.message || 'Tool execution failed',
                  tool: name,
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Server] Error:', error);
    };

    process.on('SIGINT', async () => {
      console.error('[MCP Server] Shutting down...');
      await this.server.close();
      process.exit(0);
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[MCP Server] Crypto Trading Intelligence MCP Server running on stdio');
    console.error(`[MCP Server] Version: ${mcpConfig.version}`);
    console.error(`[MCP Server] Tools available: ${Object.keys(allTools).length}`);
    console.error('[MCP Server] Ready to accept requests from Claude Desktop or MCP clients');
  }
}

/**
 * Start the MCP server
 */
async function main() {
  try {
    const server = new CryptoTradingMCPServer();
    await server.start();
  } catch (error) {
    console.error('[MCP Server] Fatal error:', error);
    process.exit(1);
  }
}

main();
