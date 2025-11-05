# Endpoint Discovery Report

Generated: Wed Oct 22 16:35:57 WIB 2025

## Summary

- **Total Endpoints Found:** 199
- **GPT-Specific Endpoints:** 12
- **General API Endpoints:** 187

## Files Analyzed

### ./server/routes/test-endpoints.ts
- Endpoints found: 3

### ./server/routes/gpts.ts
- Endpoints found: 11

### ./server/routes.ts
- Endpoints found: 49

### ./server/index_fixed.ts
- Endpoints found: 3

### ./server/index-dev.ts
- Endpoints found: 1

### ./server/index.ts
- Endpoints found: 5

### ./server/routes/alpha.ts
- Endpoints found: 5

### ./server/routes/system.ts
- Endpoints found: 15

### ./server/routes/trading.ts
- Endpoints found: 74

### ./server/routes/auth.ts
- Endpoints found: 7

### ./server/routes/brain.ts
- Endpoints found: 3

### ./server/routes/seo.ts
- Endpoints found: 7

### ./server/routes/ghost.ts
- Endpoints found: 9

### ./server/routes/heatmap.ts
- Endpoints found: 7

## 🎯 GPT-Specific Endpoints (12)

These endpoints are specifically designed for GPT Actions integration:


### GET /gpt-actions-schema.json
- **File:** `./server/routes/seo.ts`
- **Line:** 95
- **Router:** `app`
- **Code:** `app.get('/gpt-actions-schema.json', (req: Request, res: Response) => {`

### GET /gpts/brain/insights
- **File:** `./server/routes/gpts.ts`
- **Line:** 733
- **Router:** `app`
- **Code:** `app.get('/gpts/brain/insights', async (req: Request, res: Response) => {`

### GET /gpts/brain/stats
- **File:** `./server/routes/gpts.ts`
- **Line:** 760
- **Router:** `app`
- **Code:** `app.get('/gpts/brain/stats', async (req: Request, res: Response) => {`

### GET /gpts/health
- **File:** `./server/routes/gpts.ts`
- **Line:** 658
- **Router:** `app`
- **Code:** `app.get('/gpts/health', async (req: Request, res: Response) => {`

### GET /gpts/health/coinapi
- **File:** `./server/routes/gpts.ts`
- **Line:** 783
- **Router:** `app`
- **Code:** `app.get('/gpts/health/coinapi', async (req: Request, res: Response) => {`

### GET /gpts/institutional/bias
- **File:** `./server/routes/gpts.ts`
- **Line:** 569
- **Router:** `app`
- **Code:** `app.get('/gpts/institutional/bias', async (req: Request, res: Response) => {`

### GET /gpts/unified/market/:symbol
- **File:** `./server/routes/gpts.ts`
- **Line:** 506
- **Router:** `app`
- **Code:** `app.get('/gpts/unified/market/:symbol', async (req: Request, res: Response) => {`

### GET /gpts/unified/symbols
- **File:** `./server/routes/gpts.ts`
- **Line:** 28
- **Router:** `app`
- **Code:** `app.get('/gpts/unified/symbols', async (req: Request, res: Response) => {`

### POST /gpts/brain/analysis
- **File:** `./server/routes/gpts.ts`
- **Line:** 708
- **Router:** `app`
- **Code:** `app.post('/gpts/brain/analysis', async (req: Request, res: Response) => {`

### POST /gpts/coinglass/live-template
- **File:** `./server/routes/gpts.ts`
- **Line:** 202
- **Router:** `app`
- **Code:** `app.post('/gpts/coinglass/live-template', async (req: Request, res: Response) => {`

### POST /gpts/coinglass/whale-data
- **File:** `./server/routes/gpts.ts`
- **Line:** 91
- **Router:** `app`
- **Code:** `app.post('/gpts/coinglass/whale-data', async (req: Request, res: Response) => {`

### POST /gpts/unified/advanced
- **File:** `./server/routes/gpts.ts`
- **Line:** 338
- **Router:** `app`
- **Code:** `app.post('/gpts/unified/advanced', async (req: Request, res: Response) => {`

## 📋 All Discovered Endpoints (199)

Complete list of all endpoints found in the system:


### DELETE Endpoints (2)

- **/api-keys/:keyId**
  - File: `./server/routes/auth.ts:224`

- **/api/ghost/orders/:ref_id**
  - File: `./server/routes/ghost.ts:219`

### GET Endpoints (163)

- **/.well-known/ai-plugin.json**
  - File: `./server/routes.ts:2553`

- **/.well-known/ai-plugin.json**
  - File: `./server/routes/seo.ts:155`

- **/.well-known/openapi.json**
  - File: `./server/routes/seo.ts:177`

- **/api-keys**
  - File: `./server/routes/auth.ts:192`

- **/api/:pair/complete**
  - File: `./server/routes/trading.ts:793`

- **/api/:pair/confluence**
  - File: `./server/routes/trading.ts:2539`

- **/api/:pair/cvd**
  - File: `./server/routes/trading.ts:2399`

- **/api/:pair/fibonacci**
  - File: `./server/routes/trading.ts:2889`

- **/api/:pair/funding**
  - File: `./server/routes/trading.ts:1132`

- **/api/:pair/liquidation**
  - File: `./server/routes.ts:2413`

- **/api/:pair/oi**
  - File: `./server/routes/trading.ts:1869`

- **/api/:pair/oi/enhanced**
  - File: `./server/routes/trading.ts:1257`

- **/api/:pair/oi/history**
  - File: `./server/routes/trading.ts:1374`

- **/api/:pair/open-interest**
  - File: `./server/routes/trading.ts:1936`

- **/api/:pair/order-flow**
  - File: `./server/routes/trading.ts:3028`

- **/api/:pair/orderbook**
  - File: `./server/routes/trading.ts:1058`

- **/api/:pair/signal-history**
  - File: `./server/routes/trading.ts:3301`

- **/api/:pair/smc**
  - File: `./server/routes/trading.ts:2275`

- **/api/:pair/technical**
  - File: `./server/routes/trading.ts:2755`

- **/api/:pair/ticker**
  - File: `./server/routes/trading.ts:995`

- **/api/:pair/trading-signals**
  - File: `./server/routes/trading.ts:3175`

- **/api/:pair/volume-history**
  - File: `./server/routes/trading.ts:1998`

- **/api/:pair/volume-profile**
  - File: `./server/routes/trading.ts:2144`

- **/api/adaptive-threshold/stats**
  - File: `./server/routes.ts:3750`

- **/api/admin/security-stats**
  - File: `./server/routes/system.ts:595`

- **/api/ai/backtest/:strategyId**
  - File: `./server/routes/trading.ts:1729`

- **/api/ai/enhanced-performance**
  - File: `./server/routes.ts:3410`

- **/api/ai/enhanced-signal**
  - File: `./server/routes.ts:3117`

- **/api/ai/signal**
  - File: `./server/routes/trading.ts:1635`

- **/api/ai/strategy-performance**
  - File: `./server/routes/trading.ts:1682`

- **/api/ai/tracking/overall-performance**
  - File: `./server/routes.ts:3527`

- **/api/alerting/health**
  - File: `./server/routes.ts:286`

- **/api/coinapi/arbitrage/:asset**
  - File: `./server/routes/trading.ts:3537`

- **/api/coinapi/assets**
  - File: `./server/routes/trading.ts:3693`

- **/api/coinapi/assets/:assetId**
  - File: `./server/routes/trading.ts:3728`

- **/api/coinapi/best-price/:asset/:quoteAsset?**
  - File: `./server/routes/trading.ts:3497`

- **/api/coinapi/bulk-quotes**
  - File: `./server/routes/trading.ts:4124`

- **/api/coinapi/correlation**
  - File: `./server/routes/trading.ts:4080`

- **/api/coinapi/exchanges**
  - File: `./server/routes/trading.ts:3761`

- **/api/coinapi/exchanges/:exchangeId**
  - File: `./server/routes/trading.ts:3796`

- **/api/coinapi/health**
  - File: `./server/routes/trading.ts:3621`

- **/api/coinapi/history/:symbolId**
  - File: `./server/routes/trading.ts:3646`

- **/api/coinapi/indices**
  - File: `./server/routes/trading.ts:3829`

- **/api/coinapi/indices/:indexId/current**
  - File: `./server/routes/trading.ts:3864`

- **/api/coinapi/market-overview**
  - File: `./server/routes/trading.ts:3897`

- **/api/coinapi/market-sentiment**
  - File: `./server/routes/trading.ts:4909`

- **/api/coinapi/metrics/:symbolId**
  - File: `./server/routes/trading.ts:4211`

- **/api/coinapi/multi-ticker/:asset**
  - File: `./server/routes/trading.ts:3449`

- **/api/coinapi/quote/:symbolId**
  - File: `./server/routes/trading.ts:3413`

- **/api/coinapi/rate/:base/:quote?**
  - File: `./server/routes/trading.ts:3586`

- **/api/coinapi/top-assets**
  - File: `./server/routes/trading.ts:4172`

- **/api/coinapi/twap/:symbolId**
  - File: `./server/routes/trading.ts:3933`

- **/api/coinapi/vwap/:symbolId**
  - File: `./server/routes/trading.ts:4041`

- **/api/cors-test**
  - File: `./server/index_fixed.ts:131`

- **/api/debug/memory**
  - File: `./server/index.ts:752`

- **/api/debug/memory/components**
  - File: `./server/routes.ts:3846`

- **/api/enhanced-ai/:pair/signal**
  - File: `./server/routes/trading.ts:4747`

- **/api/enhanced-ai/performance**
  - File: `./server/routes/trading.ts:4821`

- **/api/event-logging/health**
  - File: `./server/routes/system.ts:485`

- **/api/ghost/analytics**
  - File: `./server/routes/ghost.ts:262`

- **/api/ghost/orders**
  - File: `./server/routes/ghost.ts:47`

- **/api/ghost/orders/:ref_id**
  - File: `./server/routes/ghost.ts:78`

- **/api/ghost/portfolio**
  - File: `./server/routes/ghost.ts:24`

- **/api/ghost/status**
  - File: `./server/routes/ghost.ts:386`

- **/api/listings/new**
  - File: `./server/routes.ts:3553`

- **/api/listings/opportunities**
  - File: `./server/routes.ts:3647`

- **/api/listings/spikes**
  - File: `./server/routes.ts:3602`

- **/api/logs**
  - File: `./server/routes/system.ts:450`

- **/api/metrics**
  - File: `./server/routes.ts:1664`

- **/api/metrics**
  - File: `./server/routes/system.ts:299`

- **/api/multi-ticker**
  - File: `./server/routes/trading.ts:948`

- **/api/openapi**
  - File: `./server/routes.ts:251`

- **/api/openapi.json**
  - File: `./server/routes/seo.ts:63`

- **/api/orderbook/:symbol**
  - File: `./server/routes/system.ts:138`

- **/api/pairs/supported**
  - File: `./server/routes/trading.ts:635`

- **/api/premium/institutional-analytics**
  - File: `./server/routes.ts:2672`

- **/api/premium/market-intelligence**
  - File: `./server/routes.ts:2735`

- **/api/premium/tier-status**
  - File: `./server/routes.ts:2811`

- **/api/regime/batch**
  - File: `./server/routes/trading.ts:4389`

- **/api/regime/cached/:symbolId**
  - File: `./server/routes/trading.ts:4287`

- **/api/regime/detect/:symbolId**
  - File: `./server/routes/trading.ts:4250`

- **/api/regime/strategy-rules**
  - File: `./server/routes/trading.ts:4332`

- **/api/scheduler/status**
  - File: `./server/routes/system.ts:573`

- **/api/screening/confluence**
  - File: `./server/routes/trading.ts:735`

- **/api/security/metrics**
  - File: `./server/routes.ts:338`

- **/api/sentiment/dashboard**
  - File: `./server/routes/trading.ts:4997`

- **/api/signal/institutional/:symbol?**
  - File: `./server/routes.ts:2889`

- **/api/sol/complete**
  - File: `./server/routes/trading.ts:870`

- **/api/sol/confluence**
  - File: `./server/routes/trading.ts:2647`

- **/api/sol/cvd**
  - File: `./server/routes/trading.ts:2466`

- **/api/sol/fibonacci**
  - File: `./server/routes.ts:1519`

- **/api/sol/fibonacci**
  - File: `./server/routes/trading.ts:2958`

- **/api/sol/funding**
  - File: `./server/routes/trading.ts:1194`

- **/api/sol/funding/correlation**
  - File: `./server/routes/trading.ts:1588`

- **/api/sol/funding/enhanced**
  - File: `./server/routes/trading.ts:1493`

- **/api/sol/funding/history**
  - File: `./server/routes/trading.ts:1540`

- **/api/sol/liquidation**
  - File: `./server/routes.ts:2136`

- **/api/sol/liquidation-heatmap**
  - File: `./server/routes.ts:2201`

- **/api/sol/liquidation-price**
  - File: `./server/routes.ts:2481`

- **/api/sol/mtf-analysis**
  - File: `./server/routes.ts:2566`

- **/api/sol/multi-exchange-orderbook**
  - File: `./server/routes.ts:1311`

- **/api/sol/multi-exchange-stats**
  - File: `./server/routes.ts:1376`

- **/api/sol/oi/enhanced**
  - File: `./server/routes/trading.ts:1315`

- **/api/sol/oi/history**
  - File: `./server/routes/trading.ts:1433`

- **/api/sol/open-interest**
  - File: `./server/routes/trading.ts:1824`

- **/api/sol/order-flow**
  - File: `./server/routes.ts:1590`

- **/api/sol/order-flow**
  - File: `./server/routes/trading.ts:3101`

- **/api/sol/premium-orderbook**
  - File: `./server/routes.ts:2615`

- **/api/sol/signal-history**
  - File: `./server/routes/trading.ts:3362`

- **/api/sol/smc**
  - File: `./server/routes/trading.ts:2334`

- **/api/sol/technical**
  - File: `./server/routes.ts:1240`

- **/api/sol/technical**
  - File: `./server/routes/trading.ts:2819`

- **/api/sol/trading-signals**
  - File: `./server/routes/trading.ts:3237`

- **/api/sol/volume-history**
  - File: `./server/routes/trading.ts:2071`

- **/api/sol/volume-profile**
  - File: `./server/routes/trading.ts:2209`

- **/api/spec**
  - File: `./server/routes.ts:2024`

- **/api/test/bybit**
  - File: `./server/routes.ts:1427`

- **/api/test/bybit-ws**
  - File: `./server/routes.ts:1480`

- **/coinapi/health**
  - File: `./server/routes/test-endpoints.ts:118`

- **/export/:symbol**
  - File: `./server/routes/heatmap.ts:274`

- **/gpt-actions-schema.json** 🤖 GPT
  - File: `./server/routes/seo.ts:95`

- **/gpts/brain/insights** 🤖 GPT
  - File: `./server/routes/gpts.ts:733`

- **/gpts/brain/stats** 🤖 GPT
  - File: `./server/routes/gpts.ts:760`

- **/gpts/health** 🤖 GPT
  - File: `./server/routes/gpts.ts:658`

- **/gpts/health/coinapi** 🤖 GPT
  - File: `./server/routes/gpts.ts:783`

- **/gpts/institutional/bias** 🤖 GPT
  - File: `./server/routes/gpts.ts:569`

- **/gpts/unified/market/:symbol** 🤖 GPT
  - File: `./server/routes/gpts.ts:506`

- **/gpts/unified/symbols** 🤖 GPT
  - File: `./server/routes/gpts.ts:28`

- **/health**
  - File: `./server/index_fixed.ts:120`

- **/health**
  - File: `./server/routes/system.ts:206`

- **/health/circuit-breaker**
  - File: `./server/routes/system.ts:60`

- **/health/coinapi**
  - File: `./server/routes/system.ts:73`

- **/health/memory**
  - File: `./server/index.ts:749`

- **/health/python**
  - File: `./server/routes/system.ts:57`

- **/healthz**
  - File: `./server/routes/system.ts:20`

- **/insights**
  - File: `./server/routes/brain.ts:16`

- **/liquidations/:symbol**
  - File: `./server/routes/heatmap.ts:129`

- **/liquidations/:symbol/heatmap**
  - File: `./server/routes/heatmap.ts:165`

- **/liquidations/:symbol/leverage**
  - File: `./server/routes/heatmap.ts:202`

- **/liquidity/:symbol**
  - File: `./server/routes/heatmap.ts:239`

- **/market-metrics**
  - File: `./server/routes/alpha.ts:271`

- **/me**
  - File: `./server/routes/auth.ts:119`

- **/metrics**
  - File: `./server/routes/system.ts:173`

- **/metrics/prometheus**
  - File: `./server/routes/system.ts:191`

- **/micro-caps**
  - File: `./server/routes/alpha.ts:7`

- **/monitor/etf/:asset?**
  - File: `./server/routes.ts:205`

- **/monitor/system**
  - File: `./server/routes.ts:160`

- **/monitor/ticker/:symbol**
  - File: `./server/routes.ts:128`

- **/new-listings**
  - File: `./server/routes/alpha.ts:92`

- **/openapi-4.0.1-gpts-compat.yaml**
  - File: `./server/index.ts:742`

- **/openapi.json**
  - File: `./server/routes.ts:72`

- **/openapi.json**
  - File: `./server/routes/seo.ts:30`

- **/openapi.yaml**
  - File: `./server/routes.ts:2982`

- **/robots.txt**
  - File: `./server/routes/seo.ts:11`

- **/screen/:symbol**
  - File: `./server/routes/alpha.ts:166`

- **/sitemap.xml**
  - File: `./server/routes/seo.ts:116`

- **/stats**
  - File: `./server/routes/alpha.ts:311`

- **/stats**
  - File: `./server/routes/brain.ts:41`

- **/status**
  - File: `./server/routes/heatmap.ts:324`

- **/unified/:symbol**
  - File: `./server/routes/heatmap.ts:24`

- **env**
  - File: `./server/index_fixed.ts:154`

- **env**
  - File: `./server/index-dev.ts:113`

- **env**
  - File: `./server/index.ts:820`

### POST Endpoints (33)

- **/admin/reset-quotas**
  - File: `./server/routes/auth.ts:259`

- **/analyze**
  - File: `./server/routes/brain.ts:62`

- **/api-keys**
  - File: `./server/routes/auth.ts:138`

- **/api/adaptive-threshold/evaluate**
  - File: `./server/routes.ts:3822`

- **/api/adaptive-threshold/update-outcome**
  - File: `./server/routes.ts:3772`

- **/api/admin/unblock-all**
  - File: `./server/routes/system.ts:616`

- **/api/admin/unblock/:ip**
  - File: `./server/routes/system.ts:647`

- **/api/ai/optimize-strategy**
  - File: `./server/routes/trading.ts:1780`

- **/api/ai/tracking/execution**
  - File: `./server/routes.ts:3461`

- **/api/ai/tracking/outcome**
  - File: `./server/routes.ts:3495`

- **/api/backtest/filtered**
  - File: `./server/routes.ts:448`

- **/api/debug/gc**
  - File: `./server/index.ts:787`

- **/api/ghost/cleanup**
  - File: `./server/routes/ghost.ts:358`

- **/api/ghost/orders**
  - File: `./server/routes/ghost.ts:109`

- **/api/listings/scan**
  - File: `./server/routes.ts:3688`

- **/api/listings/test-telegram**
  - File: `./server/routes.ts:3715`

- **/api/regime/clear-cache**
  - File: `./server/routes/trading.ts:4705`

- **/api/screen/filtered**
  - File: `./server/routes.ts:357`

- **/api/screen/intelligent**
  - File: `./server/routes.ts:3178`

- **/api/screener/screen**
  - File: `./server/routes/trading.ts:347`

- **/api/screening/confluence**
  - File: `./server/routes/trading.ts:680`

- **/api/sol/position-calculator**
  - File: `./server/routes.ts:2265`

- **/api/sol/risk-dashboard**
  - File: `./server/routes.ts:2329`

- **/api/telegram/test/institutional**
  - File: `./server/routes.ts:2913`

- **/api/telegram/test/sniper**
  - File: `./server/routes.ts:2947`

- **/coinapi/inject-fault**
  - File: `./server/routes/test-endpoints.ts:20`

- **/coinapi/restore**
  - File: `./server/routes/test-endpoints.ts:103`

- **/gpts/brain/analysis** 🤖 GPT
  - File: `./server/routes/gpts.ts:708`

- **/gpts/coinglass/live-template** 🤖 GPT
  - File: `./server/routes/gpts.ts:202`

- **/gpts/coinglass/whale-data** 🤖 GPT
  - File: `./server/routes/gpts.ts:91`

- **/gpts/unified/advanced** 🤖 GPT
  - File: `./server/routes/gpts.ts:338`

- **/login**
  - File: `./server/routes/auth.ts:77`

- **/register**
  - File: `./server/routes/auth.ts:31`

### PUT Endpoints (1)

- **/api/ghost/orders/:ref_id/status**
  - File: `./server/routes/ghost.ts:173`

## 🧪 Testing Guide

To test these endpoints, use curl with appropriate authentication:

```bash
# Get your API key from .env file
API_KEY=$(grep GPT_ACTIONS_API_KEY .env | cut -d '=' -f2)

# Test a GPT endpoint
curl -H "X-API-Key: $API_KEY" http://localhost:5000/api/gpt/your-endpoint
```

## 💡 Recommendations

1. **Documentation:** Consider generating OpenAPI spec from these endpoints
2. **Testing:** Implement automated tests for GPT endpoints
3. **Monitoring:** Set up logging for GPT Action calls
4. **Security:** Ensure all GPT endpoints have proper authentication