/**
 * Dual Telegram Bot System
 * 
 * Supports TWO separate Telegram bots:
 * 1. SYSTEM BOT - for system notifications, errors, alerts
 * 2. SIGNAL BOT - for trading signals only
 * 
 * Environment Variables:
 * - TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID (system notifications)
 * - TELEGRAM_SIGNAL_BOT_TOKEN & TELEGRAM_SIGNAL_CHAT_ID (trading signals)
 */

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export type BotType = 'system' | 'signal';

/**
 * Get Telegram configuration for specific bot type
 */
function getTelegramConfig(botType: BotType): TelegramConfig | null {
  let botToken: string | undefined;
  let chatId: string | undefined;
  
  if (botType === 'signal') {
    // Signal bot configuration
    botToken = process.env.TELEGRAM_SIGNAL_BOT_TOKEN;
    chatId = process.env.TELEGRAM_SIGNAL_CHAT_ID;
    
    // Fallback to system bot if signal bot not configured
    if (!botToken || !chatId) {
      console.warn('Signal bot not configured - falling back to system bot');
      botToken = process.env.TELEGRAM_BOT_TOKEN;
      chatId = process.env.TELEGRAM_CHAT_ID;
    }
  } else {
    // System bot configuration
    botToken = process.env.TELEGRAM_BOT_TOKEN;
    chatId = process.env.TELEGRAM_CHAT_ID;
  }
  
  if (!botToken || !chatId) {
    console.warn(`Telegram ${botType} bot not configured - BOT_TOKEN or CHAT_ID missing`);
    return null;
  }
  
  return { botToken, chatId };
}

/**
 * Send message to specific Telegram bot
 */
export async function sendTelegramMessage(
  text: string,
  botType: BotType = 'system',
  options: { 
    parseMode?: 'Markdown' | 'HTML'; 
    disablePreview?: boolean;
    silent?: boolean;
  } = {}
): Promise<boolean> {
  const config = getTelegramConfig(botType);
  if (!config) {
    console.log(`Telegram ${botType} bot not configured - message not sent:`, text.substring(0, 100) + '...');
    return false;
  }
  
  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    
    const payload = {
      chat_id: config.chatId,
      text,
      parse_mode: options.parseMode || 'Markdown',
      disable_web_page_preview: options.disablePreview || false,
      disable_notification: options.silent || false,
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Telegram ${botType} bot API error:`, response.status, errorData);
      return false;
    }
    
    const result = await response.json();
    if (result.ok) {
      console.log(`✅ Telegram ${botType} bot message sent successfully`);
      return true;
    } else {
      console.error(`Telegram ${botType} bot API returned error:`, result);
      return false;
    }
    
  } catch (error) {
    console.error(`Failed to send Telegram ${botType} bot message:`, error);
    return false;
  }
}

/**
 * Send SYSTEM notification (errors, alerts, reports)
 */
export async function sendSystemNotification(
  text: string,
  options?: { parseMode?: 'Markdown' | 'HTML'; disablePreview?: boolean; silent?: boolean }
): Promise<boolean> {
  return sendTelegramMessage(text, 'system', options);
}

/**
 * Send TRADING SIGNAL notification
 */
export async function sendTradingSignal(
  text: string,
  options?: { parseMode?: 'Markdown' | 'HTML'; disablePreview?: boolean; silent?: boolean }
): Promise<boolean> {
  return sendTelegramMessage(text, 'signal', options);
}

/**
 * Send system alert
 */
export async function sendSystemAlert(
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
): Promise<boolean> {
  const emojis = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  };
  
  const alert = [
    `${emojis[severity]} *${title}*`,
    '',
    message,
    '',
    `Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })} WIB`,
  ].join('\n');
  
  return sendSystemNotification(alert, { parseMode: 'Markdown' });
}

/**
 * Check bot configuration status
 */
export function getTelegramStatus(): {
  system: {
    configured: boolean;
    botToken: boolean;
    chatId: boolean;
  };
  signal: {
    configured: boolean;
    botToken: boolean;
    chatId: boolean;
  };
} {
  return {
    system: {
      configured: !!getTelegramConfig('system'),
      botToken: !!process.env.TELEGRAM_BOT_TOKEN,
      chatId: !!process.env.TELEGRAM_CHAT_ID,
    },
    signal: {
      configured: !!getTelegramConfig('signal'),
      botToken: !!process.env.TELEGRAM_SIGNAL_BOT_TOKEN,
      chatId: !!process.env.TELEGRAM_SIGNAL_CHAT_ID,
    },
  };
}

/**
 * Test both bots
 */
export async function testBothBots(): Promise<{
  system: boolean;
  signal: boolean;
}> {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  
  const systemMessage = [
    '🧪 *System Bot Test*',
    '',
    'This is a test message for the SYSTEM notification bot.',
    '',
    `Sent at: ${timestamp} WIB`,
  ].join('\n');
  
  const signalMessage = [
    '🎯 *Signal Bot Test*',
    '',
    'This is a test message for the SIGNAL trading bot.',
    '',
    `Sent at: ${timestamp} WIB`,
  ].join('\n');
  
  const systemResult = await sendSystemNotification(systemMessage, { parseMode: 'Markdown' });
  
  // Wait 1 second to avoid rate limit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const signalResult = await sendTradingSignal(signalMessage, { parseMode: 'Markdown' });
  
  return {
    system: systemResult,
    signal: signalResult,
  };
}
