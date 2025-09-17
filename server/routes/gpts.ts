import type { Express, Request, Response } from 'express';
import fetch from 'node-fetch';
import { normalizePerp } from '../utils/symbols.js';

/**
 * Register GPT Actions routes - Gateway shim for unified endpoints
 * Maps Node.js routes to existing Python service routes
 */
export function registerGptsRoutes(app: Express): void {
  const PY_BASE = process.env.PY_BASE || 'http://127.0.0.1:8000';

  // Unified symbols endpoint - provide available symbols for GPT Actions
  app.get('/gpts/unified/symbols', async (req: Request, res: Response) => {
    try {
      // Instead of calling Python /symbols (which doesn't exist), return the available symbols
      // Based on the Python service symbol mapping
      const symbols = [
        // Major cryptocurrencies
        'BTC', 'ETH', 'SOL',
        // Layer 1 protocols
        'ADA', 'AVAX', 'DOT', 'ATOM', 'NEAR', 'ALGO', 'FTM', 'LUNA', 'ONE',
        // Layer 2 & Scaling solutions  
        'MATIC', 'ARB', 'OP', 'LRC',
        // DeFi tokens
        'UNI', 'SUSHI', 'AAVE', 'COMP', 'MKR', 'SNX', 'CRV', '1INCH', 'YFI',
        // Meme coins
        'DOGE', 'SHIB', 'PEPE', 'FLOKI',
        // Exchange tokens
        'BNB', 'CRO', 'FTT', 'LEO',
        // Privacy coins
        'XMR', 'ZEC', 'DASH',
        // Enterprise & utility tokens
        'LINK', 'VET', 'XLM', 'TRX', 'THETA', 'HBAR', 'ICP', 'EOS',
        // Gaming & NFT tokens
        'AXS', 'SAND', 'MANA', 'ENJ', 'CHZ',
        // AI & Infrastructure tokens
        'FET', 'OCEAN', 'AGIX', 'AR', 'FIL',
        // Other major altcoins
        'LTC', 'BCH', 'XRP', 'ETC', 'BSV', 'FLOW', 'APT', 'SUI', 'DYDX', 'GMX',
        // Stablecoins
        'USDT', 'USDC', 'DAI', 'BUSD'
      ];

      res.json({
        success: true,
        data: {
          symbols: symbols,
          total_count: symbols.length,
          categories: {
            major: ['BTC', 'ETH', 'SOL'],
            layer1: ['ADA', 'AVAX', 'DOT', 'ATOM', 'NEAR'],
            defi: ['UNI', 'SUSHI', 'AAVE', 'COMP', 'MKR'],
            meme: ['DOGE', 'SHIB', 'PEPE', 'FLOKI'],
            stablecoins: ['USDT', 'USDC', 'DAI', 'BUSD']
          }
        },
        timestamp: new Date().toISOString(),
        source: 'gpts_gateway_symbols_mapping'
      });

    } catch (error) {
      console.error('[GPTs Gateway] /gpts/unified/symbols error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve symbols',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Unified advanced endpoint - gateway to existing Python GPT Actions endpoint
  app.post('/gpts/unified/advanced', async (req: Request, res: Response) => {
    try {
      // Forward request to Python service with body and headers
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${PY_BASE}/gpts/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'GPTs-Gateway-Node'
        },
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[GPTs Gateway] /gpts/advanced failed: ${response.status} - ${errorText}`);
        
        return res.status(response.status).json({
          success: false,
          error: `Python service error: ${response.status}`,
          details: errorText,
          timestamp: new Date().toISOString()
        });
      }

      const data = await response.json();
      
      // Forward the response as-is since Python service already formats it properly
      res.json(data);

    } catch (error) {
      console.error('[GPTs Gateway] /gpts/unified/advanced error:', error);
      
      res.status(502).json({
        success: false,
        error: 'Gateway error - Python service unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Market data endpoint - provide commonly needed symbol information
  app.get('/gpts/unified/market/:symbol', async (req: Request, res: Response) => {
    try {
      const symbol = req.params.symbol?.toUpperCase();
      
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol parameter is required',
          timestamp: new Date().toISOString()
        });
      }

      // Forward to Python advanced ticker endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${PY_BASE}/advanced/ticker/${symbol}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GPTs-Gateway-Node'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[GPTs Gateway] market data for ${symbol} failed: ${response.status} - ${errorText}`);
        
        return res.status(response.status).json({
          success: false,
          error: `Market data unavailable for ${symbol}`,
          details: errorText,
          timestamp: new Date().toISOString()
        });
      }

      const data = await response.json();
      
      res.json({
        success: true,
        symbol: symbol,
        data: data,
        timestamp: new Date().toISOString(),
        source: 'coinglass_python_service'
      });

    } catch (error) {
      console.error(`[GPTs Gateway] market data error for ${req.params.symbol}:`, error);
      
      res.status(502).json({
        success: false,
        error: 'Gateway error - Market data service unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Institutional Bias endpoint - gateway to Python institutional bias service
  app.get('/gpts/institutional/bias', async (req: Request, res: Response) => {
    try {
      const rawSymbol = req.query.symbol as string;
      
      if (!rawSymbol) {
        return res.status(400).json({
          success: false,
          error: 'symbol parameter is required',
          timestamp: new Date().toISOString()
        });
      }

      // Normalize symbol to OKX perpetual format
      const symbol = normalizePerp(rawSymbol);
      console.log(`[GPTs Gateway] Fetching institutional bias for ${symbol} (normalized from ${rawSymbol})`);

      // Forward request to Python service
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${PY_BASE}/institutional/bias?symbol=${encodeURIComponent(symbol)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GPTs-Gateway-Node'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Handle 404 specifically
      if (response.status === 404) {
        const errorText = await response.text();
        console.warn(`[GPTs Gateway] institutional bias for ${symbol} not found: ${errorText}`);
        
        return res.status(404).json({
          success: false,
          error: 'Institutional bias data unavailable',
          symbol: symbol,
          details: errorText,
          timestamp: new Date().toISOString()
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[GPTs Gateway] institutional bias for ${symbol} failed: ${response.status} - ${errorText}`);
        
        return res.status(response.status).json({
          success: false,
          error: `Institutional bias data unavailable for ${symbol}`,
          details: errorText,
          timestamp: new Date().toISOString()
        });
      }

      // Check content type before parsing
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`[GPTs Gateway] Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}...`);
        
        return res.status(502).json({
          success: false,
          error: 'Invalid response format from Python service',
          details: `Expected JSON but got ${contentType}`,
          timestamp: new Date().toISOString()
        });
      }

      const data = await response.json();
      
      res.json({
        success: true,
        symbol: symbol,
        data: data,
        timestamp: new Date().toISOString(),
        source: 'coinglass_python_institutional_bias'
      });

    } catch (error) {
      console.error(`[GPTs Gateway] institutional bias error for ${req.query.symbol}:`, error);
      
      res.status(502).json({
        success: false,
        error: 'Gateway error - Institutional bias service unavailable',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Health check specific to GPTs gateway
  app.get('/gpts/health', async (req: Request, res: Response) => {
    try {
      // Test connectivity to Python service
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${PY_BASE}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GPTs-Gateway-Node'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const isHealthy = response.ok;
      
      res.status(isHealthy ? 200 : 503).json({
        success: isHealthy,
        service: 'gpts-gateway',
        python_service: {
          available: isHealthy,
          status: response.status,
          response_time_ms: isHealthy ? Date.now() : null
        },
        endpoints: [
          '/gpts/unified/symbols',
          '/gpts/unified/advanced',
          '/gpts/unified/market/:symbol',
          '/gpts/health'
        ],
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(503).json({
        success: false,
        service: 'gpts-gateway',
        error: 'Python service unreachable',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log(`🤖 GPTs Gateway routes registered: /gpts/unified/* → ${PY_BASE}`);
}