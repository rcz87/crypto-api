/**
 * Event Logging System - Telegram Helper
 * 
 * Handles sending reports and notifications to Telegram.
 * Uses environment variables TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
 */

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * Get Telegram configuration from environment
 */
function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken || !chatId) {
    console.warn('Telegram configuration missing - TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
    return null;
  }
  
  return { botToken, chatId };
}

/**
 * Send a message to Telegram
 */
export async function sendTelegram(
  text: string, 
  options: { 
    parseMode?: 'Markdown' | 'HTML'; 
    disablePreview?: boolean;
    silent?: boolean;
  } = {}
): Promise<boolean> {
  const config = getTelegramConfig();
  if (!config) {
    console.log('Telegram not configured - message not sent:', text.substring(0, 100) + '...');
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
      console.error('Telegram API error:', response.status, errorData);
      return false;
    }
    
    const result = await response.json();
    if (result.ok) {
      console.log('✅ Telegram message sent successfully');
      return true;
    } else {
      console.error('Telegram API returned error:', result);
      return false;
    }
    
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

/**
 * Send weekly scorecard report to Telegram
 */
export async function sendWeeklyScorecardReport(
  weekStart: string,
  bins: Record<string, { n: number; winrate: number }>,
  monotonicOk: boolean,
  additionalStats?: {
    totalSignals?: number;
    avgConfluence?: number;
    bestBin?: string;
    worstBin?: string;
  }
): Promise<boolean> {
  try {
    const emoji = monotonicOk ? '✅' : '❌';
    const status = monotonicOk ? 'OK' : 'Broken';
    
    // Format winrate as percentage
    const formatWinrate = (wr: number) => wr === 0 ? '-' : `${(wr * 100).toFixed(1)}%`;
    
    // Build message
    const lines = [
      `📊 *Weekly Scorecard Report*`,
      `Week starting: ${weekStart}`,
      ``,
      `*Winrate by Confluence Bins:*`,
    ];
    
    // Add bin data in ascending order
    const binOrder = ['0.50-0.59', '0.60-0.69', '0.70-0.79', '0.80+'];
    for (const binLabel of binOrder) {
      const binData = bins[binLabel] || { n: 0, winrate: 0 };
      lines.push(`• ${binLabel}: n=${binData.n}, winrate=${formatWinrate(binData.winrate)}`);
    }
    
    lines.push('');
    lines.push(`*Monotonicity Check:* ${emoji} ${status}`);
    
    // Add additional stats if provided
    if (additionalStats) {
      lines.push('');
      lines.push('*Additional Stats:*');
      if (additionalStats.totalSignals !== undefined) {
        lines.push(`• Total signals: ${additionalStats.totalSignals}`);
      }
      if (additionalStats.avgConfluence !== undefined) {
        lines.push(`• Avg confluence: ${additionalStats.avgConfluence.toFixed(2)}`);
      }
      if (additionalStats.bestBin) {
        lines.push(`• Best performing bin: ${additionalStats.bestBin}`);
      }
      if (additionalStats.worstBin) {
        lines.push(`• Worst performing bin: ${additionalStats.worstBin}`);
      }
    }
    
    // Add explanation if monotonicity is broken
    if (!monotonicOk) {
      lines.push('');
      lines.push('⚠️ *Monotonicity Issue Detected*');
      lines.push('Higher confluence bins should have higher winrates.');
      lines.push('Consider reviewing confluence scoring weights.');
    }
    
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })} WIB`);
    
    const message = lines.join('\n');
    
    return await sendTelegram(message, { parseMode: 'Markdown' });
    
  } catch (error) {
    console.error('Failed to send weekly scorecard report:', error);
    return false;
  }
}

/**
 * Send system alert to Telegram
 */
export async function sendSystemAlert(
  title: string,
  message: string,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
): Promise<boolean> {
  try {
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
    
    return await sendTelegram(alert, { parseMode: 'Markdown' });
    
  } catch (error) {
    console.error('Failed to send system alert:', error);
    return false;
  }
}

/**
 * Send test message to verify Telegram configuration
 */
export async function sendTestMessage(): Promise<boolean> {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  const message = [
    '🧪 *Event Logging System Test*',
    '',
    'This is a test message to verify Telegram integration.',
    '',
    `Sent at: ${timestamp} WIB`,
  ].join('\n');
  
  return await sendTelegram(message, { parseMode: 'Markdown' });
}

/**
 * Check if Telegram is properly configured
 */
export function isTelegramConfigured(): boolean {
  return getTelegramConfig() !== null;
}

/**
 * Get Telegram configuration status for monitoring
 */
export function getTelegramStatus(): {
  configured: boolean;
  botToken: boolean;
  chatId: boolean;
} {
  const config = getTelegramConfig();
  
  return {
    configured: config !== null,
    botToken: !!process.env.TELEGRAM_BOT_TOKEN,
    chatId: !!process.env.TELEGRAM_CHAT_ID,
  };
}