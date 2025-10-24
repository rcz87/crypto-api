# Dual Telegram Bot System - Setup Guide

**Status:** ✅ Implemented and Active  
**Date:** October 24, 2025

---

## Overview

Sistem ini mendukung **DUA bot Telegram terpisah**:

1. **🔔 System Bot** - Untuk notifikasi sistem, errors, alerts, monitoring
2. **📊 Signal Bot** - Untuk trading signals saja (high-quality signals)

Ini memungkinkan Anda untuk:
- Memisahkan sinyal trading dari notifikasi sistem
- Menggunakan channel berbeda untuk tujuan berbeda
- Mengurangi noise di channel trading signals
- Tetap mendapatkan alerts sistem di channel terpisah

---

## Quick Status Check

```bash
# Check konfigurasi kedua bot
curl http://localhost:5000/api/telegram/status | jq

# Test kirim pesan ke kedua bot
curl -X POST http://localhost:5000/api/telegram/test | jq
```

---

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# System Notification Bot (REQUIRED)
# Untuk: errors, alerts, system messages, weekly reports
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_CHAT_ID="-1001234567890"

# Signal Bot (OPTIONAL)
# Untuk: trading signals only
# Jika tidak diset, akan fallback ke system bot
TELEGRAM_SIGNAL_BOT_TOKEN="987654321:XYZabcDEFghiJKLmnoPQRstu"
TELEGRAM_SIGNAL_CHAT_ID="-1009876543210"
```

### Setup Instructions

#### 1. Create Telegram Bots

**System Bot (Required):**
1. Open Telegram and message [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Follow instructions to create bot (e.g., "My Crypto System Bot")
4. Copy the bot token (format: `123456789:ABCdefGHI...`)
5. Set as `TELEGRAM_BOT_TOKEN`

**Signal Bot (Optional but Recommended):**
1. Message [@BotFather](https://t.me/botfather) again
2. Send `/newbot`
3. Create another bot (e.g., "My Crypto Signals Bot")
4. Copy the bot token
5. Set as `TELEGRAM_SIGNAL_BOT_TOKEN`

#### 2. Get Chat IDs

**For Private Chat:**
1. Start a conversation with your bot
2. Send any message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find `"chat":{"id": -1234567890}` in the response
5. Copy the chat ID (include the minus sign if present)

**For Group/Channel:**
1. Add your bot to the group/channel
2. Make bot an admin (for channels)
3. Send a message in the group
4. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. Find the chat ID in the response
6. Group IDs start with `-` (e.g., `-1001234567890`)

#### 3. Update Environment

Edit your `.env` file:

```bash
# System Bot (notifikasi sistem)
TELEGRAM_BOT_TOKEN="your_system_bot_token_here"
TELEGRAM_CHAT_ID="your_system_chat_id_here"

# Signal Bot (trading signals)
TELEGRAM_SIGNAL_BOT_TOKEN="your_signal_bot_token_here"
TELEGRAM_SIGNAL_CHAT_ID="your_signal_chat_id_here"
```

#### 4. Restart Service

```bash
sudo systemctl restart node_service

# Verify configuration
curl http://localhost:5000/api/telegram/status | jq

# Send test messages
curl -X POST http://localhost:5000/api/telegram/test | jq
```

---

## What Gets Sent Where

### 🔔 System Bot Receives:

- ❌ System errors and exceptions
- ⚠️ Service health alerts
- 📊 Weekly scorecard reports
- 🔄 Circuit breaker status changes
- 💾 Memory warnings
- 🚨 Critical system alerts
- ✅ Service restart notifications

**Example Messages:**
```
❌ CoinGlass Service Error
Circuit breaker is open due to consecutive failures

📊 Weekly Scorecard Report
Week starting: 2025-10-17
Winrate by Confluence Bins:
• 0.50-0.59: n=5, winrate=40.0%
• 0.60-0.69: n=8, winrate=62.5%
...
```

### 📊 Signal Bot Receives:

- 🎯 High-quality trading signals (confidence ≥ threshold)
- 🟢 LONG signals with analysis
- 🔴 SHORT signals with analysis
- 📈 Market context and indicators
- 💡 AI reasoning for signals

**Example Messages:**
```
🎯 Enhanced AI Signal

Symbol: SOL
Direction: 🟢 LONG
Confidence: 78.5%

📊 Market Context:
• Funding: -0.05%
• OI Change: +12.3%
• Volume Δ: +45.2%
• Boost: +8.5%

💡 Reasoning:
Strong bullish confluence detected...

⚡ Factors:
• Positive funding rate divergence
• Increasing open interest
• Volume surge above average
```

---

## Fallback Behavior

Jika `TELEGRAM_SIGNAL_BOT_TOKEN` tidak diset:
- ✅ System bot akan digunakan untuk SEMUA notifikasi
- ⚠️ Trading signals akan masuk ke system bot
- 📢 Anda akan melihat warning di logs:
  ```
  ⚠️ Signal bot not configured - falling back to system bot
  ```

Ini berguna untuk:
- Development/testing (cukup satu bot)
- Setup awal (konfigurasi bertahap)
- Backup jika signal bot down

---

## API Endpoints

### GET /api/telegram/status

Check configuration status of both bots.

**Response:**
```json
{
  "success": true,
  "data": {
    "system_bot": {
      "configured": true,
      "has_token": true,
      "has_chat_id": true,
      "env_vars": {
        "token": "TELEGRAM_BOT_TOKEN",
        "chat_id": "TELEGRAM_CHAT_ID"
      }
    },
    "signal_bot": {
      "configured": true,
      "has_token": true,
      "has_chat_id": true,
      "env_vars": {
        "token": "TELEGRAM_SIGNAL_BOT_TOKEN",
        "chat_id": "TELEGRAM_SIGNAL_CHAT_ID"
      }
    },
    "note": "Signal bot will fallback to system bot if not configured separately"
  }
}
```

### POST /api/telegram/test

Send test messages to both bots.

**Response:**
```json
{
  "success": true,
  "data": {
    "system_bot": {
      "sent": true,
      "message": "✅ Test message sent to system bot"
    },
    "signal_bot": {
      "sent": true,
      "message": "✅ Test message sent to signal bot"
    },
    "note": "Check your Telegram channels for test messages"
  }
}
```

---

## Code Implementation

### Sending System Notifications

```typescript
import { sendSystemNotification, sendSystemAlert } from './server/observability/dualTelegram';

// Simple notification
await sendSystemNotification('System restarted successfully ✅');

// Alert with severity
await sendSystemAlert(
  'High Memory Usage',
  'Memory usage has reached 85%. Consider restarting services.',
  'warning'
);
```

### Sending Trading Signals

```typescript
import { sendTradingSignal } from './server/observability/dualTelegram';

const signal = `
🎯 <b>Enhanced AI Signal</b>

<b>Symbol:</b> BTC
<b>Direction:</b> 🟢 LONG
<b>Confidence:</b> 85.5%

📊 <b>Market Context:</b>
• Funding: +0.12%
• OI Change: +8.5%
• Volume: Above average
`;

await sendTradingSignal(signal, { parseMode: 'HTML' });
```

---

## Architecture

### File Structure

```
server/
├── observability/
│   ├── telegram.ts              # OLD: Single bot (deprecated)
│   └── dualTelegram.ts          # NEW: Dual bot system
├── schedulers/
│   └── enhancedSignalMonitor.ts # Uses sendTradingSignal()
└── routes/
    └── telegram-test.ts         # Test endpoints
```

### Key Functions

**dualTelegram.ts:**
- `sendSystemNotification()` - Send to system bot
- `sendTradingSignal()` - Send to signal bot
- `sendSystemAlert()` - Send alert to system bot
- `getTelegramStatus()` - Check bot configuration
- `testBothBots()` - Send test messages

**enhancedSignalMonitor.ts:**
- Updated to use `sendTradingSignal()` instead of `sendTelegram()`
- Rate limiting (1 second between messages)
- Alert cooldown (5 minutes per symbol)

---

## Testing

### Manual Testing

```bash
# 1. Check status
curl http://localhost:5000/api/telegram/status | jq

# Should show:
# - system_bot.configured: true
# - signal_bot.configured: true (or false if using fallback)

# 2. Send test messages
curl -X POST http://localhost:5000/api/telegram/test | jq

# Should show:
# - system_bot.sent: true
# - signal_bot.sent: true

# 3. Check Telegram
# You should receive 2 messages:
# - "🧪 System Bot Test" in system channel
# - "🎯 Signal Bot Test" in signal channel
```

### Automated Testing

```bash
# Run test script
./test-all-endpoints.sh

# Check logs for Telegram activity
sudo journalctl -u node_service -f | grep Telegram
```

---

## Troubleshooting

### Issue: "Telegram not configured"

**Problem:** Bot token or chat ID not set

**Solution:**
```bash
# Check environment variables
env | grep TELEGRAM

# Should show:
# TELEGRAM_BOT_TOKEN=...
# TELEGRAM_CHAT_ID=...
# TELEGRAM_SIGNAL_BOT_TOKEN=... (optional)
# TELEGRAM_SIGNAL_CHAT_ID=... (optional)

# If missing, add to .env and restart
sudo systemctl restart node_service
```

### Issue: "Failed to send message"

**Possible causes:**
1. Invalid bot token
2. Invalid chat ID
3. Bot not added to group/channel
4. Bot not admin (for channels)
5. Network connectivity

**Solution:**
```bash
# Test bot token manually
curl https://api.telegram.org/bot<TOKEN>/getMe

# Should return bot info if valid

# Test sending message manually
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "<CHAT_ID>", "text": "Test"}'
```

### Issue: Messages going to wrong bot

**Problem:** Signal messages appearing in system channel

**Check:**
```bash
# Verify configuration
curl http://localhost:5000/api/telegram/status | jq

# If signal_bot.configured is false:
# - Fallback is active
# - All messages go to system bot

# Solution: Set TELEGRAM_SIGNAL_BOT_TOKEN and TELEGRAM_SIGNAL_CHAT_ID
```

---

## Best Practices

### 1. Use Separate Channels

✅ **Recommended:**
- System Bot → Admin channel (errors, alerts)
- Signal Bot → Trading channel (signals only)

❌ **Not Recommended:**
- Both bots → Same channel (too much noise)

### 2. Bot Naming

Use descriptive names:
- "MyProject System Bot" (for system notifications)
- "MyProject Signals Bot" (for trading signals)

### 3. Rate Limiting

The system has built-in rate limiting:
- 1 second between messages (prevent Telegram API rate limit)
- 5 minutes cooldown per symbol (prevent spam)

### 4. Message Formatting

Use HTML or Markdown for better readability:
```typescript
// HTML (recommended for complex formatting)
await sendTradingSignal(message, { parseMode: 'HTML' });

// Markdown (simpler)
await sendSystemNotification(message, { parseMode: 'Markdown' });
```

### 5. Monitoring

Regularly check bot status:
```bash
# Add to monitoring script
curl -s http://localhost:5000/api/telegram/status | \
  jq '.data.system_bot.configured, .data.signal_bot.configured'
```

---

## Migration from Single Bot

If you were using the old single-bot system:

### 1. Backup Current Config

```bash
# Save current bot token
echo "OLD_TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN" >> .env.backup
echo "OLD_TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID" >> .env.backup
```

### 2. Keep System Bot

Your existing bot becomes the system bot:
```bash
# .env - Keep these as-is
TELEGRAM_BOT_TOKEN="existing_token"
TELEGRAM_CHAT_ID="existing_chat_id"
```

### 3. Add Signal Bot (Optional)

```bash
# .env - Add new signal bot
TELEGRAM_SIGNAL_BOT_TOKEN="new_signal_bot_token"
TELEGRAM_SIGNAL_CHAT_ID="new_signal_chat_id"
```

### 4. No Code Changes Needed

The system automatically:
- Uses dual bot system if signal bot configured
- Falls back to system bot if signal bot not configured
- Maintains backward compatibility

---

## Summary

✅ **What's Working:**
- Dual Telegram bot system implemented
- System bot for notifications (errors, alerts, reports)
- Signal bot for trading signals
- Automatic fallback if signal bot not configured
- Test endpoints for verification
- Production-ready and deployed

✅ **Benefits:**
- Clean separation of concerns
- Reduced noise in trading channel
- Better organization
- Easy to manage and monitor
- Backward compatible

✅ **Next Steps:**
1. Add `TELEGRAM_SIGNAL_BOT_TOKEN` to your `.env`
2. Add `TELEGRAM_SIGNAL_CHAT_ID` to your `.env`
3. Restart service: `sudo systemctl restart node_service`
4. Test both bots: `curl -X POST http://localhost:5000/api/telegram/test`
5. Monitor logs for Telegram activity

---

**Documentation:** DUAL_TELEGRAM_BOT_SETUP.md  
**Implementation:** server/observability/dualTelegram.ts  
**Test Endpoints:** server/routes/telegram-test.ts  
**Status:** ✅ PRODUCTION READY
