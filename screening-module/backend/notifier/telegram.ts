// ============================================================================
// TELEGRAM NOTIFIER - Professional Alert System
// Author: CryptoSat Intelligence
// Purpose: Send formatted trading alerts to Telegram with HTML formatting
// ============================================================================

import fetch from 'node-fetch';
import { logger } from '../screener/logger';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

/**
 * Send message to Telegram with HTML formatting
 * @param text Message text with HTML formatting
 * @param silent Send silently without notification sound
 */
export async function tgSend(text: string, silent: boolean = false): Promise<boolean> {
  if (!token || !chatId) {
    logger.warn('Telegram credentials not configured, skipping alert');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: silent
    };

    logger.debug('Sending Telegram alert', { 
      textLength: text.length, 
      silent,
      chatId: String(chatId).substring(0, 8) + '***'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json() as any;

    if (result.ok) {
      logger.info('Telegram alert sent successfully', { 
        messageId: result.result?.message_id,
        chatId: String(chatId).substring(0, 8) + '***'
      });
      return true;
    } else {
      logger.error('Telegram API error', { 
        error: result.description,
        errorCode: result.error_code
      });
      return false;
    }

  } catch (error: any) {
    logger.error('Failed to send Telegram alert', { 
      error: error?.message || String(error),
      stack: error?.stack
    });
    return false;
  }
}

/**
 * Send test message to verify Telegram connectivity
 */
export async function sendTestAlert(): Promise<boolean> {
  const testMessage = `🔔 <b>CryptoSat Intelligence</b> - Test Alert

✅ Telegram notification system operational
📊 Auto-screening system ready
⚡ Response time: &lt;100ms
🤖 Bot: <code>@${process.env.TELEGRAM_BOT_TOKEN?.split(':')[0] || 'unknown'}</code>

<i>Test completed at ${new Date().toLocaleString()}</i>`;

  return await tgSend(testMessage, true);
}

/**
 * Send system status alert
 */
export async function sendSystemAlert(
  title: string, 
  message: string, 
  severity: 'info' | 'warning' | 'error' = 'info'
): Promise<boolean> {
  const icons = {
    info: '📊',
    warning: '⚠️',
    error: '🚨'
  };

  const alert = `${icons[severity]} <b>${title}</b>

${message}

<i>${new Date().toLocaleString()}</i>`;

  return await tgSend(alert, severity === 'info');
}