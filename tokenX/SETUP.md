# 🚀 Setup Guide - Solana Auto Trading Bot

Panduan lengkap untuk setup dan menjalankan bot trading otomatis Solana.

## 📋 Prerequisites

### 1. **Node.js & NPM**
```bash
# Install Node.js (v16 atau lebih baru)
# Download dari: https://nodejs.org/

# Verify installation
node --version
npm --version
```

### 2. **Solana CLI (Optional)**
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"

# Verify installation
solana --version
```

## 🔧 Installation Steps

### 1. **Clone & Install Dependencies**
```bash
# Navigate to project directory
cd solana-auto-trading-bot

# Install all dependencies
npm install
```

### 2. **Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Edit .env file dengan text editor
nano .env
# atau
code .env
```

### 3. **Configure Environment Variables**

Edit file `.env` dengan settings berikut:

```env
# ==================== SOLANA CONFIGURATION ====================
# Basic RPC (Free)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com

# Private RPC (Recommended untuk speed)
PRIVATE_RPC_URL=https://your-private-rpc-endpoint.com
PRIVATE_WS_URL=wss://your-private-ws-endpoint.com

# ==================== WALLET CONFIGURATION ====================
# IMPORTANT: Use BURNER WALLET only!
PRIVATE_KEY=your-wallet-private-key-base58

# ==================== TRADING SETTINGS ====================
TRADE_AMOUNT_SOL=0.1
TAKE_PROFIT_PERCENT=30
STOP_LOSS_PERCENT=30
MIN_LIQUIDITY_SOL=5
MAX_SLIPPAGE_PERCENT=5
MIN_SCORE_TO_BUY=7
MAX_POSITIONS=10

# ==================== PRIORITY FEES ====================
BASE_PRIORITY_FEE=1000
MAX_PRIORITY_FEE=10000
COMPUTE_UNIT_LIMIT=200000

# ==================== API KEYS (Optional) ====================
BIRDEYE_API_KEY=your-birdeye-api-key
COINGECKO_API_KEY=your-coingecko-api-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id

# ==================== EMERGENCY CONTROLS ====================
EMERGENCY_STOP=false
LOG_LEVEL=info
```

## 🔑 API Keys Setup (Optional tapi Recommended)

### **Birdeye API** (Recommended)
1. Visit: https://birdeye.so/
2. Sign up for API access
3. Get your API key
4. Add to `.env`: `BIRDEYE_API_KEY=your-key`

### **Private RPC Providers** (Highly Recommended)

**Option 1: Chainstack**
```bash
# Visit: https://chainstack.com/
# Create account → Deploy Solana node
PRIVATE_RPC_URL=https://solana-mainnet.rpc.chainstack.com/your-key
```

**Option 2: QuickNode**
```bash
# Visit: https://www.quicknode.com/
# Create Solana endpoint
PRIVATE_RPC_URL=https://solana-mainnet.quiknode.pro/your-key
```

**Option 3: Helius**
```bash
# Visit: https://helius.xyz/
# Get RPC endpoint
PRIVATE_RPC_URL=https://rpc.helius.xyz/?api-key=your-key
```

## 💰 Wallet Setup

### **CRITICAL SECURITY NOTICE**
⚠️ **NEVER use your main wallet for trading bots!**

### **Create Burner Wallet**

**Method 1: Using Solana CLI**
```bash
# Generate new keypair
solana-keygen new --outfile bot-wallet.json

# Get public key
solana-keygen pubkey bot-wallet.json

# Get private key in base58 format
solana-keygen pubkey bot-wallet.json --output json
```

**Method 2: Using Phantom Wallet**
```bash
# Create new wallet in Phantom
# Export private key (Settings → Security & Privacy → Export Private Key)
# Convert to base58 format
```

**Method 3: Using Web3.js**
```javascript
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// Generate new keypair
const keypair = Keypair.generate();

console.log('Public Key:', keypair.publicKey.toString());
console.log('Private Key (base58):', bs58.encode(keypair.secretKey));
```

### **Fund Your Burner Wallet**
```bash
# Send SOL to your burner wallet
# Recommended: 1-5 SOL for testing
# For production: adjust based on your trading volume

# Check balance
solana balance YOUR_WALLET_ADDRESS
```

## 🧪 Testing

### **1. Test Connection**
```bash
# Test basic functionality
npm run test
```

### **2. Test Configuration**
```bash
# Start in development mode
npm run dev
```

### **3. Dry Run (Recommended)**
```bash
# Set EMERGENCY_STOP=true in .env for testing
# This prevents actual trading
EMERGENCY_STOP=true npm start
```

## 🚀 Running the Bot

### **Development Mode**
```bash
# Run with auto-restart on file changes
npm run dev
```

### **Production Mode**
```bash
# Run bot
npm start
```

### **Background Mode (Linux/Mac)**
```bash
# Run in background
nohup npm start > bot.log 2>&1 &

# Check if running
ps aux | grep node

# Stop background process
pkill -f "node src/index.js"
```

### **Using PM2 (Recommended for Production)**
```bash
# Install PM2
npm install -g pm2

# Start bot with PM2
pm2 start src/index.js --name "solana-bot"

# Monitor
pm2 status
pm2 logs solana-bot

# Stop
pm2 stop solana-bot

# Restart
pm2 restart solana-bot
```

## 📊 Monitoring

### **Real-time Logs**
```bash
# View live logs
tail -f logs/bot.log

# View trade logs only
tail -f logs/trades.log

# View errors only
tail -f logs/error.log
```

### **Log Files Location**
```
logs/
├── bot.log          # All logs
├── trades.log       # Trading activity
└── error.log        # Errors only
```

## ⚙️ Configuration Tuning

### **Conservative Settings** (Recommended for beginners)
```env
TRADE_AMOUNT_SOL=0.05
TAKE_PROFIT_PERCENT=20
STOP_LOSS_PERCENT=20
MIN_SCORE_TO_BUY=8
MAX_POSITIONS=5
```

### **Aggressive Settings** (For experienced users)
```env
TRADE_AMOUNT_SOL=0.2
TAKE_PROFIT_PERCENT=50
STOP_LOSS_PERCENT=40
MIN_SCORE_TO_BUY=6
MAX_POSITIONS=15
```

### **High-Speed Settings** (Requires private RPC)
```env
BASE_PRIORITY_FEE=5000
MAX_PRIORITY_FEE=50000
MAX_SLIPPAGE_PERCENT=10
```

## 🛠️ Troubleshooting

### **Common Issues**

**1. RPC Connection Errors**
```bash
# Test RPC endpoint
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  YOUR_RPC_URL

# Solution: Use private RPC or try different endpoint
```

**2. Transaction Failures**
```bash
# Check wallet balance
solana balance YOUR_WALLET_ADDRESS

# Solution: Add more SOL or reduce trade amount
```

**3. API Rate Limits**
```bash
# Check logs for rate limit errors
grep "429" logs/error.log

# Solution: Get API keys or reduce frequency
```

**4. Low Performance**
```bash
# Check latency
ping api.mainnet-beta.solana.com

# Solution: Use private RPC closer to your location
```

### **Debug Mode**
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Check specific component
DEBUG=TokenAnalyzer npm start
```

## 🔒 Security Checklist

- [ ] ✅ Using burner wallet (not main wallet)
- [ ] ✅ Limited SOL in trading wallet
- [ ] ✅ Private key stored securely
- [ ] ✅ Environment variables not committed to git
- [ ] ✅ Regular monitoring of bot activity
- [ ] ✅ Emergency stop mechanism tested
- [ ] ✅ Reasonable position limits set

## 📈 Performance Optimization

### **Speed Optimization**
1. **Use Private RPC** - Reduces latency by 80%+
2. **Increase Priority Fees** - Faster transaction inclusion
3. **Optimize Slippage** - Balance between speed and price
4. **Pre-signed Transactions** - Already implemented
5. **WebSocket Streaming** - Real-time data

### **Accuracy Optimization**
1. **Get API Keys** - Better data quality
2. **Tune Scoring Weights** - Adjust analysis criteria
3. **Monitor Performance** - Track win rate and adjust
4. **Backtesting** - Test strategies on historical data

## 🆘 Emergency Procedures

### **Emergency Stop**
```bash
# Method 1: Set environment variable
EMERGENCY_STOP=true

# Method 2: Kill process
pkill -f "node src/index.js"

# Method 3: PM2 stop
pm2 stop solana-bot
```

### **Manual Sell All Positions**
```javascript
// Connect to bot and execute
const bot = require('./src/index');
await bot.emergencyStop();
```

## 📞 Support

### **Self-Help Resources**
- 📖 README.md - Complete documentation
- 🐛 Check logs in `logs/` directory
- 🔍 Search issues on GitHub
- 📊 Monitor bot performance metrics

### **Community Support**
- 💬 Telegram: @your-telegram-group
- 🐦 Twitter: @your-twitter
- 📧 Email: support@your-domain.com

---

## 🎯 Quick Start Checklist

- [ ] 1. Install Node.js & dependencies (`npm install`)
- [ ] 2. Copy `.env.example` to `.env`
- [ ] 3. Create burner wallet & get private key
- [ ] 4. Fund wallet with SOL (1-5 SOL recommended)
- [ ] 5. Configure `.env` with wallet & RPC settings
- [ ] 6. Get API keys (Birdeye, private RPC)
- [ ] 7. Test connection (`npm run test`)
- [ ] 8. Start bot (`npm start`)
- [ ] 9. Monitor logs (`tail -f logs/bot.log`)
- [ ] 10. Adjust settings based on performance

**Happy Trading! 🚀**

*Remember: Only trade with funds you can afford to lose!*
