/**
 * Test-only endpoints for CoinAPI Alert System validation
 * WARNING: Only enable in development/testing environments
 */

import { Router } from 'express';
import { coinAPIWebSocket } from '../services/coinapiWebSocket';

const router = Router();

// Store original health state
let mockHealthState: any = null;
const originalGetHealth = coinAPIWebSocket.getHealth.bind(coinAPIWebSocket);

/**
 * Inject mock health state for testing alert pathways
 * POST /test/coinapi/inject-fault
 * Body: { type: "gap" | "recovery" | "latency" | "disconnect" }
 */
router.post('/coinapi/inject-fault', (req, res) => {
  const { type } = req.body;
  const baseline = originalGetHealth();
  
  switch (type) {
    case 'gap':
      mockHealthState = {
        ...baseline,
        gapStats: {
          ...baseline.gapStats,
          totalGapsDetected: baseline.gapStats.totalGapsDetected + 3,
          lastGapTime: Date.now()
        }
      };
      (coinAPIWebSocket as any).getHealth = () => mockHealthState;
      return res.json({ 
        success: true, 
        message: 'Gap detection state injected (+3 gaps)',
        state: mockHealthState.gapStats
      });
      
    case 'recovery':
      mockHealthState = {
        ...baseline,
        gapStats: {
          ...baseline.gapStats,
          totalGapsDetected: baseline.gapStats.totalGapsDetected + 2,
          recoveryTriggered: baseline.gapStats.recoveryTriggered + 1,
          lastGapTime: Date.now()
        }
      };
      (coinAPIWebSocket as any).getHealth = () => mockHealthState;
      return res.json({ 
        success: true, 
        message: 'Recovery trigger state injected (+1 recovery)',
        state: mockHealthState.gapStats
      });
      
    case 'latency':
      mockHealthState = {
        ...baseline,
        wsConnected: true,
        lastWsMessageTime: Date.now() - 15000 // 15s ago (exceeds 10s threshold)
      };
      (coinAPIWebSocket as any).getHealth = () => mockHealthState;
      return res.json({ 
        success: true, 
        message: 'Latency spike state injected (15s delay)',
        state: { 
          lastMessageTime: mockHealthState.lastWsMessageTime,
          delayMs: 15000
        }
      });
      
    case 'disconnect':
      mockHealthState = {
        ...baseline,
        wsConnected: false,
        reconnectAttempts: 3,
        restOrderbookOk: true
      };
      (coinAPIWebSocket as any).getHealth = () => mockHealthState;
      return res.json({ 
        success: true, 
        message: 'WebSocket disconnect state injected',
        state: {
          wsConnected: false,
          reconnectAttempts: 3
        }
      });
      
    default:
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid fault type. Use: gap, recovery, latency, or disconnect' 
      });
  }
});

/**
 * Restore original health state
 * POST /test/coinapi/restore
 */
router.post('/coinapi/restore', (_req, res) => {
  (coinAPIWebSocket as any).getHealth = originalGetHealth;
  mockHealthState = null;
  
  res.json({ 
    success: true, 
    message: 'Original health state restored',
    state: originalGetHealth()
  });
});

/**
 * Get current health state (real or mocked)
 * GET /test/coinapi/health
 */
router.get('/coinapi/health', (_req, res) => {
  const health = coinAPIWebSocket.getHealth();
  
  res.json({
    success: true,
    isMocked: mockHealthState !== null,
    health
  });
});

export default router;
