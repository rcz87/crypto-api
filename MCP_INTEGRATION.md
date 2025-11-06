# MCP Server Integration Guide

## 📘 Apa itu MCP Server?

MCP (Model Context Protocol) server memungkinkan Claude Desktop dan AI clients lainnya untuk mengakses sistem trading crypto Anda secara langsung melalui stdio protocol.

**Keuntungan:**
- ✅ Zero breaking changes - GPT Actions tetap berfungsi 100%
- ✅ Direct access dari Claude Desktop tanpa API keys
- ✅ Semua 18 trading tools available via MCP
- ✅ Parallel execution dengan Express.js API

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

MCP SDK (`@modelcontextprotocol/sdk@^1.0.4`) sudah ditambahkan ke dependencies.

### 2. Jalankan Express.js API (Required)

```bash
# Terminal 1
npm run dev
```

API harus running di `http://localhost:5000` karena MCP server akan memanggil endpoints ini.

### 3. Test MCP Server

```bash
# Terminal 2
npm run mcp:dev
```

Output yang diharapkan:
```
[MCP Server] Crypto Trading Intelligence MCP Server running on stdio
[MCP Server] Version: 1.0.0
[MCP Server] Tools available: 18
```

### 4. Configure Claude Desktop

Edit config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Tambahkan:

```json
{
  "mcpServers": {
    "crypto-trading": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/crypto-api/server/mcp/index.ts"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**PENTING**: Ganti `/ABSOLUTE/PATH/TO/` dengan path absolut ke project Anda!

Atau menggunakan npm script:

```json
{
  "mcpServers": {
    "crypto-trading": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/ABSOLUTE/PATH/TO/crypto-api"
    }
  }
}
```

### 5. Restart Claude Desktop

Setelah edit config, restart Claude Desktop untuk load MCP server.

## 🎯 Available Tools (18 Total)

### GuardiansOfTheToken (3 tools)
- `get_whale_data` - Whale detection & accumulation
- `get_live_template` - Professional signal templates
- `get_institutional_bias` - Smart money positioning

### Trading Intelligence (10 tools)
- `get_symbols` - List 71+ supported symbols
- `get_market_data` - Real-time market data
- `whale_alerts` - Large order detection
- `market_sentiment` - Funding + order flow analysis
- `multi_coin_screening` - 8-layer confluence analysis
- `new_listings` - New token discovery
- `volume_spikes` - Volume anomaly detection
- `opportunities` - AI opportunity scoring
- `alpha_screening` - Fundamental analysis
- `micro_caps` - Micro-cap gems finder

### Brain Orchestrator (5 tools)
- `get_brain_analysis` - AI-powered market analysis
- `get_brain_insights` - Historical insights
- `get_brain_stats` - Performance statistics
- `get_coinapi_health` - CoinAPI health check
- `get_gpts_health` - Overall system health

## 📋 Arsitektur

```
┌──────────────────────────┐
│   Claude Desktop         │
│   (MCP Client)           │
└────────┬─────────────────┘
         │ stdio
         ↓
┌──────────────────────────┐
│   MCP Server             │
│   Port: stdio            │
│   /server/mcp/index.ts   │
└────────┬─────────────────┘
         │ HTTP
         ↓
┌──────────────────────────┐
│   Express.js API         │
│   Port: 5000             │
│   ✅ TIDAK BERUBAH       │
│   - /gpts/* routes       │
│   - /api/* routes        │
│   - GOT actions          │
└──────────────────────────┘
```

## ✅ Verification Checklist

Setelah setup, verify bahwa semuanya bekerja:

- [ ] Express.js API running (`curl http://localhost:5000/gpts/health`)
- [ ] MCP server dapat start (`npm run mcp:dev`)
- [ ] Claude Desktop config ter-update dengan path yang benar
- [ ] Claude Desktop di-restart
- [ ] MCP server muncul di Claude's settings
- [ ] Tools available di Claude's tool suggestions
- [ ] Test tool call: `get_symbols` return 71 symbols
- [ ] GPT Actions tetap berfungsi (test via browser/Postman)

## 🔒 Keamanan & Isolasi

**MCP server TIDAK mengubah apapun:**
- ✅ Express.js routes tetap sama
- ✅ GPT Actions interface tidak tersentuh
- ✅ GuardiansOfTheToken API tetap berfungsi
- ✅ Database schemas tidak berubah
- ✅ Authentication/authorization tetap via Express
- ✅ Rate limiting handled by Express middleware

**MCP server hanya:**
- Wrapper untuk existing endpoints
- Call HTTP API seperti client biasa
- No direct database access
- No business logic changes

## 📊 Usage Examples

### Example 1: Detect Whale Activity

Di Claude Desktop, ask:
```
"Use the get_whale_data tool to check whale activity for BTC"
```

Claude akan call MCP server → Express.js API → return whale signals.

### Example 2: Screen Multiple Coins

```
"Use multi_coin_screening to analyze BTC, ETH, SOL with 15m timeframe"
```

### Example 3: Find Micro-Caps

```
"Use micro_caps tool to find gems under $50M market cap with volume spikes"
```

## 🐛 Troubleshooting

### MCP server tidak start
```bash
# Check Node.js version (need v18+)
node --version

# Check dependencies installed
npm list @modelcontextprotocol/sdk

# Check Express.js API running
curl http://localhost:5000/gpts/health
```

### Claude Desktop tidak detect server
1. Check config file path benar
2. Verify path absolut (bukan relative)
3. Restart Claude Desktop completely
4. Check logs: `~/Library/Logs/Claude/`

### Tool execution fails
```bash
# Test endpoint directly
curl -X POST http://localhost:5000/gpts/unified/advanced \
  -H "Content-Type: application/json" \
  -d '{"op": "whale_alerts", "symbol": "BTC"}'

# Check MCP server logs
npm run mcp:dev 2>&1 | grep ERROR
```

## 📚 Documentation

Dokumentasi lengkap tersedia di:
- `/server/mcp/README.md` - Full documentation
- `/server/mcp/tools/` - Tool implementations
- `/server/mcp/config.ts` - Configuration reference

## 🎉 Success Indicators

Jika berhasil setup:
1. Claude Desktop menampilkan "crypto-trading" di MCP servers list
2. Tool suggestions muncul saat chat dengan Claude
3. Tool calls return actual data dari sistem Anda
4. GPT Actions (existing) tetap berfungsi normal
5. Dapat run parallel: Claude Desktop + GPT Actions

## 🔄 Updates

Untuk update tools atau add new functionality:

```bash
# Edit tool files
vim server/mcp/tools/trading.tools.ts

# Development auto-reload
npm run mcp:dev

# Production: restart Claude Desktop
```

No need to restart Express.js API!

## 📞 Support

Jika ada masalah:
1. Check Express.js API health: `/gpts/health`
2. Check MCP server logs (stderr)
3. Test via MCP Inspector: `npx @modelcontextprotocol/inspector npm run mcp`
4. Verify Claude Desktop config syntax

---

**Dibuat dengan**: Zero breaking changes philosophy 🚀

Semua existing functionality (GPT Actions, Express routes, GOT integration) tetap 100% berfungsi!
