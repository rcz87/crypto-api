# Crypto Trading Intelligence MCP Server

MCP (Model Context Protocol) server untuk sistem trading crypto Anda. Server ini menyediakan akses ke semua fitur trading intelligence melalui protocol MCP, kompatibel dengan Claude Desktop dan AI clients lainnya.

## 🎯 Fitur Utama

### GuardiansOfTheToken Integration
- ✅ Whale detection (accumulation/distribution)
- ✅ Live template generation untuk trading signals
- ✅ Institutional bias analysis

### Trading Intelligence
- ✅ Multi-coin screening (8-layer confluence)
- ✅ Volume spike detection
- ✅ Whale alerts monitoring
- ✅ Market sentiment analysis
- ✅ New listings discovery
- ✅ Micro-caps screening
- ✅ Alpha opportunity detection

### AI Brain Orchestrator
- ✅ AI-powered market analysis
- ✅ Pattern detection & regime classification
- ✅ Historical insights tracking
- ✅ Performance statistics

## 📋 Arsitektur

```
┌─────────────────────────────────────┐
│   Claude Desktop / MCP Client       │
│   (stdio communication)              │
└──────────┬──────────────────────────┘
           │ MCP Protocol
           ↓
┌─────────────────────────────────────┐
│   MCP Server (Port: stdio)          │
│   /server/mcp/index.ts              │
│   - Tool routing                     │
│   - Request handling                 │
└──────────┬──────────────────────────┘
           │ HTTP Calls
           ↓
┌─────────────────────────────────────┐
│   Express.js API (Port: 5000)      │
│   TIDAK ADA PERUBAHAN               │
│   - /gpts/* routes ✅               │
│   - /api/* routes ✅                │
│   - GOT actions ✅                  │
└─────────────────────────────────────┘
```

**PENTING**: MCP server ini **TIDAK mengubah** Express.js API yang sudah ada. Semua GPT Actions interface tetap berfungsi normal!

## 🚀 Instalasi

### 1. Install Dependencies

```bash
npm install
```

Dependency yang ditambahkan:
- `@modelcontextprotocol/sdk@^1.0.4` - MCP SDK official

### 2. Pastikan Express.js Server Berjalan

MCP server memerlukan Express.js API yang sudah running:

```bash
# Terminal 1 - Run Express.js API
npm run dev
```

Server harus running di `http://localhost:5000`

### 3. Test MCP Server

```bash
# Terminal 2 - Test MCP server
npm run mcp:dev
```

Server akan output:
```
[MCP Server] Crypto Trading Intelligence MCP Server running on stdio
[MCP Server] Version: 1.0.0
[MCP Server] Tools available: 21
[MCP Server] Ready to accept requests from Claude Desktop or MCP clients
```

## 🔧 Konfigurasi Claude Desktop

Tambahkan ke Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` di macOS):

```json
{
  "mcpServers": {
    "crypto-trading": {
      "command": "node",
      "args": [
        "/absolute/path/to/crypto-api/server/mcp/index.ts"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**CATATAN**: Ganti `/absolute/path/to/crypto-api` dengan path absolut ke project Anda!

Atau menggunakan npm script:

```json
{
  "mcpServers": {
    "crypto-trading": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/crypto-api"
    }
  }
}
```

## 📚 Available Tools

### GuardiansOfTheToken Tools

#### 1. `get_whale_data`
Detect whale activity dan pola accumulation/distribution.

**Parameters:**
- `symbol` (string, optional): Trading symbol (default: 'BTC')
- `timeframe` (string, optional): Timeframe analisis (default: '1h')
- `operation` (string, optional): 'scan' atau 'monitor' (default: 'scan')
- `mode` (string, optional): 'single' atau 'continuous' (default: 'single')

**Example:**
```typescript
{
  "symbol": "BTC",
  "timeframe": "1h",
  "operation": "scan"
}
```

#### 2. `get_live_template`
Generate professional template untuk whale signals.

**Parameters:**
- `coin` (string, optional): Coin symbol (default: 'BTC')
- `template_type` (string, optional): Template type (default: 'accumulation_watch')

#### 3. `get_institutional_bias`
Analisis posisi institutional (smart money).

**Parameters:**
- `symbol` (string, required): Trading symbol (e.g., 'BTC-USDT-SWAP')

### Trading Tools

#### 4. `get_symbols`
List semua 71 trading symbols yang supported.

#### 5. `get_market_data`
Real-time market data untuk symbol tertentu.

**Parameters:**
- `symbol` (string, required): Trading symbol

#### 6. `whale_alerts`
Whale alerts dengan large buy/sell orders.

**Parameters:**
- `symbol` (string): Trading symbol
- `exchange` (string): Exchange name (default: 'hyperliquid')
- `min_usd` (number): Minimum order size USD (default: 1000000)

#### 7. `market_sentiment`
Analisis sentiment berdasarkan funding, order flow, institutional flow.

**Parameters:**
- `symbol` (string): Trading symbol

#### 8. `multi_coin_screening`
Screen multiple coins dengan 8-layer confluence (SMC, EMA, RSI, MACD, Funding, OI, CVD, Fibo).

**Parameters:**
- `symbols` (array): List of symbols (default: ['BTC', 'ETH', 'SOL'])
- `timeframe` (string): Timeframe (default: '15m')

#### 9. `new_listings`
Find new token listings dengan volume spike detection.

**Parameters:**
- `limit` (number): Number of results (default: 20)
- `maxMarketCap` (number): Max market cap USD (default: 500000000)
- `minVolumeChange` (number): Min volume change % (default: 50)

#### 10. `volume_spikes`
Detect volume spikes dengan whale activity analysis.

**Parameters:**
- `limit` (number): Number of results (default: 20)

#### 11. `opportunities`
Find trading opportunities dengan AI scoring.

**Parameters:**
- `symbol` (string, optional): Symbol to analyze
- `minScore` (number): Min opportunity score 0-100 (default: 60)

#### 12. `alpha_screening`
Screen alpha opportunities dengan fundamental & tokenomics analysis.

**Parameters:**
- `symbol` (string): Symbol to screen (default: 'BTC')

#### 13. `micro_caps`
Find micro-cap gems dengan whale accumulation detection.

**Parameters:**
- `maxMarketCap` (number): Max market cap USD (default: 100000000)
- `minScore` (number): Min alpha score (default: 50)
- `limit` (number): Number of results (default: 20)
- `minVolumeChange` (number): Min volume change % (default: 30)

### Brain Orchestrator Tools

#### 14. `get_brain_analysis`
AI-powered comprehensive market analysis.

**Parameters:**
- `symbols` (array): Symbols to analyze (default: ['BTC', 'ETH', 'SOL'])

#### 15. `get_brain_insights`
Get recent AI insights history.

**Parameters:**
- `limit` (number): Number of insights (default: 10)

#### 16. `get_brain_stats`
Brain orchestrator performance statistics.

#### 17. `get_coinapi_health`
CoinAPI service health check.

#### 18. `get_gpts_health`
Overall GPT Actions health status.

## 🧪 Testing

### Test dengan MCP Inspector

```bash
# Install MCP Inspector (global)
npm install -g @modelcontextprotocol/inspector

# Run inspector
npx @modelcontextprotocol/inspector npm run mcp
```

Inspector akan membuka web UI untuk testing tools.

### Test Manual dengan stdio

```bash
# Run MCP server
npm run mcp:dev

# Kirim request JSON (via stdin):
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

# Expected response: List of 21 tools
```

## 📁 File Structure

```
server/mcp/
├── index.ts                  # MCP server entry point
├── config.ts                 # Shared configuration
├── tools/
│   ├── guardians.tools.ts    # GuardiansOfTheToken tools
│   ├── trading.tools.ts      # Trading intelligence tools
│   └── brain.tools.ts        # Brain orchestrator tools
└── README.md                 # This file
```

## 🔒 Keamanan

- ✅ Semua tools call existing Express.js API (no direct DB access)
- ✅ API authentication tetap via Express middleware
- ✅ Rate limiting handled by Express.js
- ✅ MCP server hanya wrapper, tidak ada logic bisnis baru
- ✅ Shared configuration (.env) untuk consistency

## ⚡ Performance

- MCP server sangat lightweight (stdio communication)
- Zero overhead pada Express.js API
- Parallel tool execution supported
- Timeouts configured per operation

## 🐛 Troubleshooting

### MCP Server tidak start
```bash
# Check if Express.js API running
curl http://localhost:5000/gpts/health

# Check environment variables
cat .env | grep -E "(PY_BASE|NODE_SERVICE_URL|COINGLASS_API_KEY)"
```

### Tool execution error
```bash
# Check logs (stderr)
npm run mcp:dev 2>&1 | grep ERROR

# Test API endpoint directly
curl -X POST http://localhost:5000/gpts/unified/advanced \
  -H "Content-Type: application/json" \
  -d '{"op": "whale_alerts", "symbol": "BTC"}'
```

### Claude Desktop tidak detect MCP server
1. Restart Claude Desktop
2. Check config path: `~/Library/Application Support/Claude/claude_desktop_config.json`
3. Verify absolute paths in config
4. Check permissions: `ls -la /path/to/crypto-api/server/mcp/index.ts`

## 📊 Monitoring

MCP server logs semua requests ke stderr:

```bash
[MCP Server] Tool called: get_whale_data
[MCP GuardiansTools] Whale data error: Connection timeout
[MCP Server] Tool get_whale_data error: Failed to fetch whale data
```

## 🔄 Updates

Untuk update MCP server tanpa downtime:

```bash
# Edit tool files
vim server/mcp/tools/guardians.tools.ts

# MCP server auto-reload (development mode)
npm run mcp:dev

# Production: restart Claude Desktop untuk reload config
```

## 📞 Support

Jika ada masalah:
1. Check Express.js API (`/gpts/health`)
2. Check MCP server logs (stderr)
3. Test tools via MCP Inspector
4. Verify Claude Desktop config

## 🎉 Success Indicators

Jika berhasil, Anda akan melihat:
- ✅ Claude Desktop menampilkan crypto-trading di MCP servers list
- ✅ Tools muncul di Claude's tool suggestions
- ✅ Tool calls return data dari Express.js API
- ✅ GPT Actions tetap berfungsi normal (tidak terganggu)

---

**PENTING**: MCP server ini adalah **wrapper** untuk Express.js API. Tidak ada perubahan pada:
- GPT Actions interface (/gpts/*)
- Express.js routes
- GuardiansOfTheToken integration
- Database schemas
- Authentication/authorization

Semua tetap berfungsi seperti sebelumnya! 🚀
