# 🚀 Solana Auto Trading Bot - High Frequency Meme Coin Scalper

Bot trading otomatis berkecepatan tinggi untuk meme coin di ekosistem Solana dengan analisis multi-kriteria dan eksekusi lightning-fast.

## ✨ Fitur Utama

### 🎯 **Fully Automatic Trading**
- ✅ Deteksi token baru secara real-time
- ✅ Analisis otomatis (harga, whale, teknikal)
- ✅ Buy/Sell otomatis berdasarkan scoring system
- ✅ Risk management dengan stop-loss & take-profit

### ⚡ **High-Speed Execution**
- ✅ Pre-signed transactions untuk kecepatan maksimal
- ✅ Priority fee management dinamis
- ✅ Direct RPC connection dengan latensi ultra-rendah
- ✅ MEV protection dan anti-frontrunning

### 🔍 **Advanced Analysis Engine**
- ✅ Multi-criteria scoring (0-10 scale)
- ✅ Rug pull detection & security checks
- ✅ Whale activity tracking
- ✅ Technical indicators analysis
- ✅ Timing & momentum analysis

### 🛡️ **Risk Management**
- ✅ Auto stop-loss pada -30%
- ✅ Auto take-profit pada +30%
- ✅ Position sizing (0.1 SOL per trade)
- ✅ Maximum position limits
- ✅ Emergency stop mechanism

## 📊 Trading Strategy

**Scalping Strategy - High Frequency, Low Risk**
- **Amount per trade**: 0.1 SOL
- **Take Profit**: +30% (auto-sell)
- **Stop Loss**: -30% (auto-sell)
- **Min Score to Buy**: 7/10
- **Max Positions**: 10 concurrent

## 🏗️ Arsitektur System

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Event         │    │   Token         │    │   Auto          │
│   Listener      │───▶│   Analyzer      │───▶│   Trader        │
│                 │    │                 │    │                 │
│ • Raydium       │    │ • Liquidity     │    │ • Buy Logic     │
│ • Orca          │    │ • Security      │    │ • Sell Logic    │
│ • Jupiter       │    │ • Whale Track   │    │ • Risk Mgmt     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Solana        │    │   Transaction   │    │   Monitoring    │
│   Connection    │    │   Builder       │    │   & Logging     │
│                 │    │                 │    │                 │
│ • RPC Private   │    │ • Jupiter API   │    │ • Performance   │
│ • WebSocket     │    │ • Priority Fee  │    │ • Trade History │
│ • Low Latency   │    │ • Pre-signed    │    │ • Statistics    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. **Setup Environment**

```bash
# Clone repository
git clone <repository-url>
cd solana-auto-trading-bot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 2. **Configure Settings**

Edit `.env` file:

```env
# Solana Configuration
PRIVATE_KEY=your-wallet-private-key-base58
PRIVATE_RPC_URL=https://your-private-rpc-endpoint.com

# Trading Settings
TRADE_AMOUNT_SOL=0.1
TAKE_PROFIT_PERCENT=30
STOP_LOSS_PERCENT=30
MIN_SCORE_TO_BUY=7

# Priority Fees
BASE_PRIORITY_FEE=1000
MAX_PRIORITY_FEE=10000
```

### 3. **Start Trading**

```bash
# Start bot
npm start

# Development mode
npm run dev
```

## 📋 Configuration Guide

### **Trading Parameters**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `TRADE_AMOUNT_SOL` | 0.1 | Amount SOL per trade |
| `TAKE_PROFIT_PERCENT` | 30 | Auto-sell profit target |
| `STOP_LOSS_PERCENT` | 30 | Auto-sell loss limit |
| `MIN_SCORE_TO_BUY` | 7 | Minimum analysis score |
| `MAX_POSITIONS` | 10 | Maximum concurrent positions |

### **Analysis Scoring System**

Bot menggunakan weighted scoring system (0-10):

- **Liquidity Analysis** (25%): Strength of token liquidity
- **Security Analysis** (30%): Rug pull detection & safety
- **Whale Analysis** (20%): Smart money activity tracking  
- **Technical Analysis** (15%): Price & volume indicators
- **Timing Analysis** (10%): Launch timing & momentum

**Buy Trigger**: Total score ≥ 7/10

### **Risk Management**

- ✅ **Position Limits**: Maximum 10 concurrent positions
- ✅ **Stop Loss**: Automatic sell at -30% loss
- ✅ **Take Profit**: Automatic sell at +30% profit
- ✅ **Emergency Stop**: Manual override untuk stop semua trading
- ✅ **Rug Pull Detection**: Security checks sebelum buy

## 🔧 Advanced Configuration

### **Private RPC Setup**

Untuk performa optimal, gunakan private RPC:

```env
# Recommended providers:
PRIVATE_RPC_URL=https://solana-mainnet.rpc.chainstack.com/your-key
PRIVATE_RPC_URL=https://solana-mainnet.quiknode.pro/your-key
PRIVATE_RPC_URL=https://rpc.helius.xyz/?api-key=your-key
```

### **Priority Fee Optimization**

```env
# Dynamic priority fees untuk fast execution
BASE_PRIORITY_FEE=1000      # Base fee (microlamports)
MAX_PRIORITY_FEE=10000      # Maximum fee limit
COMPUTE_UNIT_LIMIT=200000   # Compute budget
```

### **DEX Configuration**

Bot mendukung multiple DEX:

```env
# Program IDs
RAYDIUM_PROGRAM_ID=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8
ORCA_PROGRAM_ID=9W959DqEETiGZocYWCQPaJ6sD6MUGLiAZH6Aq7TZjTa
JUPITER_API_URL=https://quote-api.jup.ag/v6
```

## 📊 Monitoring & Analytics

### **Real-time Logs**

Bot menyediakan comprehensive logging:

```bash
# View live logs
tail -f logs/bot.log

# View trade history
tail -f logs/trades.log

# View errors
tail -f logs/error.log
```

### **Performance Metrics**

- ⏱️ **Execution Speed**: Transaction build & send time
- 📈 **Win Rate**: Percentage profitable trades
- 💰 **P&L Tracking**: Real-time profit/loss calculation
- 🎯 **Success Rate**: Transaction confirmation rate

### **Trading Statistics**

```javascript
// Get current stats
const stats = bot.getStatus();
console.log(stats.trader);

/*
Output:
{
  totalTrades: 45,
  successfulTrades: 38,
  winRate: "84.44%",
  totalProfit: "2.1500 SOL",
  totalLoss: "0.8200 SOL", 
  netProfit: "1.3300 SOL"
}
*/
```

## 🛡️ Security Best Practices

### **Wallet Security**

⚠️ **PENTING**: Gunakan burner wallet untuk trading bot

```bash
# Generate new wallet untuk bot
solana-keygen new --outfile bot-wallet.json

# Get private key dalam base58
solana-keygen pubkey bot-wallet.json
```

### **Risk Mitigation**

- ✅ **Never** import main wallet private key
- ✅ **Always** use dedicated trading wallet
- ✅ **Limit** fund amount dalam trading wallet
- ✅ **Monitor** bot activity secara regular
- ✅ **Set** reasonable position limits

### **Emergency Procedures**

```javascript
// Emergency stop (sell all positions)
await bot.emergencyStop();

// Manual sell specific token
await bot.manualSell('token-mint-address');

// Check current positions
const positions = bot.getStatus().positions;
```

## 🔍 Troubleshooting

### **Common Issues**

**1. RPC Connection Errors**
```bash
# Check RPC endpoint
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  YOUR_RPC_URL
```

**2. Transaction Failures**
- Increase priority fee
- Check wallet SOL balance
- Verify slippage tolerance

**3. Low Performance**
- Use private RPC endpoint
- Optimize priority fees
- Check network congestion

### **Debug Mode**

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Test specific functions
node src/test.js
```

## 📈 Performance Optimization

### **Speed Optimization**

1. **Private RPC**: Use dedicated endpoint
2. **Pre-signed TX**: Build transactions in advance  
3. **Priority Fees**: Dynamic fee calculation
4. **Skip Preflight**: Disable simulation untuk speed
5. **WebSocket**: Real-time data streaming

### **Latency Targets**

- 🎯 **RPC Latency**: <5ms
- 🎯 **Transaction Build**: <50ms
- 🎯 **Transaction Send**: <100ms
- 🎯 **Total Execution**: <200ms

## 🤝 Contributing

Contributions welcome! Please read contributing guidelines.

## ⚠️ Disclaimer

**TRADING RISKS**: 
- Cryptocurrency trading involves substantial risk
- Past performance tidak guarantee future results
- Only trade dengan funds you can afford to lose
- Bot tidak guarantee profits
- Always monitor bot activity

**USE AT YOUR OWN RISK**

## 📞 Support

- 📧 Email: support@example.com
- 💬 Telegram: @your-telegram
- 🐛 Issues: GitHub Issues

---

**Made with ❤️ for Solana DeFi Community**

*Happy Trading! 🚀*
