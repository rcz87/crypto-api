#!/usr/bin/env node

/**
 * Telegram Alert Service
 *
 * Sends critical system alerts via Telegram Bot
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Get bot token
 * 3. Get your chat ID by messaging bot and checking https://api.telegram.org/bot<TOKEN>/getUpdates
 * 4. Set environment variables:
 *    TELEGRAM_BOT_TOKEN=your_bot_token
 *    TELEGRAM_CHAT_ID=your_chat_id
 *
 * Usage:
 *   import { sendTelegramAlert } from './telegram-alerter.js';
 *   await sendTelegramAlert('🚨 Service down!');
 */

import https from 'https';

const CONFIG = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  ENABLED: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
};

/**
 * Send alert message to Telegram
 * @param {string} message - Message to send
 * @param {object} options - Additional options
 * @returns {Promise<boolean>} - Success status
 */
export async function sendTelegramAlert(message, options = {}) {
  if (!CONFIG.ENABLED) {
    console.log('⚠️  Telegram not configured, skipping alert');
    return false;
  }

  const {
    parseMode = 'HTML',
    disableNotification = false,
    priority = 'normal', // 'low', 'normal', 'high'
  } = options;

  // Add priority emoji
  const priorityEmoji = {
    low: 'ℹ️',
    normal: '🔔',
    high: '🚨',
  };

  const formattedMessage = `${priorityEmoji[priority] || '🔔'} ${message}`;

  try {
    const payload = JSON.stringify({
      chat_id: CONFIG.CHAT_ID,
      text: formattedMessage,
      parse_mode: parseMode,
      disable_notification: disableNotification,
    });

    const response = await sendTelegramRequest('/sendMessage', payload);

    if (response.ok) {
      console.log('✅ Telegram alert sent successfully');
      return true;
    } else {
      console.error('❌ Telegram API error:', response.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to send Telegram alert:', error.message);
    return false;
  }
}

/**
 * Send HTTP request to Telegram Bot API
 * @param {string} endpoint - API endpoint
 * @param {string} payload - JSON payload
 * @returns {Promise<object>} - API response
 */
function sendTelegramRequest(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${CONFIG.BOT_TOKEN}${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(new Error('Invalid JSON response from Telegram'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Telegram request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Send service health alert
 */
export async function sendServiceAlert(serviceName, status, details = {}) {
  const emoji = status === 'up' ? '✅' : '❌';
  const message = `
<b>${emoji} ${serviceName}</b>
Status: <code>${status.toUpperCase()}</code>
${details.error ? `Error: ${details.error}` : ''}
${details.uptime ? `Uptime: ${details.uptime}` : ''}
${details.memory ? `Memory: ${details.memory}` : ''}
Time: ${new Date().toISOString()}
  `.trim();

  return sendTelegramAlert(message, {
    priority: status === 'up' ? 'normal' : 'high',
  });
}

/**
 * Send error alert
 */
export async function sendErrorAlert(error, context = {}) {
  const message = `
<b>🚨 Error Alert</b>

<b>Error:</b> ${error.message || error}
${error.stack ? `\n<b>Stack:</b>\n<code>${error.stack.slice(0, 500)}</code>` : ''}

${context.endpoint ? `<b>Endpoint:</b> ${context.endpoint}` : ''}
${context.user ? `<b>User:</b> ${context.user}` : ''}
${context.ip ? `<b>IP:</b> ${context.ip}` : ''}

<b>Time:</b> ${new Date().toISOString()}
  `.trim();

  return sendTelegramAlert(message, { priority: 'high' });
}

/**
 * Send performance alert
 */
export async function sendPerformanceAlert(metric, value, threshold, unit = '') {
  const message = `
<b>⚠️ Performance Alert</b>

<b>Metric:</b> ${metric}
<b>Current:</b> ${value}${unit}
<b>Threshold:</b> ${threshold}${unit}
<b>Status:</b> ${value > threshold ? 'EXCEEDED' : 'WARNING'}

<b>Time:</b> ${new Date().toISOString()}
  `.trim();

  return sendTelegramAlert(message, { priority: 'high' });
}

/**
 * Send trading signal alert
 */
export async function sendTradingSignalAlert(signal) {
  const directionEmoji = signal.direction === 'long' ? '📈' : '📉';
  const message = `
<b>${directionEmoji} Trading Signal</b>

<b>Symbol:</b> ${signal.symbol}
<b>Direction:</b> ${signal.direction.toUpperCase()}
<b>Confidence:</b> ${signal.confidence}%
<b>Strength:</b> ${signal.strength}/100

<b>Entry:</b> $${signal.entry_price}
<b>Stop Loss:</b> $${signal.stop_loss}
<b>Take Profit:</b> $${signal.take_profit}

<b>Reasoning:</b>
${signal.reasoning || 'Multi-layer confluence analysis'}

<b>Time:</b> ${new Date().toISOString()}
  `.trim();

  return sendTelegramAlert(message, { priority: 'normal' });
}

/**
 * Test Telegram configuration
 */
export async function testTelegramSetup() {
  console.log('🧪 Testing Telegram configuration...\n');

  if (!CONFIG.ENABLED) {
    console.error('❌ Telegram not configured!');
    console.error('   Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
    return false;
  }

  console.log('✅ Config found:');
  console.log(`   Token: ${CONFIG.BOT_TOKEN.slice(0, 10)}...`);
  console.log(`   Chat ID: ${CONFIG.CHAT_ID}\n`);

  console.log('📤 Sending test message...');
  const success = await sendTelegramAlert(
    '✅ Telegram Alert System Test\n\nThis is a test message from your Crypto API system.',
    { priority: 'normal' }
  );

  if (success) {
    console.log('\n✅ Test successful! Check your Telegram for the message.');
  } else {
    console.log('\n❌ Test failed! Check bot token and chat ID.');
  }

  return success;
}

// CLI test mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const testMode = process.argv[2] === 'test';

  if (testMode) {
    testTelegramSetup()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node telegram-alerter.js test');
    process.exit(1);
  }
}
