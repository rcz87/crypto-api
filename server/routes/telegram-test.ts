/**
 * Telegram Bot Testing Endpoint
 * 
 * Test both system and signal Telegram bots
 */

import { Router, Request, Response } from 'express';
import { getTelegramStatus, testBothBots } from '../observability/dualTelegram';

const router = Router();

/**
 * GET /api/telegram/status
 * 
 * Check configuration status of both Telegram bots
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = getTelegramStatus();
    
    res.json({
      success: true,
      data: {
        system_bot: {
          configured: status.system.configured,
          has_token: status.system.botToken,
          has_chat_id: status.system.chatId,
          env_vars: {
            token: 'TELEGRAM_BOT_TOKEN',
            chat_id: 'TELEGRAM_CHAT_ID'
          }
        },
        signal_bot: {
          configured: status.signal.configured,
          has_token: status.signal.botToken,
          has_chat_id: status.signal.chatId,
          env_vars: {
            token: 'TELEGRAM_SIGNAL_BOT_TOKEN',
            chat_id: 'TELEGRAM_SIGNAL_CHAT_ID'
          }
        },
        note: 'Signal bot will fallback to system bot if not configured separately'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Telegram Test] Status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Telegram status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/telegram/test
 * 
 * Send test messages to both bots
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    console.log('[Telegram Test] Sending test messages to both bots...');
    
    const results = await testBothBots();
    
    res.json({
      success: true,
      data: {
        system_bot: {
          sent: results.system,
          message: results.system 
            ? '✅ Test message sent to system bot'
            : '❌ Failed to send to system bot (check configuration)'
        },
        signal_bot: {
          sent: results.signal,
          message: results.signal
            ? '✅ Test message sent to signal bot'
            : '❌ Failed to send to signal bot (check configuration or using system bot fallback)'
        },
        note: 'Check your Telegram channels for test messages'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Telegram Test] Test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
